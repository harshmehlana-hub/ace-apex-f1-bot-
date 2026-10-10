import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { getCurrentSeason, startNewSeason } from '../services/seasonService.js';
import { getSeasonCalendar } from '../config/seasonCalendar2026.js';

export default {
  data: new SlashCommandBuilder()
    .setName('resetseason')
    .setDescription('Switch the bot to a new season without modifying historical data')
    .addStringOption(option => option.setName('season').setDescription('New season year (e.g. 2027)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const newSeason = interaction.options.getString('season').trim();
    if (!/^\d{4}$/.test(newSeason)) {
      return interaction.reply({ content: '❌ Season must be a four-digit year.', ephemeral: true });
    }
    if (getSeasonCalendar(newSeason).length === 0) {
      return interaction.reply({
        content: `❌ Season **${newSeason}** has no configured F1 calendar yet. Add the season calendar before switching the active season.`,
        ephemeral: true,
      });
    }

    const currentSeason = await getCurrentSeason();
    if (newSeason === currentSeason) {
      return interaction.reply({ content: `❌ ${newSeason} is already the active season.`, ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_reset').setLabel('Switch Season').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_reset').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
    const response = await interaction.reply({
      content: `⚠️ **SEASON SWITCH**\n\nCurrent season: **${currentSeason}**\nNew season: **${newSeason}**\n\nHistorical races, predictions, results and standings will remain untouched. New predictions and leaderboards will use ${newSeason}.\n\nContinue?`,
      components: [row], ephemeral: true,
    });

    try {
      const confirm = await response.awaitMessageComponent({ componentType: ComponentType.Button, time: 30000 });
      if (confirm.customId === 'cancel_reset') return confirm.update({ content: '❌ Season switch cancelled.', components: [] });

      const finalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('final_confirm').setLabel('CONFIRM SEASON SWITCH').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('final_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );
      await confirm.update({ content: `🚨 **FINAL CONFIRMATION**\n\nSwitch active season from **${currentSeason}** to **${newSeason}**?`, components: [finalRow] });
      const final = await response.awaitMessageComponent({ componentType: ComponentType.Button, time: 15000 });
      if (final.customId === 'final_cancel') return final.update({ content: '❌ Season switch cancelled.', components: [] });

      await startNewSeason(newSeason);
      await final.update({ content: `✅ **Season ${newSeason} is now active.**\n\nHistorical season data was not reset or deleted.`, components: [] });
    } catch (error) {
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Confirmation timed out. Season switch cancelled.', components: [] });
      else throw error;
    }
  },
};
