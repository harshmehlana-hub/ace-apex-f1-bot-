import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { getSeasonLeaderboard } from '../services/leaderboardService.js';
import { createLeaderboardEmbed } from '../utils/embeds.js';

const USERS_PER_PAGE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the current season standings'),
  
  async execute(interaction) {
    const leaderboard = await getSeasonLeaderboard();
    
    if (leaderboard.length === 0) {
      return interaction.reply({
        content: '📊 No predictions have been scored yet. The leaderboard is empty.',
        ephemeral: true,
      });
    }
    
    const totalPages = Math.ceil(leaderboard.length / USERS_PER_PAGE);
    let currentPage = 1;
    
    const getComponents = (page) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages)
      );
      return totalPages > 1 ? [row] : [];
    };
    
    const response = await interaction.reply({
      embeds: [createLeaderboardEmbed(leaderboard, currentPage, USERS_PER_PAGE)],
      components: getComponents(currentPage),
    });
    
    if (totalPages <= 1) return;
    
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });
    
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: '❌ Only the command user can navigate pages.',
          ephemeral: true,
        });
      }
      
      if (i.customId === 'prev') currentPage--;
      if (i.customId === 'next') currentPage++;
      
      await i.update({
        embeds: [createLeaderboardEmbed(leaderboard, currentPage, USERS_PER_PAGE)],
        components: getComponents(currentPage),
      });
    });
    
    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
