import { SlashCommandBuilder } from 'discord.js';
import { getUserRank } from '../services/leaderboardService.js';
import { User } from '../database/models/User.js';
import { createRankEmbed } from '../utils/embeds.js';

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
    
    const rankData = await getUserRank(targetUser.id);
    
    if (!rankData || !rankData.user) {
      // Create user entry if they don't exist
      const user = await User.findOneAndUpdate(
        { discordId: targetUser.id },
        {
          $setOnInsert: {
            discordId: targetUser.id,
            username: targetUser.username,
            totalPoints: 0,
            perfectPredictions: 0,
            pointsReachedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      
      return interaction.reply({
        embeds: [createRankEmbed(
          { username: targetUser.username, totalPoints: 0, perfectPredictions: 0 },
          'Unranked',
          0
        )],
      });
    }
    
    rankData.user.username = targetUser.username; // Ensure current username
    const embed = createRankEmbed(rankData.user, rankData.rank, rankData.totalUsers);
    
    await interaction.reply({ embeds: [embed] });
  },
};
