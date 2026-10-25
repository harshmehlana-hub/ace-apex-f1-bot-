import { SlashCommandBuilder } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Result } from '../database/models/Result.js';
import { Prediction } from '../database/models/Prediction.js';
import { createPredictionEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('showprediction')
    .setDescription('View a prediction from the most recently resulted race')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User whose prediction to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Only expose predictions from races with official results entered.
    // This prevents users from copying predictions for upcoming races.
    const resultedRaceIds = await Result.find().select('raceId').lean();
    if (!resultedRaceIds.length) {
      return interaction.reply({
        content: '❌ No race results have been recorded yet, so there is no previous-race prediction to show.',
        ephemeral: true,
      });
    }

    const raceIdSet = resultedRaceIds.map(result => result.raceId);
    const race = await Race.findOne({ _id: { $in: raceIdSet } }).sort({ raceStartTime: -1 });
    if (!race) {
      return interaction.reply({
        content: '❌ Could not find the most recently resulted race.',
        ephemeral: true,
      });
    }

    const prediction = await Prediction.findOne({
      userId: targetUser.id,
      raceId: race._id,
    }).populate('raceId');

    if (!prediction) {
      return interaction.reply({
        content: `❌ No prediction found for ${targetUser.username} for the last resulted race: **${race.name}**.`,
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [createPredictionEmbed(race, prediction, targetUser)],
    });
  },
};
