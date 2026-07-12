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
    .setDescription('View a member\'s membership information')

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
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const member = interaction.options.getMember('user');

    if (!member) {
      return interaction.reply({
        content: '❌ Member not found.',
        ephemeral: true,
      });
    }

    const membership = await Membership.findOne({
      userId: member.id,
    });

    if (!membership) {
      return interaction.reply({
        content: `${member} does not have an active membership.`,
        ephemeral: true,
      });
    }

    const type =
      membership.type === 'race'
        ? 'Race Pass'
        : membership.type === 'monthly'
        ? 'Monthly'
        : 'Yearly';

    await interaction.reply({
      content:
        `👤 **Member:** ${member}\n\n` +
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