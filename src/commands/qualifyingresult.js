import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits } from 'discord.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { processQualifyingResults, runInTransaction } from '../services/scoringService.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { createQualifyingResultsEmbed } from '../utils/embeds.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder().setName('qualifyingresult').setDescription('Enter qualifying results (Admin only)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    const sessions = await Qualifying.find({ status: 'closed' }).sort({ sessionStartTime: 1 });
    if (!sessions.length) return interaction.reply({ content: '❌ No qualifying sessions are awaiting results.', ephemeral: true });
    const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qualifying_session').setPlaceholder('Select qualifying session').addOptions(sessions.slice(0, 25).map(q => ({ label: q.name, description: `Season ${q.season}`, value: String(q._id) }))));
    await interaction.reply({ content: '🏁 Select a qualifying session:', components: [menu], ephemeral: true });
    const response = await interaction.fetchReply();
    try {
      const qI = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const qualifying = sessions.find(q => String(q._id) === qI.values[0]);
      if (await QualifyingResult.exists({ qualifyingId: qualifying._id })) return qI.update({ content: '❌ This session already has a result. Use `/recalculatequalifying` to correct it.', components: [] });
      const poleMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('pole_driver').setPlaceholder('Select Pole Position Driver').addOptions(getDriverSelectOptions()));
      await qI.update({ content: `🏁 **${qualifying.name}**\n\n🏆 Select the official Pole Position driver:`, components: [poleMenu] });
      const poleI = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const poleDriver = poleI.values[0];

      const { predictions, correctPredictions } = await runInTransaction(async session => {
        const docs = await QualifyingResult.create([{ qualifyingId: qualifying._id, poleDriver, enteredBy: interaction.user.id }], { session });

        // Mark the session completed BEFORE rebuilding standings so the current
        // qualifying event is included in the completed-event set.
        const statusUpdate = await Qualifying.updateOne(
          { _id: qualifying._id, status: 'closed' },
          { $set: { status: 'completed' } },
          { session }
        );
        if (statusUpdate.modifiedCount !== 1) {
          throw new Error('Qualifying status changed before result processing could complete.');
        }

        const scored = await processQualifyingResults(qualifying, docs[0], { session });
        return { predictions: scored, correctPredictions: scored.filter(s => s.pointsAwarded === config.qualifyingScoring.correct).length };
      });

      try {
        const resultsChannel = await client.channels.fetch(config.channels.results);
        if (resultsChannel) await resultsChannel.send({ content: '@everyone 🏁 Qualifying Results are OUT!', embeds: [createQualifyingResultsEmbed(qualifying, { poleDriver }, correctPredictions, predictions.length)] });
      } catch (error) { console.error('Failed to publish qualifying results:', error); }
      await poleI.update({ content: `✅ Results processed successfully!\n\n🏁 ${qualifying.name}\n🏆 Pole Position: ${poleDriver}\n\n🎯 Correct Predictions: ${correctPredictions}\n📊 Total Predictions: ${predictions.length}`, components: [] });
    } catch (error) {
      console.error(error);
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Selection timed out.', components: [] });
      else throw error;
    }
  },
};
