import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Announcement } from '../database/models/Announcement.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('announcement')
    .setDescription('Schedule automatic prediction announcements (Admin only)')

    // REQUIRED OPTIONS FIRST
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Announcement date (DD-MM-YYYY)')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Announcement time in IST (HH:MM)')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('close-date')
        .setDescription('Prediction close date (DD-MM-YYYY)')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('close-time')
        .setDescription('Prediction close time in IST (HH:MM)')
        .setRequired(true)
    )

    // OPTIONAL OPTIONS LAST
    .addStringOption(option =>
      option
        .setName('race')
        .setDescription('Race name')
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName('qualifying')
        .setDescription('Qualifying session name')
        .setRequired(false)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const race = interaction.options.getString('race');
    const qualifying = interaction.options.getString('qualifying');

    if ((!race && !qualifying) || (race && qualifying)) {
      return interaction.reply({
        content:
          '❌ Please provide either a race or a qualifying session (not both).',
        ephemeral: true,
      });
    }

    const dateStr = interaction.options.getString('date');
    const timeStr = interaction.options.getString('time');
    const closeDateStr = interaction.options.getString('close-date');
    const closeTimeStr = interaction.options.getString('close-time');

    // Announcement time
    const [day, month, year] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const announcementTime = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hours - 5,
        minutes - 30
      )
    );

    // Prediction close time
    const [cDay, cMonth, cYear] = closeDateStr.split('-').map(Number);
    const [cHours, cMinutes] = closeTimeStr.split(':').map(Number);

    const closeTime = new Date(
      Date.UTC(
        cYear,
        cMonth - 1,
        cDay,
        cHours - 5,
        cMinutes - 30
      )
    );

    if (isNaN(announcementTime.getTime()) || isNaN(closeTime.getTime())) {
      return interaction.reply({
        content: '❌ Invalid date or time format.',
        ephemeral: true,
      });
    }

    if (closeTime <= announcementTime) {
      return interaction.reply({
        content:
          '❌ Prediction close time must be after the announcement time.',
        ephemeral: true,
      });
    }

    await Announcement.create({
      type: race ? 'race' : 'qualifying',
      name: race || qualifying,
      channelId: interaction.channelId,
      predictionCloseTime: closeTime,
      nextAnnouncementAt: announcementTime,
      sendIndex: 0,
    });

    await interaction.reply({
      content:
        `✅ **Announcement scheduled successfully!**\n\n` +
        `📢 **Type:** ${race ? 'Race' : 'Qualifying'}\n` +
        `🏁 **Name:** ${race || qualifying}\n\n` +
        `🕒 **First Announcement:**\n<t:${Math.floor(
          announcementTime.getTime() / 1000
        )}:F>\n\n` +
        `⏰ **Predictions Close:**\n` +
        `<t:${Math.floor(closeTime.getTime() / 1000)}:R>\n` +
        `<t:${Math.floor(closeTime.getTime() / 1000)}:F>\n\n` +
        `🔁 Automatic reminders will be sent at:\n` +
        `• Immediately\n` +
        `• +3 hours\n` +
        `• +9 hours\n` +
        `• +15 hours\n` +
        `• +21 hours`,
      ephemeral: true,
    });
  },
};