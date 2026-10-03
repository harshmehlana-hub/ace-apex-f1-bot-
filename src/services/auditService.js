import { AdminAuditLog } from '../database/models/AdminAuditLog.js';

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
  } catch (auditError) {
    console.error('Failed to write admin audit log:', auditError);
  }
}
