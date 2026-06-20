import { SlashCommandBuilder } from 'discord.js';

import { User } from '../database/models/User.js';
import { SeasonStanding } from '../database/models/SeasonStanding.js';
import { Prediction } from '../database/models/Prediction.js';
import { QualifyingPrediction } from '../database/models/QualifyingPrediction.js';

import { config } from '../config.js';
import { getSeasonRank } from '../services/leaderboardService.js';
import { createPredictionStatsEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('predictionstats')
    .setDescription('View season prediction statistics')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('season')
        .setDescription('Season (defaults to current season)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser =
      interaction.options.getUser('user') ||
      interaction.user;

    const season =
      interaction.options.getString('season') ||
      config.season;

    const user = await User.findOne({
      discordId: targetUser.id,
    });

    if (!user) {
      return interaction.reply({
        content:
          '❌ No prediction data found for this user.',
        ephemeral: true,
      });
    }

    const rankData = await getSeasonRank(
      targetUser.id,
      season
    );

    if (!rankData) {
      return interaction.reply({
        content:
          `❌ No statistics found for ${targetUser.username} in season ${season}.`,
        ephemeral: true,
      });
    }

    const standing = rankData.standing;

    const racePredictions =
      standing.racePredictionsSubmitted || 0;

    const qualifyingPredictions =
      standing.qualifyingPredictionsSubmitted || 0;

    const p1Accuracy =
      racePredictions > 0
        ? (
            (standing.correctP1Predictions /
              racePredictions) *
            100
          ).toFixed(1)
        : '0.0';

    const p2Accuracy =
      racePredictions > 0
        ? (
            (standing.correctP2Predictions /
              racePredictions) *
            100
          ).toFixed(1)
        : '0.0';

    const p3Accuracy =
      racePredictions > 0
        ? (
            (standing.correctP3Predictions /
              racePredictions) *
            100
          ).toFixed(1)
        : '0.0';

    const poleAccuracy =
      qualifyingPredictions > 0
        ? (
            (standing.correctPolePredictions /
              qualifyingPredictions) *
            100
          ).toFixed(1)
        : '0.0';

    const embed = createPredictionStatsEmbed(
      {
        username: targetUser.username,
      },
      season,
      rankData.rank,
      rankData.totalUsers,
      standing,
      p1Accuracy,
      p2Accuracy,
      p3Accuracy,
      poleAccuracy
    );

    await interaction.reply({
      embeds: [embed],
    });
  },
};