import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { getCurrentSeason } from '../services/seasonService.js';
import { getCalendarRace, getCalendarChoices } from '../config/seasonCalendar2026.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setrace')
    .setDescription('Select and activate a race from the season calendar (Admin only)')
    .addStringOption(option =>
      option
        .setName('race')
        .setDescription('Select the Grand Prix')
        .setRequired(true)
        .addChoices(...getCalendarChoices(new Date().getUTCFullYear()))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const calendarKey = interaction.options.getString('race');
    const season = await getCurrentSeason();
    const calendarRace = getCalendarRace(calendarKey, season);

    if (!calendarRace) {
      return interaction.reply({ content: '❌ That race is not configured in the active season calendar.', ephemeral: true });
    }

    const predictionOpenTime = new Date(calendarRace.raceStartAt.getTime() - config.timing.openBefore);
    const predictionCloseTime = new Date(calendarRace.raceStartAt.getTime() - config.timing.closeBefore);
    const now = new Date();

    if (now >= calendarRace.raceStartAt) {
      return interaction.reply({
        content:
          `❌ **${calendarRace.name} has already started/passed.**\\n\\n` +
          `Race start: <t:${Math.floor(calendarRace.raceStartAt.getTime() / 1000)}:F>\\n` +
          'Past races cannot be newly activated with \`/setrace\`. Historical races remain available in the database.',
        ephemeral: true,
      });
    }

    let calculatedStatus = 'upcoming';
    if (now >= predictionOpenTime && now < predictionCloseTime) calculatedStatus = 'open';

    let race = await Race.findOne({ season, calendarKey });
    if (!race) race = await Race.findOne({ season, name: calendarRace.name });

    if (race) {
      race.name = calendarRace.name;
      race.calendarKey = calendarRace.key;
      race.racePassKey = calendarRace.racePassKey;
      race.raceStartTime = calendarRace.raceStartAt;
      race.predictionOpenTime = predictionOpenTime;
      race.predictionCloseTime = predictionCloseTime;
      if (!['completed', 'cancelled'].includes(race.status)) race.status = calculatedStatus;
      await race.save();

      return interaction.reply({
        content:
          '✅ **' + calendarRace.name + ' is now linked to the ' + season + ' season calendar.**\n\n' +
          '📅 Race Start: <t:' + Math.floor(calendarRace.raceStartAt.getTime() / 1000) + ':F>\n' +
          '🟢 Predictions Open: <t:' + Math.floor(predictionOpenTime.getTime() / 1000) + ':F>\n' +
          '🔴 Predictions Close: <t:' + Math.floor(predictionCloseTime.getTime() / 1000) + ':F>\n' +
          '📊 Status: ' + race.status.charAt(0).toUpperCase() + race.status.slice(1) + '\n\n' +
          '🔒 This calendar race is protected from duplicate creation.',
        ephemeral: true,
      });
    }

    race = await Race.create({
      name: calendarRace.name,
      calendarKey: calendarRace.key,
      season,
      racePassKey: calendarRace.racePassKey,
      raceStartTime: calendarRace.raceStartAt,
      predictionOpenTime,
      predictionCloseTime,
      status: calculatedStatus,
    });

    return interaction.reply({
      content:
        '✅ **Race activated successfully!**\n\n' +
        '🏎️ **' + calendarRace.name + '**\n' +
        '📅 Race Start: <t:' + Math.floor(calendarRace.raceStartAt.getTime() / 1000) + ':F>\n' +
        '🟢 Predictions Open: <t:' + Math.floor(predictionOpenTime.getTime() / 1000) + ':F>\n' +
        '🔴 Predictions Close: <t:' + Math.floor(predictionCloseTime.getTime() / 1000) + ':F>\n' +
        '📊 Status: ' + calculatedStatus.charAt(0).toUpperCase() + calculatedStatus.slice(1) + '\n' +
        '🔒 This calendar race is protected from duplicate creation.',
      ephemeral: true,
    });
  },
};
