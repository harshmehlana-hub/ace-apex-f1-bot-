import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { Reminder } from '../database/models/Reminder.js';
import { config } from '../config.js';
import { isAdmin, parseISTDateTime } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Create a reminder (Admin only)')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Reminder message')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('DD-MM-YYYY')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('HH:MM (IST)')
        .setRequired(true)
    )
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

    const message = interaction.options.getString('message');
    const dateStr = interaction.options.getString('date');
    const timeStr = interaction.options.getString('time');
    const remindAt = parseISTDateTime(dateStr, timeStr);

    if (!remindAt || remindAt <= new Date()) {
      return interaction.reply({
        content: '❌ Invalid date/time or the reminder time is in the past.',
        ephemeral: true,
      });
    }

    const reminder = new Reminder({
      userId: interaction.user.id,
      channelId: interaction.channelId,
      message,
      remindAt,
    });

    await reminder.save();

    await interaction.reply({
      content:
        `✅ Reminder scheduled.\n\n` +
        `📝 ${message}\n` +
        `⏰ <t:${Math.floor(
          remindAt.getTime() / 1000
        )}:F>`,
      ephemeral: true,
    });
  },
};