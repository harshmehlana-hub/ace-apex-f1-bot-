import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';

import { Race } from '../database/models/Race.js';
import { Prediction } from '../database/models/Prediction.js';
import { User } from '../database/models/User.js';

import { getDriverSelectOptions } from '../utils/drivers.js';
import { validatePodiumSelection } from '../utils/validators.js';
import { config } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Submit your podium prediction'),

  async execute(interaction, client) {
    const openRaces = await Race.find({ status: 'open' });

    if (openRaces.length === 0) {
      return interaction.reply({
        content: '❌ There are no races currently open for predictions.',
        ephemeral: true,
      });
    }

    const raceOptions = openRaces.map(race => ({
      label: race.name,
      value: race._id.toString(),
      description: `Closes soon`,
    }));

    const raceMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('race_select')
        .setPlaceholder('Select a race')
        .addOptions(raceOptions)
    );

    await interaction.reply({
      content: '🏁 Select a race:',
      components: [raceMenu],
      ephemeral: true,
    });

    const raceResponse = await interaction.fetchReply();

    try {
      const raceInteraction = await raceResponse.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const raceId = raceInteraction.values[0];
      const race = await Race.findById(raceId);

      const existingPrediction = await Prediction.findOne({
        userId: interaction.user.id,
        raceId,
      });

      if (existingPrediction) {
        return raceInteraction.update({
          content:
            '❌ You have already submitted a prediction for this race. Predictions cannot be modified once submitted.',
          components: [],
        });
      }

      const driverOptions = getDriverSelectOptions();

      // P1
      const p1Menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p1')
          .setPlaceholder('Select P1')
          .addOptions(driverOptions)
      );

      await raceInteraction.update({
        content: '🥇 Select P1',
        components: [p1Menu],
      });

      const p1Interaction = await raceResponse.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const p1Driver = p1Interaction.values[0];

      // P2
      const p2Menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p2')
          .setPlaceholder('Select P2')
          .addOptions(
            driverOptions.filter(d => d.value !== p1Driver)
          )
      );

      await p1Interaction.update({
        content: `🥇 P1: ${p1Driver}\n\n🥈 Select P2`,
        components: [p2Menu],
      });

      const p2Interaction = await raceResponse.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const p2Driver = p2Interaction.values[0];

      // P3
      const p3Menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('p3')
          .setPlaceholder('Select P3')
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
          `🥇 P1: ${p1Driver}\n` +
          `🥈 P2: ${p2Driver}\n\n` +
          `🥉 Select P3`,
        components: [p3Menu],
      });

      const p3Interaction = await raceResponse.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const p3Driver = p3Interaction.values[0];

      const validation = validatePodiumSelection(
        p1Driver,
        p2Driver,
        p3Driver
      );

      if (!validation.valid) {
        return p3Interaction.update({
          content: `❌ ${validation.errors.join('\n')}`,
          components: [],
        });
      }

      await Prediction.create({
        userId: interaction.user.id,
        raceId,
        p1Driver,
        p2Driver,
        p3Driver,
        submittedAt: new Date(),
      });

      await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        {
          $setOnInsert: {
            discordId: interaction.user.id,
            username: interaction.user.username,
            totalPoints: 0,
            perfectPredictions: 0,
            pointsReachedAt: new Date(),
          },
        },
        { upsert: true }
      );

      try {
        const logsChannel = await client.channels.fetch(
          config.channels.logs
        );

        if (logsChannel) {
          await logsChannel.send(
            ` <@${interaction.user.id}> just submitted their prediction for **${race.name}**.`
          );
        }
      } catch (err) {
        console.error(err);
      }

      await p3Interaction.update({
        content:
          `✅ Prediction submitted successfully.\n\n` +
          `🥇 P1: ${p1Driver}\n` +
          `🥈 P2: ${p2Driver}\n` +
          `🥉 P3: ${p3Driver}`,
        components: [],
      });

    } catch (error) {
      console.error(error);

      try {
        await interaction.editReply({
          content: '⏰ Prediction timed out.',
          components: [],
        });
      } catch {}
    }
  },
};