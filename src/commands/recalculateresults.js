import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Result } from '../database/models/Result.js';
import { recalculateRaceScores } from '../services/scoringService.js';
import { getDriverSelectOptions, getDriverByCode } from '../utils/drivers.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('recalculateresults')
    .setDescription('Correct previously entered results (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }
    
    // Find completed races with results
    const completedRaces = await Race.find({ status: 'completed' });
    
    if (completedRaces.length === 0) {
      return interaction.reply({
        content: '❌ There are no completed races to recalculate.',
        ephemeral: true,
      });
    }
    
    const raceOptions = completedRaces.map(race => ({
      label: race.name,
      value: race._id.toString(),
    }));
    
    const raceSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('race_select')
        .setPlaceholder('Select race to recalculate')
        .addOptions(raceOptions)
    );
    
    const response = await interaction.reply({
      content: '🔄 **Select race to recalculate results:**',
      components: [raceSelect],
      ephemeral: true,
    });
    
    try {
      const raceInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });
      
      const selectedRaceId = raceInteraction.values[0];
      const selectedRace = completedRaces.find(r => r._id.toString() === selectedRaceId);
      
      // Get old result
      const oldResult = await Result.findOne({ raceId: selectedRaceId });
      if (!oldResult) {
        return raceInteraction.update({
          content: '❌ No existing results found for this race.',
          components: [],
        });
      }
      
      const driverOptions = getDriverSelectOptions();
      
      // Show current results and get new P1
      const p1Select = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p1_result')
          .setPlaceholder('New P1 (Winner)')
          .addOptions(driverOptions)
      );
      
      await raceInteraction.update({
        content: `🔄 **Recalculate: ${selectedRace.name}**\n\n` +
          `Current Results:\n` +
          `🥇 P1: ${oldResult.p1Driver}\n` +
          `🥈 P2: ${oldResult.p2Driver}\n` +
          `🥉 P3: ${oldResult.p3Driver}\n\n` +
          `Select **new P1 (Winner):**`,
        components: [p1Select],
      });
      
      const p1Interaction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });
      
      const p1Driver = p1Interaction.values[0];
      
      // P2 Selection
      const p2Options = driverOptions.filter(d => d.value !== p1Driver);
      const p2Select = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p2_result')
          .setPlaceholder('New P2 (Second)')
          .addOptions(p2Options)
      );
      
      await p1Interaction.update({
        content: `🔄 **Recalculate: ${selectedRace.name}**\n\n🥇 P1: **${getDriverByCode(p1Driver).name}**\n🥈 Select **new P2:**`,
        components: [p2Select],
      });
      
      const p2Interaction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });
      
      const p2Driver = p2Interaction.values[0];
      
      // P3 Selection
      const p3Options = driverOptions.filter(d => d.value !== p1Driver && d.value !== p2Driver);
      const p3Select = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p3_result')
          .setPlaceholder('New P3 (Third)')
          .addOptions(p3Options)
      );
      
      await p2Interaction.update({
        content: `🔄 **Recalculate: ${selectedRace.name}**\n\n🥇 P1: **${getDriverByCode(p1Driver).name}**\n🥈 P2: **${getDriverByCode(p2Driver).name}**\n🥉 Select **new P3:**`,
        components: [p3Select],
      });
      
      const p3Interaction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });
      
      const p3Driver = p3Interaction.values[0];
      
      // Create new result object
      const newResult = {
        p1Driver: getDriverByCode(p1Driver).name,
        p2Driver: getDriverByCode(p2Driver).name,
        p3Driver: getDriverByCode(p3Driver).name,
      };
      
      // Recalculate scores
      await recalculateRaceScores(selectedRaceId, oldResult, newResult);
      
      // Update result in database
      oldResult.p1Driver = newResult.p1Driver;
      oldResult.p2Driver = newResult.p2Driver;
      oldResult.p3Driver = newResult.p3Driver;
      oldResult.enteredAt = new Date();
      await oldResult.save();
      
      await p3Interaction.update({
        content: `✅ **Results recalculated successfully!**\n\n` +
          `🏁 **${selectedRace.name}**\n` +
          `🥇 P1: ${newResult.p1Driver}\n` +
          `🥈 P2: ${newResult.p2Driver}\n` +
          `🥉 P3: ${newResult.p3Driver}\n\n` +
          `📊 All scores and leaderboard have been updated.`,
        components: [],
      });
      
    } catch (error) {
      if (error.code === 'InteractionCollectorError') {
        await interaction.editReply({
          content: '⏰ Selection timed out.',
          components: [],
        });
      } else {
        throw error;
      }
    }
  },
};
