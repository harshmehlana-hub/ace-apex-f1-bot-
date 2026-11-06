import { AdminAuditLog } from '../database/models/AdminAuditLog.js';

const USAGE_LOG_CHANNEL_ID = '1567522882907807845';

export async function auditAdminCommand(interaction, status = 'started', error = null) {
  try {
    const options = {};
    for (const option of interaction.options?.data || []) {
      options[option.name] = option.user?.id || option.value || option.options?.map(child => ({ name: child.name, value: child.value })) || null;
    }
    await AdminAuditLog.create({
      adminId: interaction.user.id,
      guildId: interaction.guildId,
      command: interaction.commandName,
      options,
      status,
      error: error ? String(error?.message || error).slice(0, 2000) : null,
    });

    // Post one readable entry when an admin starts a slash command.
    // Do not ping the admin; the mention is displayed without a notification.
    if (status === 'started' && interaction.client) {
      const channel = await interaction.client.channels.fetch(USAGE_LOG_CHANNEL_ID);
      if (!channel?.isTextBased() || !channel.send) {
        throw new Error('Usage logs channel is not a text channel or is unavailable.');
      }
      await channel.send({
        content: `<@${interaction.user.id}> ran the command /${interaction.commandName}`,
        allowedMentions: { parse: [] },
      });
    }
  } catch (auditError) {
    console.error('Failed to write admin audit log:', auditError);
  }
}

export async function logPurchaseButtonClick(interaction) {
  try {
    const channel = await interaction.client.channels.fetch(USAGE_LOG_CHANNEL_ID);
    if (!channel?.isTextBased() || !channel.send) {
      throw new Error('Usage logs channel is not a text channel or is unavailable.');
    }

    await channel.send({
      content: `🎟️ <@${interaction.user.id}> clicked **Get Race Pass / Membership** in <#${interaction.channelId}>.`,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error('Failed to log membership purchase button click:', error);
  }
}
