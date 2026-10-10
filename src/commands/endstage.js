import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { StageEndSchedule } from '../database/models/StageEndSchedule.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

function parseIstDateTime(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  // The supplied wall-clock time is IST (UTC+05:30); persist the equivalent UTC instant.
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - (5 * 60 + 30) * 60_000;
  const check = new Date(utcMillis + (5 * 60 + 30) * 60_000);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) return null;

  return new Date(utcMillis);
}

export default {
  data: new SlashCommandBuilder()
    .setName('endstage')
    .setDescription('Schedule a live Discord Stage session to end at an IST date and time (Admin only)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Stage voice channel')
        .addChannelTypes(ChannelType.GuildStageVoice)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('time_ist')
        .setDescription('IST time as DD-MM-YYYY HH:MM, e.g. 11-10-2026 19:30')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      if (!isAdmin(interaction.member, config.roles.admin)) {
        return await interaction.reply({
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('channel');
      const input = interaction.options.getString('time_ist');
      const scheduledAt = parseIstDateTime(input);

      if (!scheduledAt) {
        return await interaction.reply({
          content: '❌ Invalid date/time. Use DD-MM-YYYY HH:MM in IST, for example `11-10-2026 19:30`.',
          ephemeral: true,
        });
      }

      if (scheduledAt.getTime() <= Date.now()) {
        return await interaction.reply({
          content: '❌ Please provide a future date/time in IST.',
          ephemeral: true,
        });
      }

      const schedule = await StageEndSchedule.create({
        guildId: interaction.guildId,
        channelId: channel.id,
        scheduledAt,
        createdBy: interaction.user.id,
      });

      const unix = Math.floor(scheduledAt.getTime() / 1000);
      return await interaction.reply({
        content: '✅ Scheduled the live Stage in ' + channel.toString() +
          ' to end at <t:' + unix + ':F> (<t:' + unix + ':R>).\n' +
          'Input interpreted as IST: `' + input + ' IST`. ' +
          'The channel itself will not be deleted. Schedule ID: `' + schedule.id + '`.',
        ephemeral: true,
      });
    } catch (error) {
      console.error('[endstage] Failed to schedule Stage end:', error);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({
          content: '❌ Could not schedule the Stage end. Please check the bot/database logs.',
          ephemeral: true,
        }).catch(() => null);
      }
      return interaction.reply({
        content: '❌ Could not schedule the Stage end. Please check the bot/database logs.',
        ephemeral: true,
      }).catch(() => null);
    }
  },
};
