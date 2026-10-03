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
  const userIds = new Set();
  const standings = await SeasonStanding.find({ season }).select('userId').session(session);
  standings.forEach(s => userIds.add(s.userId));
  const predictions = await Prediction.find({ season }).select('userId').session(session);
  predictions.forEach(p => userIds.add(p.userId));
  const qualifyingPredictions = await QualifyingPrediction.find({ season }).select('userId').session(session);
  qualifyingPredictions.forEach(p => userIds.add(p.userId));
  const transactions = await PointTransaction.find({ season }).select('userId').session(session);
  transactions.forEach(t => userIds.add(t.userId));
  for (const userId of userIds) await rebuildSeasonStanding(userId, season, { session });
}
