import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { startSaleSetup } from '../services/saleService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sale')
    .setDescription('Configure and activate the current sale (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.inGuild() || !isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to configure a sale.', ephemeral: true });
    }
    await startSaleSetup(interaction);
  },
};
