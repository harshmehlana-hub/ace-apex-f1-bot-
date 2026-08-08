import { Routes } from 'discord.js';
import { config } from '../config.js';

export async function updatePredictorOfTheWeekRole(
  guild,
  topPredictorIds,
  previousPredictorIds = []
) {
  const roleId = config.roles.predictor;

  if (!roleId) {
    console.error('Predictor of the Week role ID is not configured.');
    return;
  }

  const top5 = topPredictorIds.slice(0, 5);

  // Remove the role from the previous top 5
  for (const userId of previousPredictorIds) {
    if (top5.includes(userId)) {
      continue;
    }

    try {
      await guild.client.rest.delete(
        Routes.guildMemberRole(
          guild.id,
          userId,
          roleId
        )
      );

      console.log(
        `Predictor of the Week role removed from ${userId}`
      );
    } catch (error) {
      console.error(
        `Failed to remove Predictor of the Week role from ${userId}:`,
        error
      );
    }
  }

  // Add the role to the new top 5
  for (const userId of top5) {
    try {
      await guild.client.rest.put(
        Routes.guildMemberRole(
          guild.id,
          userId,
          roleId
        )
      );

      console.log(
        `Predictor of the Week role assigned to ${userId}`
      );
    } catch (error) {
      console.error(
        `Failed to add Predictor of the Week role to ${userId}:`,
        error
      );
    }
  }
}