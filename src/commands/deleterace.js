import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Prediction } from '../database/models/Prediction.js';
import { Result } from '../database/models/Result.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('deleterace')
    .setDescription('Delete a race and all associated data (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }
    
    const races = await Race.find().sort({ raceStartTime: -1 });
    
    if (races.length === 0) {
      return interaction.reply({
        content: '❌ There are no races to delete.',
        ephemeral: true,
      });
    }
    
    const raceOptions = races.map(race => ({
      label: race.name,
      description: `Status: ${race.status}`,
      value: race._id.toString(),
    }));
    
    const raceSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('race_select')
        .setPlaceholder('Select race to delete')
        .addOptions(raceOptions.slice(0, 25)) // Discord limit
    );
    
    const response = await interaction.reply({
      content: '🗑️ **Select race to delete:**\n⚠️ This will permanently delete all predictions and results.',
      components: [raceSelect],
      ephemeral: true,
    });
    
    try {
      const raceInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });
      
      const selectedRaceId = raceInteraction.values[0];
      const selectedRace = races.find(r => r._id.toString() === selectedRaceId);
      
      // Confirmation
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_delete')
          .setLabel('Yes, Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
      
      await raceInteraction.update({
        content: `⚠️ **Are you sure you want to delete "${selectedRace.name}"?**\n\nThis action cannot be undone.`,
        components: [confirmRow],
      });
      
      const confirmInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 30000,
      });
      
      if (confirmInteraction.customId === 'cancel_delete') {
        return confirmInteraction.update({
          content: '❌ Deletion cancelled.',
          components: [],
        });
      }
      
      // Delete all associated data
      await Prediction.deleteMany({ raceId: selectedRaceId });
      await Result.deleteOne({ raceId: selectedRaceId });
      await Race.deleteOne({ _id: selectedRaceId });
      
      await confirmInteraction.update({
        content: `✅ **"${selectedRace.name}"** has been deleted along with all predictions and results.`,
        components: [],
      });
      
    } catch (error) {
      if (error.code === 'InteractionCollectorError') {
        await interaction.editReply({
          content: '⏰ Operation timed out.',
          components: [],
        });
      } else {
        throw error;
      }
    }
  },
};
