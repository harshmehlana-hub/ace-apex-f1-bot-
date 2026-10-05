import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';

import { Race } from '../database/models/Race.js';
import { Prediction } from '../database/models/Prediction.js';
import { User } from '../database/models/User.js';
import { getOrCreateSeasonStanding } from '../services/seasonStandingService.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { validatePodiumSelection } from '../utils/validators.js';
import { config } from '../config.js';
import { getCurrentSeason } from '../services/seasonService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Submit your podium prediction'),

  async execute(interaction, client) {
    const activeSeason = await getCurrentSeason();
    const openRaces = await Race.find({ season: activeSeason, status: 'open' }).sort({ raceStartTime: 1 }).limit(25);

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
      const race = await Race.findOne({ _id: raceId, season: activeSeason });
      if (!race || race.status !== 'open' || new Date() < race.predictionOpenTime || new Date() >= race.predictionCloseTime) {
        return raceInteraction.update({ content: '❌ Predictions for this race are no longer open.', components: [] });
      }

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

      const finalCheck = await Race.findOne({
        _id: race._id,
        season: activeSeason,
        status: 'open',
        predictionOpenTime: { $lte: new Date() },
        predictionCloseTime: { $gt: new Date() },
      });
      if (!finalCheck) {
        return p3Interaction.update({
          content: '❌ Predictions for this race have closed. Your prediction was not submitted.',
          components: [],
        });
      }

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
        season: race.season,
        p1Driver,
        p2Driver,
        p3Driver,
        submittedAt: new Date(),
      });

const standing = await getOrCreateSeasonStanding(interaction.user.id, race.season);
standing.racePredictionsSubmitted += 1;
await standing.save();
      await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        {
          $set: {
            username: interaction.user.username,
          },
          $setOnInsert: {
            discordId: interaction.user.id,
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