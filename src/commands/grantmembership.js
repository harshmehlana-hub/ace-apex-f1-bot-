import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('grantmembership')
    .setDescription('Grant or renew a membership (Admin only)')

    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Member')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Membership type')
        .setRequired(true)
        .addChoices(
          { name: 'Race Pass', value: 'race' },
          { name: 'Monthly', value: 'monthly' },
          { name: 'Yearly', value: 'yearly' }
        )
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
    const type = interaction.options.getString('type');

    if (!member) {
      return interaction.reply({
        content: '❌ Member not found.',
        ephemeral: true,
      });
    }

    let roleId;
    let durationDays;

    switch (type) {
      case 'race':
        roleId = config.roles.racePass;
        durationDays = 7;
        break;

      case 'monthly':
        roleId = config.roles.supporter;
        durationDays = 30;
        break;

      case 'yearly':
        roleId = config.roles.supporter;
        durationDays = 365;
        break;
    }

    const role = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      return interaction.reply({
        content: '❌ Membership role not found.',
        ephemeral: true,
      });
    }

    await member.roles.add(role);

    let membership = await Membership.findOne({
      userId: member.id,
    });

    const now = new Date();

    let expiry =
      membership && membership.expiresAt > now
        ? new Date(membership.expiresAt)
        : now;

    expiry.setDate(expiry.getDate() + durationDays);

    if (membership) {
      membership.roleId = roleId;
      membership.type = type;
      membership.guildId = interaction.guild.id;
      membership.expiresAt = expiry;

      await membership.save();
    } else {
      await Membership.create({
        userId: member.id,
        guildId: interaction.guild.id,
        roleId,
        type,
        expiresAt: expiry,
      });
    }

    await interaction.reply({
      content:
        `✅ Membership granted successfully!\n\n` +
        `👤 Member: ${member}\n` +
        `🎟️ Type: ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
        `⏰ Expires:\n` +
        `<t:${Math.floor(expiry.getTime() / 1000)}:F>\n` +
        `<t:${Math.floor(expiry.getTime() / 1000)}:R>`,
      ephemeral: true,
    });
  },
};