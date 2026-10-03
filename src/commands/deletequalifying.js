import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } from 'discord.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { rebuildAllSeasonStandings } from '../services/seasonStandingService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deletequalifying')
    .setDescription('Cancel a qualifying session safely (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    const sessions = await Qualifying.find({ status: { $ne: 'cancelled' } }).sort({ sessionStartTime: -1 });
    if (!sessions.length) return interaction.reply({ content: '❌ No qualifying sessions found.', ephemeral: true });

    const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('delete_qualifying').setPlaceholder('Select qualifying session').addOptions(sessions.slice(0, 25).map(q => ({ label: q.name, description: `Season ${q.season} • ${q.status}`, value: String(q._id) }))));
    const response = await interaction.reply({ content: '⚠️ Select a qualifying session to cancel. Completed sessions cannot be deleted or cancelled.', components: [menu], ephemeral: true });
    try {
      const selected = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const qualifying = sessions.find(q => String(q._id) === selected.values[0]);
      if (!qualifying) return selected.update({ content: '❌ Qualifying session not found.', components: [] });
      if (qualifying.status === 'completed') return selected.update({ content: '❌ Completed qualifying sessions are locked. Use the correction command instead.', components: [] });
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_delete').setLabel('Cancel Session').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_delete').setLabel('Keep Session').setStyle(ButtonStyle.Secondary)
      );
      await selected.update({ content: `⚠️ **Cancel ${qualifying.name}?**\n\nThe session and predictions will remain in the database for audit/history.`, components: [buttons] });
      const confirm = await response.awaitMessageComponent({ componentType: ComponentType.Button, time: 30000 });
      if (confirm.customId === 'cancel_delete') return confirm.update({ content: '❌ Cancellation aborted.', components: [] });
      qualifying.status = 'cancelled';
      await qualifying.save();
      await rebuildAllSeasonStandings(qualifying.season);
      await confirm.update({ content: `✅ **${qualifying.name}** was cancelled safely. Historical data was preserved.`, components: [] });
    } catch (error) {
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Operation timed out.', components: [] });
      else throw error;
    }
  },
};
