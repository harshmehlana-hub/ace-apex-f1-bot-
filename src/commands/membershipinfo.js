import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

const MEMBERSHIPS_PER_PAGE = 18;
const MAX_PAGES = 10;

function membershipType(type) {
  return type === 'race'
    ? 'Race Pass'
    : type === 'monthly'
      ? 'Monthly'
      : 'Yearly';
}

function makePages(memberships, usernames, guildName) {
  const rows = memberships.map((membership, index) => {
    const expiryTimestamp = Math.floor(membership.expiresAt.getTime() / 1000);
    const username = usernames.get(membership.userId) || `<@${membership.userId}>`;
    return [
      `**${index + 1}. ${username}**`,
      `🎟️ ${membershipType(membership.type)}`,
      `⏰ <t:${expiryTimestamp}:F> · <t:${expiryTimestamp}:R>`,
    ].join('  |  ');
  });

  const pageCount = Math.min(
    MAX_PAGES,
    Math.ceil(rows.length / MEMBERSHIPS_PER_PAGE)
  );

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageRows = rows.slice(
      pageIndex * MEMBERSHIPS_PER_PAGE,
      (pageIndex + 1) * MEMBERSHIPS_PER_PAGE
    );

    return new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🎟️ Active Verified Memberships')
      .setDescription(pageRows.join('\n\n'))
      .setFooter({
        text: `${guildName} • ${memberships.length} active memberships • Page ${pageIndex + 1}/${pageCount}`,
      })
      .setTimestamp();
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('membershipinfo')
    .setDescription('View all active verified memberships, sorted by expiry')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const memberships = await Membership.find({
      guildId: interaction.guild.id,
      expiresAt: { $gt: new Date() },
    })
      .sort({ expiresAt: 1 })
      .limit(MEMBERSHIPS_PER_PAGE * MAX_PAGES)
      .lean();

    if (!memberships.length) {
      return interaction.editReply({
        content: 'There are currently no active verified memberships.',
      });
    }

    const userIds = [...new Set(memberships.map((membership) => membership.userId))];
    const usernames = new Map();

    await Promise.all(userIds.map(async (userId) => {
      try {
        const member = await interaction.guild.members.fetch(userId);
        usernames.set(userId, member.displayName);
      } catch {
        usernames.set(userId, `<@${userId}>`);
      }
    }));

    const embeds = makePages(memberships, usernames, interaction.guild.name);
    const omitted = await Membership.countDocuments({
      guildId: interaction.guild.id,
      expiresAt: { $gt: new Date() },
    }) - memberships.length;

    if (omitted > 0) {
      embeds[embeds.length - 1].setFooter({
        text: `${interaction.guild.name} • Showing first ${memberships.length} active memberships • ${omitted} more not shown`,
      });
    }

    return interaction.editReply({ embeds });
  },
};
