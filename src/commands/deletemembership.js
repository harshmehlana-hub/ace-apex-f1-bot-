import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deletemembership')
    .setDescription('Delete a membership (Admin only)')

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
        content:
          '❌ You do not have permission to use this command.',
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
        content: '❌ This user does not have an active membership.',
        ephemeral: true,
      });
    }

    // Remove the Discord role if it still exists
    if (membership.roleId) {
      const role = interaction.guild.roles.cache.get(
        membership.roleId
      );

      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
      }
    }

    // Delete the membership from MongoDB
    await membership.deleteOne();

    await interaction.reply({
      content:
        `✅ Membership deleted successfully.\n\n` +
        `👤 Member: ${member}`,
      ephemeral: true,
    });
  },
};