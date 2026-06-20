import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';

import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { User } from '../database/models/User.js';
import { getOrCreateSeasonStanding } from '../services/seasonStandingService.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { createQualifyingResultsEmbed } from '../utils/embeds.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('qualifyingresult')
    .setDescription('Enter qualifying results (Admin only)')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content:
          '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const sessions = await Qualifying.find({
      status: 'closed',
    });

    if (sessions.length === 0) {
      return interaction.reply({
        content:
          '❌ No qualifying sessions are awaiting results.',
        ephemeral: true,
      });
    }

    const sessionOptions = sessions.map(session => ({
      label: session.name,
      value: session._id.toString(),
    }));

    const sessionSelect = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('qualifying_session')
          .setPlaceholder(
            'Select qualifying session'
          )
          .addOptions(sessionOptions)
      );

    const response = await interaction.reply({
      content:
        '🏁 Select a qualifying session:',
      components: [sessionSelect],
      ephemeral: true,
    });

    try {
      const sessionInteraction =
        await response.awaitMessageComponent({
          componentType:
            ComponentType.StringSelect,
          time: 60000,
        });

      const qualifyingId =
        sessionInteraction.values[0];

      const qualifying = sessions.find(
        q => q._id.toString() === qualifyingId
      );

      const driverSelect =
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('pole_driver')
            .setPlaceholder(
              'Select Pole Position Driver'
            )
            .addOptions(
              getDriverSelectOptions()
            )
        );

      await sessionInteraction.update({
        content:
          `🏁 **${qualifying.name}**\n\n` +
          `🏆 Select the official Pole Position driver:`,
        components: [driverSelect],
      });

      const driverInteraction =
        await response.awaitMessageComponent({
          componentType:
            ComponentType.StringSelect,
          time: 60000,
        });

      const poleDriver =
        driverInteraction.values[0];

      const result =
        new QualifyingResult({
          qualifyingId,
          poleDriver,
        });

      await result.save();

      const predictions =
        await QualifyingPrediction.find({
          qualifyingId,
        });

      let correctPredictions = 0;

      for (const prediction of predictions) {
        const points =
  prediction.predictedDriver === poleDriver
    ? config.qualifyingScoring.correct
    : config.qualifyingScoring.incorrect;

        if (points === 5) {
          correctPredictions++;
        }

        prediction.pointsAwarded = points;
        await prediction.save();

        const user =
          await User.findOne({
            discordId:
              prediction.userId,
          });

        if (user) {
          user.totalPoints += points;

          if (points > 0) {
            user.pointsReachedAt =
              new Date();
          }

          await user.save();
        }
const standing =
  await getOrCreateSeasonStanding(
    prediction.userId,
    prediction.season
  );

standing.qualifyingPoints += points;
standing.totalPoints += points;

if (points > 0) {
  standing.correctPolePredictions += 1;
}

await standing.save();
      }

      qualifying.status = 'completed';
      await qualifying.save();

      try {
        const resultsChannel =
          await client.channels.fetch(
            config.channels.results
          );

        if (resultsChannel) {
          const embed =
            createQualifyingResultsEmbed(
              qualifying,
              result,
              correctPredictions,
              predictions.length
            );

          await resultsChannel.send({
            embeds: [embed],
          });
        }
      } catch (error) {
        console.error(
          'Failed to send results embed:',
          error
        );
      }

      await driverInteraction.update({
        content:
          `✅ Results processed successfully!\n\n` +
          `🏁 ${qualifying.name}\n` +
          `🏆 Pole Position: ${poleDriver}\n\n` +
          `🎯 Correct Predictions: ${correctPredictions}\n` +
          `📊 Total Predictions: ${predictions.length}`,
        components: [],
      });
    } catch (error) {
      if (
        error.code ===
        'InteractionCollectorError'
      ) {
        await interaction.editReply({
          content:
            '⏰ Selection timed out.',
          components: [],
        });
      } else {
        throw error;
      }
    }
  },
};