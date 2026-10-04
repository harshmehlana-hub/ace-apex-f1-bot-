import mongoose from 'mongoose';
import { config } from '../config.js';
import { Prediction } from '../database/models/Prediction.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { PointTransaction } from '../database/models/PointTransaction.js';
import { rebuildAllSeasonStandings } from './seasonStandingService.js';

export function calculateScore(prediction, result) {
  let correctPositions = 0;
  if (prediction.p1Driver === result.p1Driver) correctPositions++;
  if (prediction.p2Driver === result.p2Driver) correctPositions++;
  if (prediction.p3Driver === result.p3Driver) correctPositions++;
  return {
    correctPositions,
    points: config.scoring[correctPositions],
    isPerfect: correctPositions === 3,
  };
}

export function calculateQualifyingScore(prediction, result) {
  return prediction.predictedDriver === result.poleDriver
    ? config.qualifyingScoring.correct
    : config.qualifyingScoring.incorrect;
}

async function upsertTransaction({ userId, season, sourceType, sourceId, amount, reason, createdBy }, session) {
  return PointTransaction.findOneAndUpdate(
    { userId, season, sourceType, sourceId },
    { $set: { amount, reason, createdBy } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );
}

export async function processRaceResults(race, result, options = {}) {
  const session = options.session || null;
  const predictions = await Prediction.find({ raceId: race._id }).session(session);

  const predictionUpdates = predictions.map(prediction => {
    const { points } = calculateScore(prediction, result);
    prediction.pointsAwarded = points;
    return prediction;
  });

  if (predictionUpdates.length) {
    await Prediction.bulkWrite(
      predictionUpdates.map(prediction => ({
        updateOne: {
          filter: { _id: prediction._id },
          update: { $set: { pointsAwarded: prediction.pointsAwarded } },
        },
      })),
      { session }
    );

    await PointTransaction.bulkWrite(
      predictionUpdates.map(prediction => ({
        updateOne: {
          filter: {
            userId: prediction.userId,
            season: prediction.season,
            sourceType: 'race_result',
            sourceId: String(race._id),
          },
          update: {
            $set: {
              amount: prediction.pointsAwarded,
              reason: `${race.name} race result`,
              createdBy: null,
            },
          },
          $setOnInsert: {
            userId: prediction.userId,
            season: prediction.season,
            sourceType: 'race_result',
            sourceId: String(race._id),
          },
          upsert: true,
        },
      })),
      { session }
    );
  }
  return predictions.map(prediction => ({
    userId: prediction.userId,
    pointsAwarded: prediction.pointsAwarded,
    submittedAt: prediction.submittedAt,
  })).sort((a, b) => b.pointsAwarded - a.pointsAwarded || a.submittedAt - b.submittedAt || a.userId.localeCompare(b.userId));
}

export async function recalculateRaceScores(race, oldResult, newResult, options = {}) {
  const session = options.session || null;
  const predictions = await Prediction.find({ raceId: race._id }).session(session);

  for (const prediction of predictions) {
    const { points } = calculateScore(prediction, newResult);
    prediction.pointsAwarded = points;
    await prediction.save({ session });
    await upsertTransaction({
      userId: prediction.userId,
      season: prediction.season,
      sourceType: 'race_result',
      sourceId: String(race._id),
      amount: points,
      reason: `${race.name} corrected race result`,
    }, session);
  }

  return predictions.map(prediction => ({
    userId: prediction.userId,
    pointsAwarded: prediction.pointsAwarded,
    submittedAt: prediction.submittedAt,
  })).sort((a, b) => b.pointsAwarded - a.pointsAwarded || a.submittedAt - b.submittedAt || a.userId.localeCompare(b.userId));
}

export async function processQualifyingResults(qualifying, result, options = {}) {
  const session = options.session || null;
  const predictions = await QualifyingPrediction.find({ qualifyingId: qualifying._id }).session(session);

  for (const prediction of predictions) {
    const points = calculateQualifyingScore(prediction, result);
    prediction.pointsAwarded = points;
    await prediction.save({ session });
    await upsertTransaction({
      userId: prediction.userId,
      season: prediction.season,
      sourceType: 'qualifying_result',
      sourceId: String(qualifying._id),
      amount: points,
      reason: `${qualifying.name} qualifying result`,
    }, session);
  }

  await rebuildAllSeasonStandings(qualifying.season, { session });
  return predictions.map(prediction => ({
    userId: prediction.userId,
    pointsAwarded: prediction.pointsAwarded,
  }));
}

export async function recalculateQualifyingScores(qualifying, result, options = {}) {
  return processQualifyingResults(qualifying, result, options);
}

export async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let value;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    return value;
  } finally {
    await session.endSession();
  }
}
