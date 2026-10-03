import { SeasonStanding } from '../database/models/SeasonStanding.js';
import { User } from '../database/models/User.js';

export async function getSeasonLeaderboard(season, guild = null) {
  const standings = await SeasonStanding.find({ season })
    .sort({ totalPoints: -1, pointsReachedAt: 1, userId: 1 })
    .lean();

  const userIds = standings.map(s => s.userId);
  const users = await User.find({ discordId: { $in: userIds } }).lean();
  const userMap = new Map(users.map(u => [u.discordId, u]));

  // Refresh names from Discord when the leaderboard is requested. This means
  // a username change is reflected even if the bot was offline when it happened.
  if (guild && userIds.length > 0) {
    try {
      const members = await guild.members.fetch({ user: userIds, cache: false });
      const usernameUpdates = [];

      for (const [userId, member] of members) {
        const username = member.user?.username;
        if (!username) continue;

        const stored = userMap.get(userId);
        if (stored) stored.username = username;
        else userMap.set(userId, { discordId: userId, username });

        usernameUpdates.push({
          updateOne: {
            filter: { discordId: userId },
            update: {
              $set: { username },
              $setOnInsert: { discordId: userId },
            },
            upsert: true,
          },
        });
      }

      if (usernameUpdates.length > 0) {
        await User.bulkWrite(usernameUpdates, { ordered: false });
      }
    } catch (error) {
      // The stored name remains a safe fallback if Discord cannot be queried.
      console.error('[Leaderboard] Failed to refresh Discord usernames:', error);
    }
  }

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
