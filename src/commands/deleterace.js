import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { rebuildAllSeasonStandings } from '../services/seasonStandingService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deleterace')
    .setDescription('Cancel a race safely (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    const races = await Race.find({ status: { $ne: 'cancelled' } }).sort({ raceStartTime: -1 });
    if (!races.length) return interaction.reply({ content: '❌ There are no races to cancel.', ephemeral: true });

    const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('race_select').setPlaceholder('Select race').addOptions(races.slice(0, 25).map(r => ({ label: r.name, description: `Season ${r.season} • ${r.status}`, value: String(r._id) }))));
    const response = await interaction.reply({ content: '⚠️ Select a race to cancel. Completed races cannot be deleted or cancelled.', components: [menu], ephemeral: true });
    try {
      const selected = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const race = races.find(r => String(r._id) === selected.values[0]);
      if (!race) return selected.update({ content: '❌ Race not found.', components: [] });
      if (race.status === 'completed') return selected.update({ content: '❌ Completed races are locked. Use `/recalculateresults` to correct their result instead.', components: [] });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_delete').setLabel('Cancel Race').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_delete').setLabel('Keep Race').setStyle(ButtonStyle.Secondary)
      );
      await selected.update({ content: `⚠️ **Cancel ${race.name}?**\n\nThe race and its predictions will remain in the database for audit/history, but it will never accept predictions or receive a result.`, components: [buttons] });
      const confirm = await response.awaitMessageComponent({ componentType: ComponentType.Button, time: 30000 });
      if (confirm.customId === 'cancel_delete') return confirm.update({ content: '❌ Cancellation aborted.', components: [] });
      race.status = 'cancelled';
      await race.save();
      await rebuildAllSeasonStandings(race.season);
      await confirm.update({ content: `✅ **${race.name}** was cancelled safely. Historical data was preserved.`, components: [] });
    } catch (error) {
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Operation timed out.', components: [] });
      else throw error;
    }
  },
};
