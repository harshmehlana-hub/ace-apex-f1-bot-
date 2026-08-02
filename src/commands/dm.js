import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';

import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { logDM } from '../utils/dmLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a DM to a user (Admin only)')

    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User')
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction, client) {

    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('user');
    const message = interaction.options.getString('message');

    try {

      await target.send(message);

      await logDM(
        client,
        'Outgoing DM',
        interaction.user,
        target,
        message
      );

      await interaction.reply({
        content: `✅ DM sent successfully to ${target}.`,
        ephemeral: true,
      });

    } catch (error) {

      await interaction.reply({
        content:
          '❌ Failed to send the DM. The user may have DMs disabled.',
        ephemeral: true,
      });

    }

  },
};