import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { StickMessage } from '../database/models/StickMessage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stickstart')
    .setDescription('Repeat a message in this channel every 15 minutes (Admin only)')
    .addStringOption(option => option.setName('message').setDescription('Message to repeat every 15 minutes').setMaxLength(2000).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const message = interaction.options.getString('message', true).trim();
    if (!message) return interaction.reply({ content: '❌ Please enter a message to repeat.', ephemeral: true });

    const channel = interaction.channel;
    if (!channel?.isTextBased() || !channel.send) {
      return interaction.reply({ content: '❌ This command can only be used in a text channel.', ephemeral: true });
    }

    const stick = await StickMessage.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      message,
      createdBy: interaction.user.id,
      nextSendAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return interaction.reply({
      content: `✅ Repeating message started in <#${channel.id}>. It will first send in 15 minutes and repeat every 15 minutes. Use /stickstop to stop it.`,
      ephemeral: true,
    });
  },
};
