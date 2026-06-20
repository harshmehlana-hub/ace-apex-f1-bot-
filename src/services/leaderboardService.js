import { User } from '../database/models/User.js';
import { SeasonStanding } from '../database/models/SeasonStanding.js';

export async function getSeasonLeaderboard() {
  const users = await User.find({ totalPoints: { $gt: 0 } })
    .sort({ totalPoints: -1, pointsReachedAt: 1 })
    .lean();
  
  return users;
}

export async function getUserRank(discordId) {
  const user = await User.findOne({ discordId });
  if (!user) return null;
  
  const rank = await User.countDocuments({
    $or: [
      { totalPoints: { $gt: user.totalPoints } },
      {
        totalPoints: user.totalPoints,
        pointsReachedAt: { $lt: user.pointsReachedAt },
      },
    ],
  });
  
  const totalUsers = await User.countDocuments();
  
  return {
    user,
    rank: rank + 1,
    totalUsers,
  };
}
export async function getSeasonRank(
  discordId,
  season
) {
  const standing = await SeasonStanding.findOne({
    userId: discordId,
    season,
  });

  if (!standing) {
    return null;
  }

  const rank = await SeasonStanding.countDocuments({
    season,
    totalPoints: { $gt: standing.totalPoints },
  });

  const totalUsers = await SeasonStanding.countDocuments({
    season,
  });

  return {
    standing,
    rank: rank + 1,
    totalUsers,
  };
}
