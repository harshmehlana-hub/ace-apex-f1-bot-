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
import { rebuildAllSeasonStandings } from './seasonStandingService.js';
import { SchemaMigration } from '../database/models/SchemaMigration.js';

export async function runDataMigrations() {
  const migrationName = 'v3-current-season-score-reconciliation';
  if (await SchemaMigration.exists({ name: migrationName })) return;
  const currentSeason = await getCurrentSeason();
  const seasons = new Set([currentSeason]);
  (await Race.distinct('season')).forEach(s => seasons.add(s));
  (await Qualifying.distinct('season')).forEach(s => seasons.add(s));
  (await SeasonStanding.distinct('season')).forEach(s => seasons.add(s));

  for (const season of seasons) {
    const races = await Race.find({ season, status: 'completed' });
    for (const race of races) {
      const result = await Result.findOne({ raceId: race._id });
      if (!result) continue;
      const predictions = await Prediction.find({ raceId: race._id });
      for (const prediction of predictions) {
        const points = prediction.pointsAwarded ?? calculateScore(prediction, result).points;
        if (prediction.pointsAwarded == null) {
          prediction.pointsAwarded = points;
          await prediction.save();
        }
        await PointTransaction.updateOne(
          { userId: prediction.userId, season, sourceType: 'race_result', sourceId: String(race._id) },
          { $setOnInsert: { amount: points, reason: `${race.name} legacy race result` } },
          { upsert: true }
        );
      }
    }

    const qualifyingSessions = await Qualifying.find({ season, status: 'completed' });
    for (const qualifying of qualifyingSessions) {
      const result = await QualifyingResult.findOne({ qualifyingId: qualifying._id });
      if (!result) continue;
      const predictions = await QualifyingPrediction.find({ qualifyingId: qualifying._id });
      for (const prediction of predictions) {
        const points = prediction.pointsAwarded ?? calculateQualifyingScore(prediction, result);
        if (prediction.pointsAwarded == null) {
          prediction.pointsAwarded = points;
          await prediction.save();
        }
        await PointTransaction.updateOne(
          { userId: prediction.userId, season, sourceType: 'qualifying_result', sourceId: String(qualifying._id) },
          { $setOnInsert: { amount: points, reason: `${qualifying.name} legacy qualifying result` } },
          { upsert: true }
        );
      }
    }

    const oldStandings = await SeasonStanding.find({ season }).lean();
    for (const old of oldStandings) {
      const eventTransactions = await PointTransaction.find({ userId: old.userId, season, sourceType: { $in: ['race_result', 'qualifying_result'] } }).lean();
      const eventTotal = eventTransactions.reduce((sum, t) => sum + t.amount, 0);
      const existingAdjustments = await PointTransaction.aggregate([
        { $match: { userId: old.userId, season, sourceType: { $in: ['admin_adjustment', 'legacy_adjustment'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const knownAdjustments = existingAdjustments[0]?.total || 0;
      const legacyDifference = old.totalPoints - eventTotal - knownAdjustments;
      if (legacyDifference !== 0) {
        await PointTransaction.updateOne(
          { userId: old.userId, season, sourceType: 'legacy_adjustment', sourceId: `migration:${season}` },
          { $setOnInsert: { amount: legacyDifference, reason: 'Preserved pre-ledger season balance during migration' } },
          { upsert: true }
        );
      }
    }

    if (season === currentSeason) {
      const users = await User.find({ totalPoints: { $gt: 0 } }).lean();
      for (const user of users) {
        const oldCurrent = oldStandings.find(s => s.userId === user.discordId);
        const currentLegacyBase = oldCurrent?.totalPoints || 0;
        const eventTransactions = await PointTransaction.find({ userId: user.discordId, season, sourceType: { $in: ['race_result', 'qualifying_result'] } }).lean();
        const eventTotal = eventTransactions.reduce((sum, t) => sum + t.amount, 0);
        const existingAdjustments = await PointTransaction.aggregate([
          { $match: { userId: user.discordId, season, sourceType: { $in: ['admin_adjustment', 'legacy_adjustment'] } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const knownAdjustments = existingAdjustments[0]?.total || 0;
        const legacyDifference = user.totalPoints - eventTotal - knownAdjustments;
        if (legacyDifference !== 0) {
          await PointTransaction.updateOne(
            { userId: user.discordId, season, sourceType: 'legacy_adjustment', sourceId: `user-balance:${season}` },
            { $setOnInsert: { amount: legacyDifference, reason: `Preserved legacy balance during migration (old season base ${currentLegacyBase})` } },
            { upsert: true }
          );
        }
      }
    }

    await rebuildAllSeasonStandings(season);
  }

  await SchemaMigration.create({ name: migrationName });
}
