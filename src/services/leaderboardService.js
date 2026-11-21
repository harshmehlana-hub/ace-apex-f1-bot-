import { SeasonStanding } from '../database/models/SeasonStanding.js';
import { User } from '../database/models/User.js';
import { createLeaderboardEmbed } from '../utils/embeds.js';

const LEADERBOARD_CHANNEL_ID = '1482241992309342241';

export async function publishTopTenLeaderboard(client, season, eventLabel) {
  const standings = await SeasonStanding.find({ season })
    .sort({ totalPoints: -1, pointsReachedAt: 1, userId: 1 })
    .limit(10)
    .lean();

  if (!standings.length) return false;

  const users = await User.find({ discordId: { $in: standings.map(entry => entry.userId) } })
    .select('discordId username')
    .lean();
  const usernames = new Map(users.map(user => [user.discordId, user.username]));
  const topTen = standings.map(entry => ({
    ...entry,
    username: usernames.get(entry.userId) || entry.userId,
  }));

  const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
  if (!channel) throw new Error('Leaderboard channel not found: ' + LEADERBOARD_CHANNEL_ID);

  const embed = createLeaderboardEmbed(topTen, 1, 10, season)
    .setFooter({ text: 'Updated Top 10 standings' });

  await channel.send({
    content: '@everyone 📊 Updated standings after ' + eventLabel,
    embeds: [embed],
  });
  return true;
}


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
