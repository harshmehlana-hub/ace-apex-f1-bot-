import { SlashCommandBuilder } from 'discord.js';
import { startPurchase } from '../services/purchaseMembershipService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('purchasemembership')
    .setDescription('Purchase an Ace\'s Apex membership'),

  async execute(interaction, client) {
    await startPurchase(interaction, client);
  },
};