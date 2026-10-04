import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

function buildRaceWeekendAnnouncement(raceName, membershipCommandMention) {
  return `@everyone
Its race weekend again, ways to watch F1 in our server:
Free to everyone (may lag/get full)
Race Pass for ${raceName} (30 INR / 1.5 USD)
Monthly Supporters membership (50 INR / 3 USD)
Yearly Supporters membership (450 INR / 28 USD)
Use ${membershipCommandMention} to get access to Race Pass or Membership.

*NOTE : Race Pass and Membership are for those who want to support the server and watch the race sessions peacefully out of the chaos without lags, else free streams for race and quali will be held no need to worry.*`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('announcement')
    .setDescription('Send the standard race-weekend announcement (Admin only)')
    .addStringOption(option =>
      option
        .setName('race')
        .setDescription('Race name for this weekend')
        .setRequired(true)
    )
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

    const raceName = interaction.options.getString('race')?.trim();
    const channel = interaction.options.getChannel('channel');

    if (!raceName) {
      return interaction.reply({ content: '❌ Please enter the race name.', ephemeral: true });
    }

    if (!channel?.isTextBased()) {
      return interaction.reply({ content: '❌ Please select a text channel.', ephemeral: true });
    }

    try {
      const commands = await interaction.guild.commands.fetch();
      const membershipCommand = commands.find(command => command.name === 'purchasemembership');
      const membershipCommandMention = membershipCommand
        ? `</purchasemembership:${membershipCommand.id}>`
        : '/purchasemembership';

      await channel.send({ content: buildRaceWeekendAnnouncement(raceName, membershipCommandMention) });
      return interaction.reply({
        content: `✅ Race-weekend announcement for **${raceName}** sent to <#${channel.id}>.`,
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
