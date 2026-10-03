import { SlashCommandBuilder } from 'discord.js';
import { getUserRank } from '../services/leaderboardService.js';
import { User } from '../database/models/User.js';
import { createRankEmbed } from '../utils/embeds.js';
import { getCurrentSeason } from '../services/seasonService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Display user statistics and ranking')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check (defaults to yourself)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const season = await getCurrentSeason();
    const rankData = await getUserRank(targetUser.id, season);
    
    if (!rankData || !rankData.standing) {
      return interaction.reply({
        embeds: [createRankEmbed({ username: targetUser.username, totalPoints: 0, perfectPredictions: 0 }, 'Unranked', 0, season)],
      });
    }

    const rankUser = { username: targetUser.username, totalPoints: rankData.standing.totalPoints, perfectPredictions: rankData.standing.perfectPodiums };
    const embed = createRankEmbed(rankUser, rankData.rank, rankData.totalUsers, season);

    await interaction.reply({ embeds: [embed] });
  },
};
