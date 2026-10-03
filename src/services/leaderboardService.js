import { SeasonStanding } from '../database/models/SeasonStanding.js';
import { User } from '../database/models/User.js';

export async function getSeasonLeaderboard(season) {
  const standings = await SeasonStanding.find({ season })
    .sort({ totalPoints: -1, pointsReachedAt: 1, userId: 1 })
    .lean();

  const userIds = standings.map(s => s.userId);
  const users = await User.find({ discordId: { $in: userIds } }).lean();
  const userMap = new Map(users.map(u => [u.discordId, u]));

  return standings.map(standing => ({
    ...standing,
    username: userMap.get(standing.userId)?.username || standing.userId,
  }));
}

export async function getUserRank(discordId, season) {
  const standing = await SeasonStanding.findOne({ userId: discordId, season });
  if (!standing) return null;

  const rank = await SeasonStanding.countDocuments({
    season,
    $or: [
      { totalPoints: { $gt: standing.totalPoints } },
      { totalPoints: standing.totalPoints, pointsReachedAt: { $lt: standing.pointsReachedAt || new Date(8640000000000000) } },
      { totalPoints: standing.totalPoints, pointsReachedAt: standing.pointsReachedAt, userId: { $lt: standing.userId } },
    ],
  });

  const totalUsers = await SeasonStanding.countDocuments({ season });
  const user = await User.findOne({ discordId }).lean();
  return { standing, user, rank: rank + 1, totalUsers };
}

export async function getSeasonRank(discordId, season) {
  return getUserRank(discordId, season);
}
