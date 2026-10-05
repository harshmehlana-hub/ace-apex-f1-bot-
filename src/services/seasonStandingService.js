import { SeasonStanding } from '../database/models/SeasonStanding.js';
import { PointTransaction } from '../database/models/PointTransaction.js';
import { Prediction } from '../database/models/Prediction.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { Result } from '../database/models/Result.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { Race } from '../database/models/Race.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { User } from '../database/models/User.js';

export async function getOrCreateSeasonStanding(userId, season, options = {}) {
  const { session } = options;
  return SeasonStanding.findOneAndUpdate(
    { userId, season },
    { $setOnInsert: { userId, season } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );
}

export async function rebuildSeasonStanding(userId, season, options = {}) {
  const { session } = options;
  const raceTransactions = await PointTransaction.find({ userId, season, sourceType: 'race_result' }).session(session);
  const qualifyingTransactions = await PointTransaction.find({ userId, season, sourceType: 'qualifying_result' }).session(session);
  const adjustments = await PointTransaction.find({ userId, season, sourceType: { $in: ['admin_adjustment', 'legacy_adjustment'] } }).session(session);

  const standing = await getOrCreateSeasonStanding(userId, season, { session });
  standing.racePoints = raceTransactions.reduce((sum, t) => sum + t.amount, 0);
  standing.qualifyingPoints = qualifyingTransactions.reduce((sum, t) => sum + t.amount, 0);
  standing.adjustmentPoints = adjustments.reduce((sum, t) => sum + t.amount, 0);
  standing.totalPoints = standing.racePoints + standing.qualifyingPoints + standing.adjustmentPoints;

  const raceIds = (await Race.find({ season, status: 'completed' }).select('_id').session(session)).map(r => r._id);
  const qualifyingIds = (await Qualifying.find({ season, status: 'completed' }).select('_id').session(session)).map(q => q._id);

  const racePredictions = await Prediction.find({ userId, season, raceId: { $in: raceIds } }).session(session);
  const qualifyingPredictions = await QualifyingPrediction.find({ userId, season, qualifyingId: { $in: qualifyingIds } }).session(session);

  const raceResults = await Result.find({ raceId: { $in: raceIds } }).session(session);
  const resultByRace = new Map(raceResults.map(r => [String(r.raceId), r]));
  standing.correctP1Predictions = 0;
  standing.correctP2Predictions = 0;
  standing.correctP3Predictions = 0;
  standing.perfectPodiums = 0;

  for (const prediction of racePredictions) {
    const result = resultByRace.get(String(prediction.raceId));
    if (!result) continue;
    const p1 = prediction.p1Driver === result.p1Driver;
    const p2 = prediction.p2Driver === result.p2Driver;
    const p3 = prediction.p3Driver === result.p3Driver;
    if (p1) standing.correctP1Predictions += 1;
    if (p2) standing.correctP2Predictions += 1;
    if (p3) standing.correctP3Predictions += 1;
    if (p1 && p2 && p3) standing.perfectPodiums += 1;
  }

  const qualifyingResults = await QualifyingResult.find({ qualifyingId: { $in: qualifyingIds } }).session(session);
  const poleByQualifying = new Map(qualifyingResults.map(r => [String(r.qualifyingId), r.poleDriver]));
  standing.correctPolePredictions = qualifyingPredictions.reduce(
    (sum, prediction) => sum + (prediction.predictedDriver === poleByQualifying.get(String(prediction.qualifyingId)) ? 1 : 0),
    0
  );
  standing.racePredictionsSubmitted = racePredictions.length;
  standing.qualifyingPredictionsSubmitted = qualifyingPredictions.length;

  const allTransactions = await PointTransaction.find({ userId, season }).sort({ createdAt: 1, _id: 1 }).session(session);
  let runningTotal = 0;
  let reachedAt = null;
  for (const transaction of allTransactions) {
    runningTotal += transaction.amount;
    if (reachedAt === null && runningTotal === standing.totalPoints) reachedAt = transaction.createdAt;
  }
  standing.pointsReachedAt = standing.totalPoints > 0 ? (reachedAt || standing.pointsReachedAt || new Date()) : null;

  await standing.save({ session });
  await User.findOneAndUpdate({ discordId: userId }, { $set: { username: (await User.findOne({ discordId: userId }).session(session))?.username || userId } }, { upsert: true, new: true, session });
  return standing;
}

export async function rebuildAllSeasonStandings(season, options = {}) {
  const { session } = options;

  // Rebuild the entire season from a small, fixed number of queries and one
  // bulk write. This avoids the old N-users x many-queries pattern that became
  // very slow on large Discord servers.
  const [standings, races, qualifyingSessions, transactions] = await Promise.all([
    SeasonStanding.find({ season }).select('userId').session(session).lean(),
    Race.find({ season, status: 'completed' }).select('_id').session(session).lean(),
    Qualifying.find({ season, status: 'completed' }).select('_id').session(session).lean(),
    PointTransaction.find({ season }).select('userId amount sourceType createdAt').sort({ createdAt: 1, _id: 1 }).session(session).lean(),
  ]);

  const raceIds = races.map(r => r._id);
  const qualifyingIds = qualifyingSessions.map(q => q._id);

  const [predictions, qualifyingPredictions] = await Promise.all([
    raceIds.length
      ? Prediction.find({ season, raceId: { $in: raceIds } }).select('userId raceId p1Driver p2Driver p3Driver').session(session).lean()
      : [],
    qualifyingIds.length
      ? QualifyingPrediction.find({ season, qualifyingId: { $in: qualifyingIds } }).select('userId qualifyingId predictedDriver').session(session).lean()
      : [],
  ]);

  const [raceResults, qualifyingResults] = await Promise.all([
    raceIds.length ? Result.find({ raceId: { $in: raceIds } }).select('raceId p1Driver p2Driver p3Driver').session(session).lean() : [],
    qualifyingIds.length ? QualifyingResult.find({ qualifyingId: { $in: qualifyingIds } }).select('qualifyingId poleDriver').session(session).lean() : [],
  ]);

  const userIds = new Set([
    ...standings.map(s => s.userId),
    ...predictions.map(p => p.userId),
    ...qualifyingPredictions.map(p => p.userId),
    ...transactions.map(t => t.userId),
  ]);

  const totals = new Map();
  const stats = new Map();
  const firstReached = new Map();
  const raceResultById = new Map(raceResults.map(r => [String(r.raceId), r]));
  const poleByQualifying = new Map(qualifyingResults.map(r => [String(r.qualifyingId), r.poleDriver]));

  const getTotals = userId => totals.get(userId) || { race: 0, qualifying: 0, adjustment: 0, total: 0 };
  const getStats = userId => stats.get(userId) || {
    p1: 0, p2: 0, p3: 0, perfect: 0, pole: 0, raceSubmitted: 0, qualifyingSubmitted: 0,
  };

  for (const transaction of transactions) {
    const entry = getTotals(transaction.userId);
    if (transaction.sourceType === 'race_result') entry.race += transaction.amount;
    else if (transaction.sourceType === 'qualifying_result') entry.qualifying += transaction.amount;
    else if (transaction.sourceType === 'admin_adjustment' || transaction.sourceType === 'legacy_adjustment') entry.adjustment += transaction.amount;
    entry.total += transaction.amount;
    totals.set(transaction.userId, entry);
  }

  for (const prediction of predictions) {
    const entry = getStats(prediction.userId);
    const result = raceResultById.get(String(prediction.raceId));
    entry.raceSubmitted += 1;
    if (result) {
      const p1 = prediction.p1Driver === result.p1Driver;
      const p2 = prediction.p2Driver === result.p2Driver;
      const p3 = prediction.p3Driver === result.p3Driver;
      if (p1) entry.p1 += 1;
      if (p2) entry.p2 += 1;
      if (p3) entry.p3 += 1;
      if (p1 && p2 && p3) entry.perfect += 1;
    }
    stats.set(prediction.userId, entry);
  }

  for (const prediction of qualifyingPredictions) {
    const entry = getStats(prediction.userId);
    entry.qualifyingSubmitted += 1;
    if (prediction.predictedDriver === poleByQualifying.get(String(prediction.qualifyingId))) entry.pole += 1;
    stats.set(prediction.userId, entry);
  }

  // Transactions are already sorted, so the first time the running total
  // reaches the final total is the same pointsReachedAt value as the old
  // per-user rebuild.
  const runningTotals = new Map();
  for (const transaction of transactions) {
    const running = (runningTotals.get(transaction.userId) || 0) + transaction.amount;
    runningTotals.set(transaction.userId, running);
    const total = totals.get(transaction.userId)?.total || 0;
    if (!firstReached.has(transaction.userId) && running === total) {
      firstReached.set(transaction.userId, transaction.createdAt);
    }
  }

  const writes = [];
  for (const userId of userIds) {
    const total = getTotals(userId);
    const stat = getStats(userId);
    writes.push({
      updateOne: {
        filter: { userId, season },
        update: {
          $set: {
            racePoints: total.race,
            qualifyingPoints: total.qualifying,
            adjustmentPoints: total.adjustment,
            totalPoints: total.total,
            correctP1Predictions: stat.p1,
            correctP2Predictions: stat.p2,
            correctP3Predictions: stat.p3,
            perfectPodiums: stat.perfect,
            correctPolePredictions: stat.pole,
            racePredictionsSubmitted: stat.raceSubmitted,
            qualifyingPredictionsSubmitted: stat.qualifyingSubmitted,
            pointsReachedAt: total.total > 0 ? (firstReached.get(userId) || new Date()) : null,
          },
          $setOnInsert: { userId, season },
        },
        upsert: true,
      },
    });
  }

  if (writes.length) {
    await SeasonStanding.bulkWrite(writes, { ordered: false, session });
  }

  return userIds.size;
}
