import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Result } from '../database/models/Result.js';
import { recalculateRaceScores, runInTransaction } from '../services/scoringService.js';
import { reconcilePredictorOfTheWeekRoles } from '../services/roleService.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { rebuildAllSeasonStandings } from '../services/seasonStandingService.js';

export default {
  data: new SlashCommandBuilder().setName('recalculateresults').setDescription('Correct previously entered race results (Admin only)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    const races = await Race.find({ status: 'completed' }).sort({ raceStartTime: -1 });
    if (!races.length) return interaction.reply({ content: '❌ No completed races are available.', ephemeral: true });
    const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('race_select').setPlaceholder('Select race').addOptions(races.slice(0, 25).map(r => ({ label: r.name, description: `Season ${r.season}`, value: String(r._id) }))));
    await interaction.reply({ content: '🔄 Select a race to correct:', components: [menu], ephemeral: true });
    const response = await interaction.fetchReply();

    try {
      const raceI = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 });
      const race = races.find(r => String(r._id) === raceI.values[0]);
      const oldResult = await Result.findOne({ raceId: race._id });
      if (!oldResult) return raceI.update({ content: '❌ No result exists for this race.', components: [] });
      const drivers = getDriverSelectOptions();
      const menuFor = (id, placeholder, excluded = []) => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(drivers.filter(d => !excluded.includes(d.value))));
      await raceI.update({ content: `🔄 **${race.name}**\nCurrent: ${oldResult.p1Driver} / ${oldResult.p2Driver} / ${oldResult.p3Driver}\n\nSelect new P1`, components: [menuFor('p1', 'New P1')] });
      const p1I = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 }); const p1 = p1I.values[0];
      await p1I.update({ content: `🥇 P1: ${p1}\n\nSelect new P2`, components: [menuFor('p2', 'New P2', [p1])] });
      const p2I = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 }); const p2 = p2I.values[0];
      await p2I.update({ content: `🥇 P1: ${p1}\n🥈 P2: ${p2}\n\nSelect new P3`, components: [menuFor('p3', 'New P3', [p1, p2])] });
      const p3I = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60000 }); const p3 = p3I.values[0];
      const newResult = { p1Driver: p1, p2Driver: p2, p3Driver: p3 };
      await p3I.deferUpdate();

      const { scores, topIds } = await runInTransaction(async session => {
        oldResult.p1Driver = p1; oldResult.p2Driver = p2; oldResult.p3Driver = p3; oldResult.updatedBy = interaction.user.id; oldResult.enteredAt = new Date();
        await oldResult.save({ session });
        const recalculated = await recalculateRaceScores(race, oldResult, newResult, { session });
        const recalculatedTopIds = recalculated.slice(0, 5).map(s => s.userId);
        await Race.updateOne(
          { _id: race._id, status: 'completed' },
          { $set: { predictorOfTheWeekIds: recalculatedTopIds } },
          { session }
        );
        return { scores: recalculated, topIds: recalculatedTopIds };
      });

      await rebuildAllSeasonStandings(race.season);
      await reconcilePredictorOfTheWeekRoles(interaction.guild, race.season, topIds);

      await p3I.editReply({ content: `✅ **${race.name}** recalculated successfully.\n\n🥇 P1: ${p1}\n🥈 P2: ${p2}\n🥉 P3: ${p3}\n\n📊 All season standings and Predictor of the Week roles were reconciled.`, components: [] });
    } catch (error) {
      console.error(error);
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⏰ Selection timed out.', components: [] });
      else throw error;
    }
  },
};
