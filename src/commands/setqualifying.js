import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { getCurrentSeason } from '../services/seasonService.js';
import { getCalendarRace, getCalendarChoices } from '../config/seasonCalendar2026.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setqualifying')
    .setDescription('Select and activate qualifying from the season calendar (Admin only)')
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

    const predictionOpenTime = new Date(calendarRace.qualifyingStartAt.getTime() - config.timing.openBefore);
    const predictionCloseTime = new Date(calendarRace.qualifyingStartAt.getTime() - config.timing.closeBefore);
    const now = new Date();

    if (now >= calendarRace.qualifyingStartAt) {
      return interaction.reply({
        content:
          `❌ **${calendarRace.qualifyingName} has already started/passed.**\\n\\n` +
          `Session start: <t:${Math.floor(calendarRace.qualifyingStartAt.getTime() / 1000)}:F>\\n` +
          'Past qualifying sessions cannot be newly activated with \`/setqualifying\`. Historical sessions remain available in the database.',
        ephemeral: true,
      });
    }

    let calculatedStatus = 'upcoming';
    if (now >= predictionOpenTime && now < predictionCloseTime) calculatedStatus = 'open';

    let qualifying = await Qualifying.findOne({ season, calendarKey });
    if (!qualifying) qualifying = await Qualifying.findOne({ season, name: calendarRace.qualifyingName });

    if (qualifying) {
      qualifying.name = calendarRace.qualifyingName;
      qualifying.calendarKey = calendarRace.key;
      qualifying.sessionStartTime = calendarRace.qualifyingStartAt;
      qualifying.predictionOpenTime = predictionOpenTime;
      qualifying.predictionCloseTime = predictionCloseTime;
      if (!['completed', 'cancelled'].includes(qualifying.status)) qualifying.status = calculatedStatus;
      await qualifying.save();

      return interaction.reply({
        content:
          '✅ **' + calendarRace.qualifyingName + ' is now linked to the ' + season + ' season calendar.**\n\n' +
          '📅 Session Start: <t:' + Math.floor(calendarRace.qualifyingStartAt.getTime() / 1000) + ':F>\n' +
          '🟢 Predictions Open: <t:' + Math.floor(predictionOpenTime.getTime() / 1000) + ':F>\n' +
          '🔴 Predictions Close: <t:' + Math.floor(predictionCloseTime.getTime() / 1000) + ':F>\n' +
          '📊 Status: ' + qualifying.status.charAt(0).toUpperCase() + qualifying.status.slice(1) + '\n\n' +
          '🔒 This calendar qualifying is protected from duplicate creation.',
        ephemeral: true,
      });
    }

    qualifying = await Qualifying.create({
      name: calendarRace.qualifyingName,
      calendarKey: calendarRace.key,
      season,
      sessionStartTime: calendarRace.qualifyingStartAt,
      predictionOpenTime,
      predictionCloseTime,
      status: calculatedStatus,
    });

    return interaction.reply({
      content:
        '✅ **Qualifying activated successfully!**\n\n' +
        '🏁 **' + calendarRace.qualifyingName + '**\n' +
        '📅 Session Start: <t:' + Math.floor(calendarRace.qualifyingStartAt.getTime() / 1000) + ':F>\n' +
        '🟢 Predictions Open: <t:' + Math.floor(predictionOpenTime.getTime() / 1000) + ':F>\n' +
        '🔴 Predictions Close: <t:' + Math.floor(predictionCloseTime.getTime() / 1000) + ':F>\n' +
        '📊 Status: ' + calculatedStatus.charAt(0).toUpperCase() + calculatedStatus.slice(1) + '\n' +
        '🔒 This calendar qualifying is protected from duplicate creation.',
      ephemeral: true,
    });
  },
};
