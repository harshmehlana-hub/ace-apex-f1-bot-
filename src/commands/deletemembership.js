import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Routes,
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

  async execute(interaction, client) {
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
      guildId: interaction.guild.id,
    });

    if (!membership) {
      return interaction.reply({
        content:
          '❌ This user does not have an active membership.',
        ephemeral: true,
      });
    }

    // ----------------------------------------
    // REMOVE DISCORD ROLE
    // Uses REST API — no GuildMembers intent required
    // ----------------------------------------
    if (membership.roleId) {
      try {
        await client.rest.delete(
          Routes.guildMemberRole(
            interaction.guild.id,
            user.id,
            membership.roleId
          )
        );

        console.log(
          `✅ Membership role ${membership.roleId} removed from ${user.id}`
        );
      } catch (error) {
        console.error(
          '❌ Failed to remove membership role:',
          error
        );

        // If the role/member is already gone, we still
        // continue deleting the MongoDB membership.
      }
    }

    // ----------------------------------------
    // DELETE MEMBERSHIP FROM MONGODB
    // ----------------------------------------
    await membership.deleteOne();

    // ----------------------------------------
    // CONFIRM
    // ----------------------------------------
    await interaction.reply({
      content:
        `✅ Membership deleted successfully.\n\n` +
        `👤 Member: ${user}`,
      ephemeral: true,
    });
  },
};