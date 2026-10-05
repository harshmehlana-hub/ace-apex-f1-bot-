import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { Membership } from '../database/models/Membership.js';
import { RacePass } from '../database/models/RacePass.js';
import { Race } from '../database/models/Race.js';
import { FeedbackResponse } from '../database/models/FeedbackResponse.js';
import { FeedbackCampaign } from '../database/models/FeedbackCampaign.js';
import { FeedbackSession } from '../database/models/FeedbackSession.js';

let feedbackBroadcastRunning = false;

const ids = {
  start: 'feedback:start',
  attendance: 'feedback:attendance',
  rating: 'feedback:rating',
  comment: 'feedback:comment',
  skip: 'feedback:skip',
  statsRace: 'feedbackstats:race',
  prev: 'feedbackstats:prev',
  next: 'feedbackstats:next',
};

function embed(title, description) {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x3498db);
}

function startRow() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ids.start).setLabel('📝 Give Feedback').setStyle(ButtonStyle.Primary)
  )];
}

function attendanceRow() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ids.attendance + ':yes').setLabel('✅ Yes').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(ids.attendance + ':no').setLabel('❌ No').setStyle(ButtonStyle.Secondary)
  )];
}

function ratingRow() {
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(ids.rating)
      .setPlaceholder('Select your experience rating')
      .addOptions(
        { label: '1 — Very Poor', value: '1', emoji: '⭐' },
        { label: '2 — Poor', value: '2', emoji: '⭐' },
        { label: '3 — Average', value: '3', emoji: '⭐' },
        { label: '4 — Good', value: '4', emoji: '⭐' },
        { label: '5 — Excellent', value: '5', emoji: '⭐' }
      )
  )];
}

function commentRow() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ids.comment).setLabel('✍️ Give Feedback').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(ids.skip).setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary)
  )];
}

async function getSession(userId, raceKey) {
  return FeedbackSession.findOne({
    userId,
    raceKey,
    expiresAt: { $gt: new Date() },
  });
}

async function save(state, user) {
  return FeedbackResponse.findOneAndUpdate(
    { guildId: state.guildId, raceKey: state.raceKey, userId: user.id },
    {
      $set: {
        raceName: state.raceName,
        username: user.username,
        attended: state.attended,
        rating: state.rating,
        improvement: state.improvement || '',
        submittedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function logSubmission(client, user, raceName) {
  const channel = await client.channels.fetch(config.channels.dmLogs).catch(() => null);
  if (channel) {
    await channel.send('📝 **@' + user.username + '** submitted the feedback form for **' + raceName + '**.');
  }
}

async function submit(interaction, state) {
  await save(state, interaction.user);
  await FeedbackSession.deleteOne({ guildId: state.guildId, raceKey: state.raceKey, userId: interaction.user.id });
  await interaction.update({
    content: '✅ **Feedback submitted!**\n\nThank you for helping us improve Ace\'s Apex. ❤️🏁',
    embeds: [],
    components: [],
  });
  await logSubmission(interaction.client, interaction.user, state.raceName);
}

export async function handleFeedbackInteraction(interaction) {
  if (!(interaction.isButton() || interaction.isStringSelectMenu())) return false;
  const id = interaction.customId || '';

  if (id === ids.start) {
    const state = sessions.get(interaction.user.id);
    if (!state) return interaction.reply({ content: '❌ This feedback session has expired. Please use the latest feedback DM.', ephemeral: true });
    const existing = await FeedbackResponse.exists({
      guildId: state.guildId,
      raceKey: state.raceKey,
      userId: interaction.user.id,
    });
    if (existing) {
      sessions.delete(interaction.user.id);
      return interaction.reply({ content: '✅ You have already submitted feedback for this race. Thank you! ❤️', ephemeral: true });
    }
    return interaction.update({
      embeds: [embed('Question 1', '🏁 **Did you attend the ' + state.raceName + ' race stream today?**')],
      components: attendanceRow(),
    });
  }

  if (id.startsWith(ids.attendance + ':')) {
    const state = sessions.get(interaction.user.id);
    if (!state) return interaction.reply({ content: '❌ This feedback session has expired. Please use the latest feedback DM.', ephemeral: true });
    state.attended = id.endsWith(':yes');
    if (!state.attended) {
      state.rating = null;
      state.improvement = '';
      return submit(interaction, state);
    }
    return interaction.update({
      embeds: [embed('Question 2', '⭐ **How was your experience?**')],
      components: ratingRow(),
    });
  }

  if (interaction.isStringSelectMenu() && id === ids.rating) {
    const state = sessions.get(interaction.user.id);
    if (!state) return interaction.reply({ content: '❌ This feedback session has expired. Please use the latest feedback DM.', ephemeral: true });
    state.rating = Number(interaction.values[0]);
    return interaction.update({
      embeds: [embed('Question 3', '💬 **Any feedback to improve?**\n\nThis question is optional.')],
      components: commentRow(),
    });
  }

  if (id === ids.skip) {
    const state = sessions.get(interaction.user.id);
    if (!state) return interaction.reply({ content: '❌ This feedback session has expired. Please use the latest feedback DM.', ephemeral: true });
    return submit(interaction, state);
  }

  if (id === ids.comment) {
    const state = sessions.get(interaction.user.id);
    if (!state) return interaction.reply({ content: '❌ This feedback session has expired. Please use the latest feedback DM.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId('feedback:modal').setTitle('Race Feedback');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('improvement')
        .setLabel('Any feedback to improve?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('Optional')
    ));
    return interaction.showModal(modal);
  }

  return false;
}

export async function handleFeedbackModal(interaction) {
  if (!interaction.isModalSubmit() || interaction.customId !== 'feedback:modal') return false;
  const state = sessions.get(interaction.user.id);
  if (!state) return interaction.reply({ content: '❌ This feedback session has expired. Please use the latest feedback DM.', ephemeral: true });
  state.improvement = interaction.fields.getTextInputValue('improvement').trim();
  return submit(interaction, state);
}

export default {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Send the Discord feedback form to Supporters and Race Pass holders')
    .addStringOption(option => option.setName('race').setDescription('Race for this feedback campaign').setRequired(true)),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    if (feedbackBroadcastRunning) return interaction.reply({ content: '⚠️ A feedback DM broadcast is already running. Please wait for it to finish.', ephemeral: true });

    const raceName = interaction.options.getString('race');
    const race = await Race.findOne({ name: raceName, season: config.season }).lean();
    if (!race) return interaction.reply({ content: '❌ Race not found. Please use the exact race name.', ephemeral: true });

    feedbackBroadcastRunning = true;
    await FeedbackCampaign.findOneAndUpdate(
      { guildId: interaction.guildId, raceKey: race._id.toString() },
      { $set: { raceName: race.name, startedBy: interaction.user.id, startedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await interaction.reply({ content: '📨 Feedback DM broadcast started for **' + race.name + '**.', ephemeral: true });

    try {
      const now = new Date();
      const [memberships, racePasses] = await Promise.all([
        Membership.find({ guildId: interaction.guildId, expiresAt: { $gt: now } }).select('userId'),
        RacePass.find({ guildId: interaction.guildId, status: 'active', expiresAt: { $gt: now } }).select('userId'),
      ]);
      const userIds = new Set([...memberships.map(x => x.userId), ...racePasses.map(x => x.userId)]);
      let sent = 0;
      let failed = 0;
      const failedUsers = [];

      for (const userId of userIds) {
        try {
          const user = await interaction.client.users.fetch(userId);
          if (user.bot) continue;
          sessions.set(user.id, {
            guildId: interaction.guildId,
            raceKey: race._id.toString(),
            raceName: race.name,
            attended: null,
            rating: null,
            improvement: '',
          });
          await user.send({
            embeds: [embed('🏁 ' + race.name + ' — Race Feedback', "Thank you for supporting Ace's Apex!\n\nWe'd love to know how your race weekend experience was.")],
            components: startRow(),
          });
          sent++;
        } catch (error) {
          failed++;
          try {
            const failedUser = await interaction.client.users.fetch(userId);
            failedUsers.push('• ' + failedUser.username + ' (' + userId + ')');
          } catch {
            failedUsers.push('• <@' + userId + '> (' + userId + ')');
          }
          console.error('Feedback DM failed for ' + userId + ':', error?.message || error);
        }
      }

      const channel = await interaction.client.channels.fetch(config.channels.dmLogs).catch(() => null);
      if (channel) {
        await channel.send(
          '📨 **Feedback Broadcast Completed**\n' +
          '🏁 **Race:** ' + race.name + '\n' +
          '📨 **DMs sent:** ' + sent + '\n' +
          '❌ **DMs failed:** ' + failed + '\n' +
          '👥 **Total recipients:** ' + userIds.size
        );

        if (failedUsers.length) {
          let list = failedUsers.join('\n');
          while (list.length > 1900) {
            const splitAt = list.lastIndexOf('\n', 1900);
            const chunk = list.slice(0, splitAt > 0 ? splitAt : 1900);
            await channel.send('❌ **Failed to DM:**\n' + chunk);
            list = list.slice(splitAt > 0 ? splitAt + 1 : 1900);
          }
          if (list) await channel.send('❌ **Failed to DM:**\n' + list);
        }
      }
    } finally {
      feedbackBroadcastRunning = false;
    }
  },
};

function statsEmbed(raceName, response, page, total) {
  const rating = response.rating ? '⭐'.repeat(response.rating) + ' (' + response.rating + '/5)' : 'Not answered';
  const improvement = response.improvement ? response.improvement : 'Not answered';
  return new EmbedBuilder()
    .setTitle('🏁 ' + raceName + ' — Feedback')
    .setColor(0x3498db)
    .setDescription(
      '**👤 ' + response.username + '**\n\n' +
      '**Q1. Did you attend the race stream today?**\n**Answer:** ' + (response.attended ? 'Yes' : 'No') + '\n\n' +
      '**Q2. How was your experience?**\n**Answer:** ' + rating + '\n\n' +
      '**Q3. Any feedback to improve?**\n**Answer:** ' + improvement
    )
    .setFooter({ text: 'Page ' + page + ' / ' + total })
    .setTimestamp(response.submittedAt);
}

function statsRows(page, total) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ids.prev).setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(ids.next).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= total)
  )];
}

async function getFeedbackRaces(guildId) {
  return FeedbackCampaign.find({ guildId }).sort({ startedAt: -1 }).lean();
}

export const feedbackStatsCommand = {
  data: new SlashCommandBuilder()
    .setName('feedbackstats')
    .setDescription('View submitted race feedback (Admin only)'),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    const races = await getFeedbackRaces(interaction.guildId);
    if (!races.length) return interaction.reply({ content: '📊 No feedback responses have been submitted yet.', ephemeral: true });
    await interaction.reply({
      content: 'Select a race to view feedback responses:',
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(ids.statsRace).setPlaceholder('Select a race').addOptions(
          races.slice(0, 25).map(r => ({ label: r.raceName.slice(0, 100), value: r.raceKey }))
        )
      )],
    });
  },
};

export async function handleFeedbackStatsInteraction(interaction) {
  if (interaction.customId === ids.statsRace) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    const raceKey = interaction.values[0];
    const race = (await getFeedbackRaces(interaction.guildId)).find(r => r.raceKey === raceKey);
    const responses = await FeedbackResponse.find({ guildId: interaction.guildId, raceKey }).sort({ submittedAt: 1 }).lean();
    if (!race || !responses.length) return interaction.update({ content: '📊 No responses found for that race.', components: [] });
    const state = { userId: interaction.user.id, raceName: race.raceName, responses, page: 1 };
    const reply = await interaction.update({ content: null, embeds: [statsEmbed(race.raceName, responses[0], 1, responses.length)], components: statsRows(1, responses.length) });
    statsSessions.set(interaction.message.id, state);
    return reply;
  }

  if (interaction.customId === ids.prev || interaction.customId === ids.next) {
    const state = statsSessions.get(interaction.message.id);
    if (!state) return interaction.reply({ content: '❌ This feedback stats session has expired.', ephemeral: true });
    if (interaction.user.id !== state.userId) return interaction.reply({ content: '❌ Only the admin who opened these stats can navigate pages.', ephemeral: true });
    if (interaction.customId === ids.next) state.page++;
    else state.page--;
    state.page = Math.max(1, Math.min(state.responses.length, state.page));
    return interaction.update({ embeds: [statsEmbed(state.raceName, state.responses[state.page - 1], state.page, state.responses.length)], components: statsRows(state.page, state.responses.length) });
  }

  return false;
}
