import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';

import { Race } from '../database/models/Race.js';
import { Result } from '../database/models/Result.js';

import { processRaceResults } from '../services/scoringService.js';
import { updatePredictorOfTheWeekRole } from '../services/roleService.js';

import { getDriverSelectOptions } from '../utils/drivers.js';
import { createResultsEmbed } from '../utils/embeds.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('results')
    .setDescription('Enter official race results')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const closedRaces = await Race.find({ status: 'closed' });

    if (closedRaces.length === 0) {
      return interaction.reply({
        content: '❌ There are no races awaiting results.',
        ephemeral: true,
      });
    }

    const raceOptions = closedRaces.map(race => ({
      label: race.name,
      value: race._id.toString(),
    }));

    const raceMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('race_select')
        .setPlaceholder('Select race')
        .addOptions(raceOptions)
    );

    await interaction.reply({
      content: '🏁 Select a race:',
      components: [raceMenu],
      ephemeral: true,
    });

    const response = await interaction.fetchReply();

    try {
      const raceInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const raceId = raceInteraction.values[0];
      const race = closedRaces.find(
        r => r._id.toString() === raceId
      );

      const driverOptions = getDriverSelectOptions();

      // P1
      const p1Menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p1')
          .setPlaceholder('Select Official P1')
          .addOptions(driverOptions)
      );

      await raceInteraction.update({
        content: `🏁 ${race.name}\n\n🥇 Select Official P1`,
        components: [p1Menu],
      });

      const p1Interaction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const p1Driver = p1Interaction.values[0];

      // P2
      const p2Menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p2')
          .setPlaceholder('Select Official P2')
          .addOptions(
            driverOptions.filter(
              d => d.value !== p1Driver
            )
          )
      );

      await p1Interaction.update({
        content:
          `🏁 ${race.name}\n\n` +
          `🥇 P1: ${p1Driver}\n\n` +
          `🥈 Select Official P2`,
        components: [p2Menu],
      });

      const p2Interaction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const p2Driver = p2Interaction.values[0];

      // P3
      const p3Menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p3')
          .setPlaceholder('Select Official P3')
          .addOptions(
            driverOptions.filter(
              d =>
                d.value !== p1Driver &&
                d.value !== p2Driver
            )
          )
      );

      await p2Interaction.update({
        content:
          `🏁 ${race.name}\n\n` +
          `🥇 P1: ${p1Driver}\n` +
          `🥈 P2: ${p2Driver}\n\n` +
          `🥉 Select Official P3`,
        components: [p3Menu],
      });

      const p3Interaction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const p3Driver = p3Interaction.values[0];

      const result = await Result.create({
        raceId,
        p1Driver,
        p2Driver,
        p3Driver,
      });

      const scores = await processRaceResults(
        raceId,
        result
      );

      race.status = 'completed';
      await race.save();

      const topPredictorIds = scores
        .slice(0, 5)
        .map(s => s.userId);

      await updatePredictorOfTheWeekRole(
        interaction.guild,
        topPredictorIds
      );

      try {
        const resultsChannel = await client.channels.fetch(
          config.channels.results
        );

        if (resultsChannel) {
          const embed = createResultsEmbed(
            race,
            result,
            scores
          );

          await resultsChannel.send({
            embeds: [embed],
          });
        }
      } catch (err) {
        console.error(err);
      }

      await p3Interaction.update({
        content:
          `✅ Results processed successfully!\n\n` +
          `🏁 ${race.name}\n` +
          `🥇 P1: ${p1Driver}\n` +
          `🥈 P2: ${p2Driver}\n` +
          `🥉 P3: ${p3Driver}\n\n` +
          `📊 ${scores.length} predictions scored.`,
        components: [],
      });

    } catch (error) {
      console.error(error);

      try {
        await interaction.editReply({
          content: '⏰ Results entry timed out.',
          components: [],
        });
      } catch {}
    }
  },
};