import { Routes } from 'discord.js';
import { config } from '../config.js';

export async function updatePredictorOfTheWeekRole(guild, topPredictorIds, previousPredictorIds = []) {
  const roleId = config.roles.predictor;
  if (!roleId) return;

  const top5 = [...new Set(topPredictorIds)].slice(0, 5);
  const previous = new Set(previousPredictorIds);

  for (const userId of previous) {
    if (top5.includes(userId)) continue;
    try {
      await guild.client.rest.delete(Routes.guildMemberRole(guild.id, userId, roleId));
    } catch (error) {
      if (error?.status !== 404) console.error(`Failed to remove Predictor role from ${userId}:`, error);
    }
  }

  for (const userId of top5) {
    try {
      await guild.client.rest.put(Routes.guildMemberRole(guild.id, userId, roleId));
    } catch (error) {
      console.error(`Failed to add Predictor role to ${userId}:`, error);
    }
  }
}

export async function reconcilePredictorOfTheWeekRoles(guild, season, currentTopPredictorIds) {
  const { Race } = await import('../database/models/Race.js');
  const historicalPredictorIds = await Race.distinct('predictorOfTheWeekIds', { season, status: 'completed' });
  await updatePredictorOfTheWeekRole(guild, currentTopPredictorIds, historicalPredictorIds);
}
