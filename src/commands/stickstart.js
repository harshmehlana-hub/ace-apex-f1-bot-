import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { StickMessage } from '../database/models/StickMessage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stickstart')
    .setDescription('Send a one-time message or start a repeating message (Admin only)')
    .addStringOption(option => option
      .setName('message')
      .setDescription('Message to send')
      .setMaxLength(2000)
      .setRequired(true))
    .addIntegerOption(option => option
      .setName('frequency')
      .setDescription('Repeat interval in minutes. Leave empty to send only once.')
      .setMinValue(1)
      .setMaxValue(10080)
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const message = interaction.options.getString('message', true).trim();
    const frequency = interaction.options.getInteger('frequency');

    if (!message) {
      return interaction.reply({ content: '❌ Please enter a message.', ephemeral: true });
    }

    const channel = interaction.channel;
    if (!channel?.isTextBased() || !channel.send) {
      return interaction.reply({ content: '❌ This command can only be used in a text channel.', ephemeral: true });
    }

    if (frequency === null) {
      try {
        await channel.send({ content: message, allowedMentions: { parse: [] } });
        return interaction.reply({
          content: `✅ Your one-time message has been sent in <#${channel.id}>. It will not appear in /stickstop.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('[Stick Messages] Failed to send one-time message:', error);
        return interaction.reply({ content: '❌ I could not send the message. Check the bot permissions in this channel.', ephemeral: true });
      }
    }

    await StickMessage.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      message,
      createdBy: interaction.user.id,
      intervalMinutes: frequency,
      nextSendAt: new Date(Date.now() + frequency * 60 * 1000),
    });

    return interaction.reply({
      content: `✅ Repeating message started in <#${channel.id}>. It will first send in ${frequency} minute(s), then repeat every ${frequency} minute(s). Use /stickstop to stop it.`,
      ephemeral: true,
    });
  },
};
