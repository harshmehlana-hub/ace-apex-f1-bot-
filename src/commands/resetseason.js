import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';

import { User } from '../database/models/User.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('resetseason')
    .setDescription('Start a new season while preserving historical data')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content:
          '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel('Start New Season')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      content:
        '⚠️ **SEASON ROLLOVER**\n\n' +
        'This will start a new season.\n\n' +
        '✅ Historical races will be preserved\n' +
        '✅ Historical predictions will be preserved\n' +
        '✅ Historical results will be preserved\n' +
        '✅ Historical qualifying data will be preserved\n' +
        '✅ Season standings will be preserved\n\n' +
        '⚠️ Current leaderboard points will be reset to zero.\n\n' +
        'Are you sure you want to continue?',
      components: [confirmRow],
      ephemeral: true,
    });

    try {
      const confirmInteraction =
        await response.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30000,
        });

      if (confirmInteraction.customId === 'cancel_reset') {
        return confirmInteraction.update({
          content: '❌ Season rollover cancelled.',
          components: [],
        });
      }

      const doubleConfirmRow =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('final_confirm')
            .setLabel('CONFIRM NEW SEASON')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('final_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

      await confirmInteraction.update({
        content:
          '🚨 **FINAL CONFIRMATION**\n\n' +
          'Historical data will be preserved.\n' +
          'Current leaderboard points will be reset.\n\n' +
          'Click CONFIRM NEW SEASON to proceed.',
        components: [doubleConfirmRow],
      });

      const finalInteraction =
        await response.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 15000,
        });

      if (finalInteraction.customId === 'final_cancel') {
        return finalInteraction.update({
          content: '❌ Season rollover cancelled.',
          components: [],
        });
      }

      await User.updateMany(
        {},
        {
          totalPoints: 0,
          perfectPredictions: 0,
          pointsReachedAt: new Date(),
        }
      );

      await finalInteraction.update({
        content:
          '✅ **New season started successfully.**\n\n' +
          'Historical data has been preserved.\n' +
          'Leaderboard points have been reset for the new season.',
        components: [],
      });

    } catch (error) {
      if (
        error.code === 'InteractionCollectorError'
      ) {
        await interaction.editReply({
          content:
            '⏰ Confirmation timed out. Season rollover cancelled.',
          components: [],
        });
      } else {
        throw error;
      }
    }
  },
};