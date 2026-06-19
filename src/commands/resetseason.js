import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Prediction } from '../database/models/Prediction.js';
import { Result } from '../database/models/Result.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';
import { QualifyingResult } from '../database/models/QualifyingResult.js';
import { User } from '../database/models/User.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';


export default {
  data: new SlashCommandBuilder()
    .setName('resetseason')
    .setDescription('Reset all season data and start fresh (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }
    
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel('Yes, Reset Everything')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
    
    const response = await interaction.reply({
      content: '⚠️ **DANGER: Season Reset**\n\n' +
        'This will **permanently delete**:\n' +
        '• All races\n' +
        '• All race predictions\n' +
        '• All race results\n' +
        '• All qualifying sessions\n' +
        '• All qualifying predictions\n' +
        '• All qualifying results\n' +
        '• All user points and rankings\n' +
        '• All perfect prediction counts\n\n' +
        '**This action cannot be undone!**\n\n' +
        'Are you absolutely sure?',
      components: [confirmRow],
      ephemeral: true,
    });
    
    try {
      const confirmInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 30000,
      });
      
      if (confirmInteraction.customId === 'cancel_reset') {
        return confirmInteraction.update({
          content: '❌ Season reset cancelled.',
          components: [],
        });
      }
      
      // Double confirmation
      const doubleConfirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('final_confirm')
          .setLabel('CONFIRM RESET')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('final_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
      
      await confirmInteraction.update({
        content: '🚨 **FINAL CONFIRMATION**\n\nType of reset: **FULL SEASON RESET**\n\nClick CONFIRM RESET to proceed.',
        components: [doubleConfirmRow],
      });
      
      const finalInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 15000,
      });
      
      if (finalInteraction.customId === 'final_cancel') {
        return finalInteraction.update({
          content: '❌ Season reset cancelled.',
          components: [],
        });
      }
      
      // Perform reset
// Perform reset
await Prediction.deleteMany({});
await Result.deleteMany({});
await Race.deleteMany({});

await QualifyingPrediction.deleteMany({});
await QualifyingResult.deleteMany({});
await Qualifying.deleteMany({});

await User.updateMany(
  {},
  {
    totalPoints: 0,
    perfectPredictions: 0,
    pointsReachedAt: new Date(),
  }
);      
      await finalInteraction.update({
        content: '✅ **Season has been reset.**\n\n' +
          'All races, qualifying, predictions, results, and scores have been cleared.\n' +
          'User accounts have been preserved with zero points.',
        components: [],
      });
      
    } catch (error) {
      if (error.code === 'InteractionCollectorError') {
        await interaction.editReply({
          content: '⏰ Confirmation timed out. Reset cancelled.',
          components: [],
        });
      } else {
        throw error;
      }
    }
  },
};
