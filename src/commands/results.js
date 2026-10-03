import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Result } from '../database/models/Result.js';
import { processRaceResults, runInTransaction } from '../services/scoringService.js';
import { reconcilePredictorOfTheWeekRoles } from '../services/roleService.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { createResultsEmbed } from '../utils/embeds.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder().setName('results').setDescription('Enter official race results').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    const closedRaces = await Race.find({ status: 'closed' }).sort({ raceStartTime: 1 });
    if (!closedRaces.length) return interaction.reply({ content: '❌ There are no races awaiting results.', ephemeral: true });

    const raceMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('race_select').setPlaceholder('Select race').addOptions(closedRaces.slice(0, 25).map(r => ({ label: r.name, description: `Season ${r.season}`, value: String(r._id) }))));
    await interaction.reply({ content: '🏁 Select a race:', components: [raceMenu], ephemeral: true });
    const response = await interaction.fetchReply();

    try {
      const raceInteraction = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const race = closedRaces.find(r => String(r._id) === raceInteraction.values[0]);
      if (!race) return raceInteraction.update({ content: '❌ Race not found.', components: [] });
      if (await Result.exists({ raceId: race._id })) return raceInteraction.update({ content: '❌ This race already has a result. Use `/recalculateresults` to correct it.', components: [] });

      const drivers = getDriverSelectOptions();
      const makeMenu = (id, placeholder, excluded = []) => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(drivers.filter(d => !excluded.includes(d.value))));
      await raceInteraction.update({ content: `🏁 ${race.name}\n\n🥇 Select Official P1`, components: [makeMenu('p1', 'Select Official P1')] });
      const p1I = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const p1 = p1I.values[0];
      await p1I.update({ content: `🏁 ${race.name}\n🥇 P1: ${p1}\n\n🥈 Select Official P2`, components: [makeMenu('p2', 'Select Official P2', [p1])] });
      const p2I = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const p2 = p2I.values[0];
      await p2I.update({ content: `🏁 ${race.name}\n🥇 P1: ${p1}\n🥈 P2: ${p2}\n\n🥉 Select Official P3`, components: [makeMenu('p3', 'Select Official P3', [p1, p2])] });
      const p3I = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const p3 = p3I.values[0];

      const resultData = { p1Driver: p1, p2Driver: p2, p3Driver: p3 };
      const scores = await runInTransaction(async session => {
        const result = await Result.create([{ raceId: race._id, ...resultData, enteredBy: interaction.user.id }], { session });
        const created = result[0];

        // Mark the event completed BEFORE rebuilding standings. The standings
        // rebuild intentionally only counts completed events.
        const statusUpdate = await Race.updateOne(
          { _id: race._id, status: 'closed' },
          { $set: { status: 'completed' } },
          { session }
        );
        if (statusUpdate.modifiedCount !== 1) {
          throw new Error('Race status changed before result processing could complete.');
        }

        const scored = await processRaceResults(race, created, { session });
        const topPredictorIds = scored.slice(0, 5).map(s => s.userId);
        await Race.updateOne(
          { _id: race._id },
          { $set: { predictorOfTheWeekIds: topPredictorIds } },
          { session }
        );
        return scored;
      });

      const topPredictorIds = scores.slice(0, 5).map(s => s.userId);
      await reconcilePredictorOfTheWeekRoles(interaction.guild, race.season, topPredictorIds);

      try {
        const resultsChannel = await client.channels.fetch(config.channels.results);
        if (resultsChannel) await resultsChannel.send({ content: '@everyone 🏎️ Race Results are OUT!', embeds: [createResultsEmbed(race, { ...resultData }, scores)] });
      } catch (error) { console.error('Failed to publish race results:', error); }

      await p3I.update({ content: `✅ Results processed successfully!\n\n🏁 ${race.name}\n🥇 P1: ${p1}\n🥈 P2: ${p2}\n🥉 P3: ${p3}\n\n📊 ${scores.length} predictions scored.`, components: [] });
    } catch (error) {
      console.error(error);
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Results entry timed out.', components: [] });
      else if (!interaction.replied) await interaction.reply({ content: '❌ Failed to process the result. No partial score should have been committed.', ephemeral: true }).catch(() => {});
    }
  },
};
