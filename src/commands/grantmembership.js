import {
  SlashCommandBuilder,
  PermissionFlagsBits,
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
console.log("Instance:", process.pid);
console.log("Command received at:", new Date().toISOString());
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
membership.fiveDayReminderSent = false;
membership.oneDayReminderSent = false;
membership.expiryReminderSent = false;

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

try {
  console.log("=== DM START ===");
  console.log("Target:", member.user.tag, member.id);

  const user = await client.users.fetch(member.id);
  console.log("Fetched user");

  const membershipName =
    type === "race"
      ? "Race Pass"
      : type === "monthly"
      ? "Monthly Membership"
      : "Yearly Membership";

  console.log("Sending...");

  await user.send(
  `**Hey @${member.user.username}! 👋**

Your membership is now active on the server.

**Type:** ${membershipName}
**Valid till:** <t:${Math.floor(expiry.getTime() / 1000)}:F>

Thank you for supporting **Ace's Apex**! We truly appreciate your support. 🥳❤️`
);
await logDM(
  client,
  'Membership Activated',
  interaction.user,
  user,
  `Membership Type: ${membershipName}`
);

console.log("DM timestamp:", Date.now());
  console.log("✅ DM SENT");
} catch (error) {
  console.error("❌ DM FAILED");
  console.error(error);
}
console.log("Guild ID:", interaction.guild.id);
console.log("Member ID:", member.id);
console.log("In cache:", interaction.guild.members.cache.has(member.id));
console.log("Before reply:");
console.log("interaction.replied =", interaction.replied);
console.log("interaction.deferred =", interaction.deferred);    
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