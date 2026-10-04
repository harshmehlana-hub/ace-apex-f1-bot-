import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { Membership } from '../database/models/Membership.js';
import { RacePass } from '../database/models/RacePass.js';

let feedbackBroadcastRunning = false;

const FEEDBACK_MESSAGE = (formLink) =>
  `Dear Supporter,

I hope you enjoyed the race weekend! 🏁

We'd really appreciate your feedback. Kindly take a moment to fill out the feedback form below:

📝 **[Fill the Feedback Form](${formLink})**

Your feedback helps us improve future race weekends and make Ace's Apex even better.

Thank you for supporting Ace's Apex! ❤️`;

async function broadcastFeedback(guild, formLink, startedBy) {
  try {
    // Use the database as the source of truth. Enumerating guild members
    // requires Discord's privileged Guild Members intent, which this bot
    // intentionally does not use.
    const now = new Date();
    const [memberships, racePasses] = await Promise.all([
      Membership.find({ guildId: guild.id, expiresAt: { $gt: now } }).select('userId expiresAt'),
      RacePass.find({ guildId: guild.id, status: 'active', expiresAt: { $gt: now } }).select('userId expiresAt'),
    ]);

    const userIds = new Set([
      ...memberships.map(record => record.userId),
      ...racePasses.map(record => record.userId),
    ]);

    const users = [];
    for (const userId of userIds) {
      try {
        const user = await guild.client.users.fetch(userId);
        if (!user.bot) users.push(user);
      } catch (error) {
        console.error('Failed to fetch user ' + userId + ' for feedback DM:', error?.message || error);
      }
    }

    let sent = 0;
    let failed = 0;
    const sentUsers = [];
    const failedUsers = [];

    for (const user of users) {
      try {
        await user.send(FEEDBACK_MESSAGE(formLink));
        sent += 1;
        sentUsers.push('• ' + user.tag + ' (' + user.id + ')');
      } catch (error) {
        failed += 1;
        failedUsers.push('• ' + user.tag + ' (' + user.id + ')');
        console.error('Failed to send feedback DM to ' + user.id + ':', error?.message || error);
      }
    }

    try {
      const channel = await guild.client.channels.fetch(config.channels.dmLogs);
      if (channel) {
        const header = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('📨 Feedback DM Broadcast Completed')
          .setTimestamp()
          .addFields(
            { name: '👮 Started by', value: startedBy.tag + '\n`' + startedBy.id + '`', inline: true },
            { name: '📨 DMs sent', value: String(sent), inline: true },
            { name: '❌ Failed', value: String(failed), inline: true },
            { name: '👥 Total recipients', value: String(users.length), inline: true },
            { name: '🔗 Form', value: formLink },
          );

        await channel.send({ embeds: [header] });

        const sendChunks = async (title, userList, color) => {
          if (!userList.length) return;
          let chunk = '';
          let part = 1;
          for (const user of userList) {
            if ((chunk + user + '\n').length > 1800) {
              await channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title + ' (Part ' + part + ')').setDescription(chunk)] });
              chunk = '';
              part += 1;
            }
            chunk += user + '\n';
          }
          if (chunk) await channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title + ' (Part ' + part + ')').setDescription(chunk)] });
        };

        await sendChunks('✅ DM sent to following users', sentUsers, 0x2ecc71);
        await sendChunks('❌ DM failed for following users', failedUsers, 0xe74c3c);
      }
    } catch (error) {
      console.error('Failed to write feedback broadcast log:', error);
    }

    console.log('Feedback broadcast completed by ' + startedBy.tag + ': ' + sent + ' sent, ' + failed + ' failed, ' + users.length + ' total recipients.');
  } catch (error) {
    console.error('Feedback broadcast failed:', error);
  } finally {
    feedbackBroadcastRunning = false;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('DM the feedback form to all Supporters and Race Pass holders (Admin only)')
    .addStringOption(option =>
      option
        .setName('form')
        .setDescription('Feedback form link')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    if (feedbackBroadcastRunning) {
      return interaction.reply({
        content: '⚠️ A feedback DM broadcast is already running. Please wait for it to finish.',
        ephemeral: true,
      });
    }

    const formLink = interaction.options.getString('form')?.trim();

    try {
      const url = new URL(formLink);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    } catch {
      return interaction.reply({
        content: '❌ Please provide a valid feedback form link starting with http:// or https://.',
        ephemeral: true,
      });
    }

    feedbackBroadcastRunning = true;

    await interaction.reply({
      content:
        '📨 Feedback DM broadcast started.\n\n' +
        'The bot will DM everyone who currently has the **Supporter** or **Race Pass** role.\n' +
        'Members who have both roles will receive only one DM.',
      ephemeral: true,
    });

    broadcastFeedback(interaction.guild, formLink, interaction.user);
  },
};
