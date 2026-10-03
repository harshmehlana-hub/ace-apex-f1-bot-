import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { config } from '../config.js';
import { isAdmin, parseISTDateTime } from '../utils/validators.js';
import { getCurrentSeason } from '../services/seasonService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setrace')
    .setDescription('Create a new race for predictions (Admin only)')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Race name (e.g., "Monaco Grand Prix")')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Race date (DD-MM-YYYY)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Race start time in IST (HH:MM)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    // Check admin permissions
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }
    
    const name = interaction.options.getString('name').trim();
    const dateStr = interaction.options.getString('date');
    const timeStr = interaction.options.getString('time');
    const raceStartTime = parseISTDateTime(dateStr, timeStr);

    if (!raceStartTime) {
      return interaction.reply({
        content: '❌ Invalid date/time. Use DD-MM-YYYY and HH:MM in IST, and enter a real calendar date.',
        ephemeral: true,
      });
    }

    const season = await getCurrentSeason();
    const existingRace = await Race.findOne({ season, name });
    if (existingRace) {
      return interaction.reply({
        content: `❌ A race named "${name}" already exists in season ${season}.`,
        ephemeral: true,
      });
    }

    // Calculate prediction window times
    const predictionOpenTime = new Date(raceStartTime.getTime() - config.timing.openBefore);
    const predictionCloseTime = new Date(raceStartTime.getTime() - config.timing.closeBefore);
    
    // Determine initial status
    const now = new Date();
    let status = 'upcoming';
    if (now >= predictionOpenTime && now < predictionCloseTime) {
      status = 'open';
    } else if (now >= predictionCloseTime) {
      status = 'closed';
    }
    
    const race = new Race({
      name,
      season,
      raceStartTime,
      predictionOpenTime,
      predictionCloseTime,
      status,
    });
    
    await race.save();
    
    await interaction.reply({
      content: `✅ **Race created successfully!**\n\n` +
        `🏎️ **${name}**\n` +
        `📅 Race Start: <t:${Math.floor(raceStartTime.getTime() / 1000)}:F>\n` +
        `🟢 Predictions Open: <t:${Math.floor(predictionOpenTime.getTime() / 1000)}:F>\n` +
        `🔴 Predictions Close: <t:${Math.floor(predictionCloseTime.getTime() / 1000)}:F>\n` +
        `📊 Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      ephemeral: true,
    });
  },
};
