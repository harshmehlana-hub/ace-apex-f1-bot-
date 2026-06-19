import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';

import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deletequalifying')
    .setDescription('Delete a qualifying session (Admin only)')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission.',
        ephemeral: true,
      });
    }

    const sessions = await Qualifying.find().sort({
      sessionStartTime: -1,
    });

    if (sessions.length === 0) {
      return interaction.reply({
        content: '❌ No qualifying sessions found.',
        ephemeral: true,
      });
    }

    const options = sessions.map(session => ({
      label: session.name,
      value: session._id.toString(),
    }));

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('delete_qualifying')
        .setPlaceholder(
          'Select qualifying session to delete'
        )
        .addOptions(options)
    );

    const response = await interaction.reply({
      content:
        '⚠️ Select a qualifying session to permanently delete:',
      components: [selectMenu],
      ephemeral: true,
    });

    try {
      const selectInteraction =
        await response.awaitMessageComponent({
          componentType:
            ComponentType.StringSelect,
          time: 60000,
        });

      const qualifyingId =
        selectInteraction.values[0];

      const qualifying =
        await Qualifying.findById(
          qualifyingId
        );

      if (!qualifying) {
        return selectInteraction.update({
          content:
            '❌ Qualifying session not found.',
          components: [],
        });
      }

      await QualifyingPrediction.deleteMany({
        qualifyingId,
      });

      await QualifyingResult.deleteMany({
        qualifyingId,
      });

      await Qualifying.findByIdAndDelete(
        qualifyingId
      );

      await selectInteraction.update({
        content:
          `✅ Deleted qualifying session:\n\n` +
          `🏁 ${qualifying.name}\n\n` +
          `All associated predictions and results have been removed.`,
        components: [],
      });
    } catch (error) {
      if (
        error.code ===
        'InteractionCollectorError'
      ) {
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