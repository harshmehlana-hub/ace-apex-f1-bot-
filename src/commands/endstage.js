import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { StageEndSchedule } from '../database/models/StageEndSchedule.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

function parseIstDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - (5 * 60 + 30) * 60_000;
  const date = new Date(utcMillis);
  const check = new Date(utcMillis + (5 * 60 + 30) * 60_000);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) return null;
  return date;
}

export default {
  data: new SlashCommandBuilder()
    .setName('endstage')
    .setDescription('Schedule a live Discord Stage session to end at an IST date and time (Admin only)')
    .addChannelOption(option => option.setName('channel').setDescription('Stage voice channel').addChannelTypes(ChannelType.GuildStageVoice).setRequired(true))
    .addStringOption(option => option.setName('time_ist').setDescription('IST time as YYYY-MM-DD HH:mm, e.g. 2026-10-11 19:30').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    const input = interaction.options.getString('time_ist');
    const scheduledAt = parseIstDateTime(input);
    if (!scheduledAt) return interaction.reply({ content: '❌ Invalid date/time. Use YYYY-MM-DD HH:mm in IST, for example `2026-10-11 19:30`.', ephemeral: true });
    if (scheduledAt.getTime() <= Date.now()) return interaction.reply({ content: '❌ Please provide a future date/time in IST.', ephemeral: true });

    const schedule = await StageEndSchedule.create({ guildId: interaction.guildId, channelId: channel.id, scheduledAt, createdBy: interaction.user.id });
    const unix = Math.floor(scheduledAt.getTime() / 1000);
    return interaction.reply({ content: '✅ Scheduled the live Stage in ' + channel.toString() + ' to end at <t:' + unix + ':F> (<t:' + unix + ':R>).\nInput interpreted as IST: `' + input + ' IST`. The channel itself will not be deleted. Schedule ID: `' + schedule.id + '`.', ephemeral: true });
  },
};
