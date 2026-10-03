import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { grantMembership } from '../services/membershipService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('grantmembership')
    .setDescription('Grant or renew a membership (Admin only)')
    .addUserOption(option => option.setName('user').setDescription('Member').setRequired(true))
    .addStringOption(option => option.setName('type').setDescription('Membership type').setRequired(true).addChoices(
      { name: 'Race Pass', value: 'race' },
      { name: 'Monthly', value: 'monthly' },
      { name: 'Yearly', value: 'yearly' },
    ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });

    try {
      const result = await grantMembership({
        client,
        guild: interaction.guild,
        user,
        type,
        grantedBy: interaction.user,
        source: '/grantmembership',
      });

      await interaction.reply({
        content: '✅ Membership granted successfully!\\n\\n' +
          '👤 Member: ' + user + '\\n' +
          '🎟️ Type: ' + result.membershipName + '\\n' +
          '⏰ Expires:\\n' +
          '<t:' + Math.floor(result.expiry.getTime() / 1000) + ':F>\\n' +
          '<t:' + Math.floor(result.expiry.getTime() / 1000) + ':R>',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Failed to grant membership:', error);
      return interaction.reply({ content: '❌ ' + (error?.message || 'Failed to grant membership.'), ephemeral: true });
    }
  },
};