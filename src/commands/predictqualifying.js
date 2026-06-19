import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { User } from '../database/models/User.js';
import { getDriverSelectOptions } from '../utils/drivers.js';
import { config } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('predictqualifying')
    .setDescription('Predict the Pole Position winner'),

  async execute(interaction, client) {
    const openSessions = await Qualifying.find({
      status: 'open',
    });

    if (openSessions.length === 0) {
      return interaction.reply({
        content:
          '❌ There are currently no qualifying sessions open for predictions.',
        ephemeral: true,
      });
    }

    const sessionOptions = openSessions.map(session => ({
      label: session.name,
      description: `Closes: ${session.predictionCloseTime.toUTCString()}`,
      value: session._id.toString(),
    }));

    const sessionSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('qualifying_select')
        .setPlaceholder('Select a qualifying session')
        .addOptions(sessionOptions)
    );

    const response = await interaction.reply({
      content: '🏁 **Select a qualifying session:**',
      components: [sessionSelect],
      ephemeral: true,
    });

    try {
      const sessionInteraction =
        await response.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          time: 60000,
        });

      const qualifyingId = sessionInteraction.values[0];

      const selectedSession = openSessions.find(
        q => q._id.toString() === qualifyingId
      );

      const existingPrediction =
        await QualifyingPrediction.findOne({
          userId: interaction.user.id,
          qualifyingId,
        });

      if (existingPrediction) {
        return sessionInteraction.update({
          content:
            '❌ You have already submitted a qualifying prediction for this session.',
          components: [],
        });
      }

      const driverOptions = getDriverSelectOptions();

      const driverSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pole_prediction')
          .setPlaceholder('Select Pole Position Driver')
          .addOptions(driverOptions)
      );

      await sessionInteraction.update({
        content:
          `🏁 **${selectedSession.name}**\n\n` +
          `🏆 Select your **Pole Position prediction:**`,
        components: [driverSelect],
      });

      const driverInteraction =
        await response.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          time: 60000,
        });

      const predictedDriver = driverInteraction.values[0];

      const doubleCheck =
        await QualifyingPrediction.findOne({
          userId: interaction.user.id,
          qualifyingId,
        });

      if (doubleCheck) {
        return driverInteraction.update({
          content:
            '❌ You have already submitted a prediction.',
          components: [],
        });
      }

      const prediction = new QualifyingPrediction({
        userId: interaction.user.id,
        qualifyingId,
        predictedDriver,
        submittedAt: new Date(),
      });

      await prediction.save();

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
        const logsChannel =
          await client.channels.fetch(
            config.channels.logs
          );

        if (logsChannel) {
          await logsChannel.send(
            `🏁 <@${interaction.user.id}> submitted a qualifying prediction for **${selectedSession.name}**.`
          );
        }
      } catch (error) {
        console.error(
          'Failed to send log message:',
          error
        );
      }

      await driverInteraction.update({
        content:
          `✅ **Pole prediction submitted!**\n\n` +
          `🏁 **${selectedSession.name}**\n` +
          `🏆 Pole Position: **${predictedDriver}**`,
        components: [],
      });
    } catch (error) {
      if (
        error.code === 'InteractionCollectorError'
      ) {
        await interaction.editReply({
          content:
            '⏰ Selection timed out. Please try again.',
          components: [],
        });
      } else {
        throw error;
      }
    }
  },
};