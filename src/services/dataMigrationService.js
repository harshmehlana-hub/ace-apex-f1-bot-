import { User } from '../database/models/User.js';
import { Race } from '../database/models/Race.js';
import { Prediction } from '../database/models/Prediction.js';
import { Result } from '../database/models/Result.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { SeasonStanding } from '../database/models/SeasonStanding.js';
import { PointTransaction } from '../database/models/PointTransaction.js';
import { getCurrentSeason } from './seasonService.js';
import { calculateScore, calculateQualifyingScore } from './scoringService.js';
import { SchemaMigration } from '../database/models/SchemaMigration.js';

const migrationName = 'v4-fast-current-season-score-reconciliation';

export async function runDataMigrations() {
  if (await SchemaMigration.exists({ name: migrationName })) {
    console.log('[Migration] Already completed:', migrationName);
    return;
  }

  console.log('[Migration] Starting fast score reconciliation...');
  const currentSeason = await getCurrentSeason();
  const seasons = new Set([currentSeason]);

  for (const season of await Race.distinct('season')) seasons.add(season);
  for (const season of await Qualifying.distinct('season')) seasons.add(season);
  for (const season of await SeasonStanding.distinct('season')) seasons.add(season);

  for (const season of seasons) {
    console.log(`[Migration] Processing season ${season}...`);

    const races = await Race.find({ season, status: 'completed' }).lean();
    const raceIds = races.map(r => r._id);
    const results = await Result.find({ raceId: { $in: raceIds } }).lean();
    const resultByRace = new Map(results.map(r => [String(r.raceId), r]));

    const predictions = raceIds.length
      ? await Prediction.find({ season, raceId: { $in: raceIds } }).lean()
      : [];

    const predictionWrites = [];
    const transactionWrites = [];

    for (const prediction of predictions) {
      const result = resultByRace.get(String(prediction.raceId));
      if (!result) continue;

      const points = prediction.pointsAwarded ?? calculateScore(prediction, result).points;

      if (prediction.pointsAwarded == null) {
        predictionWrites.push({
          updateOne: {
            filter: { _id: prediction._id, pointsAwarded: { $exists: false } },
            update: { $set: { pointsAwarded: points } },
          },
        });
      }

      transactionWrites.push({
        updateOne: {
          filter: {
            userId: prediction.userId,
            season,
            sourceType: 'race_result',
            sourceId: String(prediction.raceId),
          },
          update: {
            $setOnInsert: {
              amount: points,
              reason: `${races.find(r => String(r._id) === String(prediction.raceId))?.name || 'Legacy race'} legacy race result`,
            },
          },
          upsert: true,
        },
      });
    }

    if (predictionWrites.length) await Prediction.bulkWrite(predictionWrites, { ordered: false });
    if (transactionWrites.length) await PointTransaction.bulkWrite(transactionWrites, { ordered: false });

    const qualifyingSessions = await Qualifying.find({ season, status: 'completed' }).lean();
    const qualifyingIds = qualifyingSessions.map(q => q._id);
    const qualifyingResults = await QualifyingResult.find({ qualifyingId: { $in: qualifyingIds } }).lean();
    const qualifyingResultById = new Map(qualifyingResults.map(r => [String(r.qualifyingId), r]));
    const qualifyingPredictions = qualifyingIds.length
      ? await QualifyingPrediction.find({ season, qualifyingId: { $in: qualifyingIds } }).lean()
      : [];

    const qualifyingWrites = [];
    const qualifyingTransactionWrites = [];

    for (const prediction of qualifyingPredictions) {
      const result = qualifyingResultById.get(String(prediction.qualifyingId));
      if (!result) continue;

      const points = prediction.pointsAwarded ?? calculateQualifyingScore(prediction, result);

      if (prediction.pointsAwarded == null) {
        qualifyingWrites.push({
          updateOne: {
            filter: { _id: prediction._id, pointsAwarded: { $exists: false } },
            update: { $set: { pointsAwarded: points } },
          },
        });
      }

      qualifyingTransactionWrites.push({
        updateOne: {
          filter: {
            userId: prediction.userId,
            season,
            sourceType: 'qualifying_result',
            sourceId: String(prediction.qualifyingId),
          },
          update: {
            $setOnInsert: {
              amount: points,
              reason: `${qualifyingSessions.find(q => String(q._id) === String(prediction.qualifyingId))?.name || 'Legacy qualifying'} legacy qualifying result`,
            },
          },
          upsert: true,
        },
      });
    }

    if (qualifyingWrites.length) await QualifyingPrediction.bulkWrite(qualifyingWrites, { ordered: false });
    if (qualifyingTransactionWrites.length) {
      await PointTransaction.bulkWrite(qualifyingTransactionWrites, { ordered: false });
    }

    const oldStandings = await SeasonStanding.find({ season }).lean();
    const allUsers = season === currentSeason ? await User.find({}).lean() : [];
    const userIds = new Set([
      ...oldStandings.map(s => s.userId),
      ...predictions.map(p => p.userId),
      ...qualifyingPredictions.map(p => p.userId),
      ...allUsers.map(u => u.discordId),
    ]);

    let transactions = await PointTransaction.find({ season }).sort({ createdAt: 1, _id: 1 }).lean();
    const totalsByUser = new Map();

    for (const transaction of transactions) {
      const entry = totalsByUser.get(transaction.userId) || { race: 0, qualifying: 0, adjustment: 0, total: 0 };
      if (transaction.sourceType === 'race_result') entry.race += transaction.amount;
      else if (transaction.sourceType === 'qualifying_result') entry.qualifying += transaction.amount;
      else if (transaction.sourceType === 'admin_adjustment' || transaction.sourceType === 'legacy_adjustment') entry.adjustment += transaction.amount;
      entry.total += transaction.amount;
      totalsByUser.set(transaction.userId, entry);
    }

    const legacyWrites = [];
    for (const userId of userIds) {
      const user = allUsers.find(u => u.discordId === userId);
      const oldStanding = oldStandings.find(s => s.userId === userId);
      const targetTotal = user?.totalPoints ?? oldStanding?.totalPoints ?? 0;
      const known = totalsByUser.get(userId) || { race: 0, qualifying: 0, adjustment: 0, total: 0 };
      const difference = targetTotal - known.total;

      if (difference !== 0) {
        legacyWrites.push({
          updateOne: {
            filter: { userId, season, sourceType: 'legacy_adjustment', sourceId: `migration:${season}` },
            update: {
              $setOnInsert: {
                amount: difference,
                reason: 'Preserved pre-ledger season balance during migration',
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (legacyWrites.length) await PointTransaction.bulkWrite(legacyWrites, { ordered: false });

    transactions = await PointTransaction.find({ season }).sort({ createdAt: 1, _id: 1 }).lean();

    const sums = new Map();
    for (const transaction of transactions) {
      const entry = sums.get(transaction.userId) || { race: 0, qualifying: 0, adjustment: 0, total: 0, reachedAt: null, running: 0 };
      if (transaction.sourceType === 'race_result') entry.race += transaction.amount;
      else if (transaction.sourceType === 'qualifying_result') entry.qualifying += transaction.amount;
      else if (transaction.sourceType === 'admin_adjustment' || transaction.sourceType === 'legacy_adjustment') entry.adjustment += transaction.amount;
      entry.total += transaction.amount;
      entry.running += transaction.amount;
      sums.set(transaction.userId, entry);
    }

    const raceResultById = new Map(results.map(r => [String(r.raceId), r]));
    const poleByQualifying = new Map(qualifyingResults.map(r => [String(r.qualifyingId), r.poleDriver]));
    const statsByUser = new Map();

    for (const prediction of predictions) {
      const result = raceResultById.get(String(prediction.raceId));
      if (!result) continue;
      const stats = statsByUser.get(prediction.userId) || {
        p1: 0, p2: 0, p3: 0, perfect: 0, raceSubmitted: 0, pole: 0, qualifyingSubmitted: 0,
      };
      const p1 = prediction.p1Driver === result.p1Driver;
      const p2 = prediction.p2Driver === result.p2Driver;
      const p3 = prediction.p3Driver === result.p3Driver;
      if (p1) stats.p1++;
      if (p2) stats.p2++;
      if (p3) stats.p3++;
      if (p1 && p2 && p3) stats.perfect++;
      stats.raceSubmitted++;
      statsByUser.set(prediction.userId, stats);
    }

    for (const prediction of qualifyingPredictions) {
      const stats = statsByUser.get(prediction.userId) || {
        p1: 0, p2: 0, p3: 0, perfect: 0, raceSubmitted: 0, pole: 0, qualifyingSubmitted: 0,
      };
      if (prediction.predictedDriver === poleByQualifying.get(String(prediction.qualifyingId))) stats.pole++;
      stats.qualifyingSubmitted++;
      statsByUser.set(prediction.userId, stats);
    }

    const standingWrites = [];
    for (const userId of userIds) {
      const sumsForUser = sums.get(userId) || { race: 0, qualifying: 0, adjustment: 0, total: 0 };
      const stats = statsByUser.get(userId) || {
        p1: 0, p2: 0, p3: 0, perfect: 0, raceSubmitted: 0, pole: 0, qualifyingSubmitted: 0,
      };

      let running = 0;
      let reachedAt = null;
      for (const transaction of transactions.filter(t => t.userId === userId)) {
        running += transaction.amount;
        if (reachedAt === null && running === sumsForUser.total) reachedAt = transaction.createdAt;
      }

      standingWrites.push({
        updateOne: {
          filter: { userId, season },
          update: {
            $set: {
              racePoints: sumsForUser.race,
              qualifyingPoints: sumsForUser.qualifying,
              adjustmentPoints: sumsForUser.adjustment,
              totalPoints: sumsForUser.total,
              correctP1Predictions: stats.p1,
              correctP2Predictions: stats.p2,
              correctP3Predictions: stats.p3,
              perfectPodiums: stats.perfect,
              correctPolePredictions: stats.pole,
              racePredictionsSubmitted: stats.raceSubmitted,
              qualifyingPredictionsSubmitted: stats.qualifyingSubmitted,
              pointsReachedAt: sumsForUser.total > 0 ? reachedAt : null,
            },
            $setOnInsert: { userId, season },
          },
          upsert: true,
        },
      });
    }

    if (standingWrites.length) await SeasonStanding.bulkWrite(standingWrites, { ordered: false });
    console.log(`[Migration] Season ${season} complete: ${userIds.size} users reconciled.`);
  }

  await SchemaMigration.create({ name: migrationName });
  console.log('[Migration] Completed successfully.');
}
