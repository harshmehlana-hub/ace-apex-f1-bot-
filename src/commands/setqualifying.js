import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setqualifying')
    .setDescription('Create a qualifying session (Admin only)')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Qualifying name (e.g. Monaco Qualifying)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Date (DD-MM-YYYY)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Time in IST (HH:MM)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const name = interaction.options.getString('name');
    const dateStr = interaction.options.getString('date');
    const timeStr = interaction.options.getString('time');

    const [day, month, year] = dateStr.split('-');

    const sessionStartTime = new Date(
      `${year}-${month}-${day}T${timeStr}:00+05:30`
    );

    if (isNaN(sessionStartTime.getTime())) {
      return interaction.reply({
        content:
          '❌ Invalid date or time format.\nUse DD-MM-YYYY and HH:MM.',
        ephemeral: true,
      });
    }

    const existingSession = await Qualifying.findOne({ name });

    if (existingSession) {
      return interaction.reply({
        content: `❌ A qualifying session named "${name}" already exists.`,
        ephemeral: true,
      });
    }

    const predictionOpenTime = new Date(
      sessionStartTime.getTime() - config.timing.openBefore
    );

    const predictionCloseTime = new Date(
      sessionStartTime.getTime() - config.timing.closeBefore
    );

    let status = 'upcoming';
    const now = new Date();

    if (now >= predictionOpenTime && now < predictionCloseTime) {
      status = 'open';
    } else if (now >= predictionCloseTime) {
      status = 'closed';
    }

    const qualifying = new Qualifying({
      name,
      sessionStartTime,
      predictionOpenTime,
      predictionCloseTime,
      status,
    });

    await qualifying.save();

    await interaction.reply({
      content:
        `✅ **Qualifying Session Created!**\n\n` +
        `🏁 **${name}**\n` +
        `📅 Session Start: <t:${Math.floor(
          sessionStartTime.getTime() / 1000
        )}:F>\n` +
        `🟢 Predictions Open: <t:${Math.floor(
          predictionOpenTime.getTime() / 1000
        )}:F>\n` +
        `🔴 Predictions Close: <t:${Math.floor(
          predictionCloseTime.getTime() / 1000
        )}:F>\n` +
        `📊 Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      ephemeral: true,
    });
  },
};