import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits } from 'discord.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { recalculateQualifyingScores, runInTransaction } from '../services/scoringService.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder().setName('recalculatequalifying').setDescription('Correct previously entered qualifying results (Admin only)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    const sessions = await Qualifying.find({ status: 'completed' }).sort({ sessionStartTime: -1 });
    if (!sessions.length) return interaction.reply({ content: '❌ No completed qualifying sessions are available.', ephemeral: true });
    const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qualifying_select').setPlaceholder('Select qualifying session').addOptions(sessions.slice(0, 25).map(q => ({ label: q.name, description: `Season ${q.season}`, value: String(q._id) }))));
    await interaction.reply({ content: '🔄 Select a qualifying session to correct:', components: [menu], ephemeral: true });
    const response = await interaction.fetchReply();
    try {
      const qI = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const qualifying = sessions.find(q => String(q._id) === qI.values[0]);
      const result = await QualifyingResult.findOne({ qualifyingId: qualifying._id });
      if (!result) return qI.update({ content: '❌ No result exists for this session.', components: [] });
      const menu2 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('pole').setPlaceholder('Select new pole driver').addOptions(getDriverSelectOptions()));
      await qI.update({ content: `🔄 **${qualifying.name}**\nCurrent pole: ${result.poleDriver}\n\nSelect the corrected pole driver:`, components: [menu2] });
      const poleI = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const poleDriver = poleI.values[0];
      await runInTransaction(async session => {
        result.poleDriver = poleDriver;
        result.updatedBy = interaction.user.id;
        await result.save({ session });
        await recalculateQualifyingScores(qualifying, result, { session });
      });
      await poleI.update({ content: `✅ **${qualifying.name}** recalculated successfully.\n\n🏆 Pole Position: ${poleDriver}\n\n📊 Season standings were reconciled.`, components: [] });
    } catch (error) {
      console.error(error);
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Selection timed out.', components: [] });
      else throw error;
    }
  },
};
