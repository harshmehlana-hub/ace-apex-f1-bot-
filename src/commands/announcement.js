import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

const RACE_WEEKEND_ANNOUNCEMENT = `@everyone
Its race weekend again, ways to watch F1 in our server:
Free to everyone (may lag/get full)
Race Pass for Bahrain GP (30 INR / 1 USD)
Monthly Supporters membership (50 INR / 3 USD)
Private watch party upto 5 friends (200 INR / 8 USD)
Yearly Supporters membership (**SALE: 299 INR / 21 USD**)
DM to get access for race pass and membership.

*NOTE : Race Pass and Membership are for those who want to support the server and watch the race sessions peacefully out of the chaos without lags, else free streams for race and quali will be held no need to worry.*`;

export default {
  data: new SlashCommandBuilder()
    .setName('announcement')
    .setDescription('Send the standard race-weekend announcement (Admin only)')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel where the announcement should be sent')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    if (!channel?.isTextBased()) {
      return interaction.reply({ content: '❌ Please select a text channel.', ephemeral: true });
    }

    try {
      await channel.send({ content: RACE_WEEKEND_ANNOUNCEMENT });
      return interaction.reply({
        content: `✅ Race-weekend announcement sent to <#${channel.id}>.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Failed to send race-weekend announcement:', error);
      return interaction.reply({
        content: '❌ I could not send the announcement there. Make sure the bot has permission to view and send messages in that channel.',
        ephemeral: true,
      });
    }
  },
};
