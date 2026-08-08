import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('membershipinfo')
    .setDescription("View a member's membership information")

    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member')
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    // ----------------------------------------
    // ADMIN CHECK
    // ----------------------------------------
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content:
          '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // GET USER
    // ----------------------------------------
    const user = interaction.options.getUser('user');

    if (!user) {
      return interaction.reply({
        content: '❌ User not found.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // FIND MEMBERSHIP
    // ----------------------------------------
    const membership = await Membership.findOne({
      userId: user.id,
    });

    if (!membership) {
      return interaction.reply({
        content:
          `${user} does not have an active membership.`,
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // MEMBERSHIP TYPE
    // ----------------------------------------
    const type =
      membership.type === 'race'
        ? 'Race Pass'
        : membership.type === 'monthly'
          ? 'Monthly'
          : 'Yearly';

    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------
    await interaction.reply({
      content:
        `👤 **Member:** ${user}\n\n` +
        `🎟️ **Membership:** ${type}\n` +
        `🎭 **Role:** <@&${membership.roleId}>\n\n` +
        `⏰ **Expires:**\n` +
        `<t:${Math.floor(
          membership.expiresAt.getTime() / 1000
        )}:F>\n` +
        `<t:${Math.floor(
          membership.expiresAt.getTime() / 1000
        )}:R>`,
      ephemeral: true,
    });
  },
};