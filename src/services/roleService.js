import { config } from '../config.js';

export async function updatePredictorOfTheWeekRole(guild, topPredictorIds) {
  const role = await guild.roles.fetch(config.roles.predictor);
  if (!role) {
    console.error('Predictor of the Week role not found');
    return;
  }
  
  // Remove role from all current holders
  const membersWithRole = role.members;
  for (const [, member] of membersWithRole) {
    try {
      await member.roles.remove(role);
    } catch (error) {
      console.error(`Failed to remove role from ${member.user.tag}:`, error);
    }
  }
  
  // Add role to top 5 predictors
  const top5 = topPredictorIds.slice(0, 5);
  for (const userId of top5) {
    try {
      const member = await guild.members.fetch(userId);
      await member.roles.add(role);
    } catch (error) {
      console.error(`Failed to add role to user ${userId}:`, error);
    }
  }
}
