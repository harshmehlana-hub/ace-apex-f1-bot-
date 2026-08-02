import { SlashCommandBuilder } from 'discord.js';

import { logDM } from '../utils/dmLogger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a DM to a user')

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
    ),

  async execute(interaction, client) {

    const STAFF_ROLES = [
      '1533445133427806268', //paul
      '1476275477416247338', //admins
      '1506635584322670702', //communitymanager
    ];

    const allowed = STAFF_ROLES.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    );

    if (!allowed) {
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