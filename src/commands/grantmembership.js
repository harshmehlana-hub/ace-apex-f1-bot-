import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Routes,
} from 'discord.js';

import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { logDM } from '../utils/dmLogger.js';

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

  async execute(interaction, client) {
    console.log('Instance:', process.pid);
    console.log(
      'Command received at:',
      new Date().toISOString()
    );

    // ----------------------------------------
    // ADMIN CHECK
    // ----------------------------------------
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // GET USER
    // ----------------------------------------
    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type');

    if (!user) {
      return interaction.reply({
        content: '❌ User not found.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // MEMBERSHIP TYPE
    // ----------------------------------------
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

      default:
        return interaction.reply({
          content: '❌ Invalid membership type.',
          ephemeral: true,
        });
    }

    // ----------------------------------------
    // CHECK MEMBERSHIP ROLE EXISTS
    // ----------------------------------------
    const role = await interaction.guild.roles
      .fetch(roleId)
      .catch(() => null);

    if (!role) {
      return interaction.reply({
        content: '❌ Membership role not found.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // ADD ROLE USING REST API
    // Does NOT require GuildMembers intent
    // ----------------------------------------
    try {
      await client.rest.put(
        Routes.guildMemberRole(
          interaction.guild.id,
          user.id,
          roleId
        )
      );

      console.log(
        `✅ Role ${roleId} added to ${user.id}`
      );
    } catch (error) {
      console.error(
        '❌ Failed to add membership role:',
        error
      );

      return interaction.reply({
        content:
          '❌ Failed to add the membership role. ' +
          'Make sure the user is still a member of this server and the bot can manage the role.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // FIND EXISTING MEMBERSHIP
    // ----------------------------------------
    let membership = await Membership.findOne({ userId: user.id });

    if (membership?.roleId && membership.roleId !== roleId) {
      await client.rest.delete(Routes.guildMemberRole(interaction.guild.id, user.id, membership.roleId)).catch(error => {
        if (error?.status !== 404) console.error('Failed to remove previous membership role:', error);
      });
    }

    const now = new Date();

    let expiry =
      membership && membership.expiresAt > now
        ? new Date(membership.expiresAt)
        : now;

    expiry.setDate(expiry.getDate() + durationDays);

    // ----------------------------------------
    // UPDATE / CREATE MEMBERSHIP
    // ----------------------------------------
    if (membership) {
      membership.roleId = roleId;
      membership.type = type;
      membership.guildId = interaction.guild.id;
      membership.expiresAt = expiry;

      membership.fiveDayReminderSent = false;
      membership.oneDayReminderSent = false;
      membership.expiryReminderSent = false;

      await membership.save();
    } else {
      await Membership.create({
        userId: user.id,
        guildId: interaction.guild.id,
        roleId,
        type,
        expiresAt: expiry,
      });
    }

    // ----------------------------------------
    // SEND ACTIVATION DM
    // ----------------------------------------
    try {
      console.log('=== DM START ===');
      console.log('Target:', user.tag, user.id);

      const membershipName =
        type === 'race'
          ? 'Race Pass'
          : type === 'monthly'
            ? 'Monthly Membership'
            : 'Yearly Membership';

      console.log('Sending...');

      await user.send(
        `**Hey ${user.username}! 👋**\n\n` +
        `Your membership is now active on the server.\n\n` +
        `**Type:** ${membershipName}\n` +
        `**Valid till:** <t:${Math.floor(
          expiry.getTime() / 1000
        )}:F>\n\n` +
        `Thank you for supporting **Ace's Apex**! We truly appreciate your support. 🥳❤️`
      );

      await logDM(
        client,
        'Membership Activated',
        interaction.user,
        user,
        `Membership Type: ${membershipName}`
      );

      console.log('DM timestamp:', Date.now());
      console.log('✅ DM SENT');
    } catch (error) {
      console.error('❌ DM FAILED');
      console.error(error);
    }

    // ----------------------------------------
    // FINAL REPLY
    // ----------------------------------------
    await interaction.reply({
      content:
        `✅ Membership granted successfully!\n\n` +
        `👤 Member: ${user}\n` +
        `🎟️ Type: ${
          type.charAt(0).toUpperCase() + type.slice(1)
        }\n` +
        `⏰ Expires:\n` +
        `<t:${Math.floor(expiry.getTime() / 1000)}:F>\n` +
        `<t:${Math.floor(expiry.getTime() / 1000)}:R>`,
      ephemeral: true,
    });
  },
};