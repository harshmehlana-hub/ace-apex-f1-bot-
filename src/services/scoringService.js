import { config } from '../config.js';
import { Prediction } from '../database/models/Prediction.js';
import { User } from '../database/models/User.js';
import { getOrCreateSeasonStanding } from './seasonStandingService.js';

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

export async function processRaceResults(raceId, result) {
  const predictions = await Prediction.find({ raceId });
  const scores = [];
  
  for (const prediction of predictions) {
    const { points, isPerfect } = calculateScore(prediction, result);
    
    // Update prediction with points
    prediction.pointsAwarded = points;
    await prediction.save();
    
    // Update user stats
    let user = await User.findOne({ discordId: prediction.userId });
    if (user) {
      user.totalPoints += points;
      user.pointsReachedAt = new Date();
      if (isPerfect) {
        user.perfectPredictions += 1;
      }
      await user.save();
    }

const standing = await getOrCreateSeasonStanding(
  prediction.userId,
  prediction.season
);

standing.racePoints += points;
standing.totalPoints += points;

if (prediction.p1Driver === result.p1Driver) {
  standing.correctP1Predictions += 1;
}

if (prediction.p2Driver === result.p2Driver) {
  standing.correctP2Predictions += 1;
}

if (prediction.p3Driver === result.p3Driver) {
  standing.correctP3Predictions += 1;
}

if (isPerfect) {
  standing.perfectPodiums += 1;
}

await standing.save();
    
    scores.push({
      userId: prediction.userId,
      pointsAwarded: points,
      submittedAt: prediction.submittedAt,
    });
  }
  
  // Sort by points (desc) then by submission time (asc) for tiebreaker
  scores.sort((a, b) => {
    if (b.pointsAwarded !== a.pointsAwarded) {
      return b.pointsAwarded - a.pointsAwarded;
    }
    return a.submittedAt - b.submittedAt;
  });
  
  return scores;
}

export async function recalculateRaceScores(raceId, oldResult, newResult) {
  const predictions = await Prediction.find({ raceId });
  
  for (const prediction of predictions) {
    const oldScore = calculateScore(prediction, oldResult);
    const newScore = calculateScore(prediction, newResult);
    
    const pointDiff = newScore.points - oldScore.points;
    const perfectDiff = (newScore.isPerfect ? 1 : 0) - (oldScore.isPerfect ? 1 : 0);
    
    // Update prediction
    prediction.pointsAwarded = newScore.points;
    await prediction.save();
    
    // Update user
    const user = await User.findOne({ discordId: prediction.userId });
    if (user) {
      user.totalPoints += pointDiff;
      user.perfectPredictions += perfectDiff;
      user.pointsReachedAt = new Date();
      await user.save();
    }

const standing = await getOrCreateSeasonStanding(
  prediction.userId,
  prediction.season
);

standing.racePoints += pointDiff;
standing.totalPoints += pointDiff;
standing.perfectPodiums += perfectDiff;

// Remove old accuracy counts
if (prediction.p1Driver === oldResult.p1Driver) {
  standing.correctP1Predictions -= 1;
}

if (prediction.p2Driver === oldResult.p2Driver) {
  standing.correctP2Predictions -= 1;
}

if (prediction.p3Driver === oldResult.p3Driver) {
  standing.correctP3Predictions -= 1;
}

// Apply new accuracy counts
if (prediction.p1Driver === newResult.p1Driver) {
  standing.correctP1Predictions += 1;
}

if (prediction.p2Driver === newResult.p2Driver) {
  standing.correctP2Predictions += 1;
}

if (prediction.p3Driver === newResult.p3Driver) {
  standing.correctP3Predictions += 1;
}

await standing.save();
 }
}
