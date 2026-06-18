import { SlashCommandBuilder } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Prediction } from '../database/models/Prediction.js';
import { createPredictionEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('showprediction')
    .setDescription('View a prediction for a race')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User whose prediction to view (defaults to yourself)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('race')
        .setDescription('Race name (shows most recent if not specified)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const raceName = interaction.options.getString('race');
    
    // Build query
    const query = { userId: targetUser.id };
    
    let race;
    if (raceName) {
      race = await Race.findOne({
        name: { $regex: new RegExp(raceName, 'i') },
      });
      if (!race) {
        return interaction.reply({
          content: `❌ No race found matching "${raceName}".`,
          ephemeral: true,
        });
      }
      query.raceId = race._id;
    }
    
    const prediction = await Prediction.findOne(query)
      .sort({ submittedAt: -1 })
      .populate('raceId');
    
    if (!prediction) {
      const message = raceName
        ? `❌ No prediction found for ${targetUser.username} for "${raceName}".`
        : `❌ No predictions found for ${targetUser.username}.`;
      return interaction.reply({ content: message, ephemeral: true });
    }
    
    race = prediction.raceId;
    
    const embed = createPredictionEmbed(race, prediction, targetUser);
    
    await interaction.reply({ embeds: [embed] });
  },
};
