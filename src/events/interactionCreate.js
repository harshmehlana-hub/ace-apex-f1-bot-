import { auditAdminCommand } from '../services/auditService.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`Command ${interaction.commandName} not found`);
        return;
      }
      
      const adminAction = interaction.inGuild() && isAdmin(interaction.member, config.roles.admin);
      if (adminAction) await auditAdminCommand(interaction, 'started');
      try {
        await command.execute(interaction, client);
        if (adminAction) await auditAdminCommand(interaction, 'completed');
      } catch (error) {
        if (adminAction) await auditAdminCommand(interaction, 'failed', error);
        console.error(`Error executing ${interaction.commandName}:`, error);
        
        const errorMessage = {
          content: '❌ An error occurred while executing this command.',
          ephemeral: true,
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
    
    // Handle button interactions (for confirmation dialogs, etc.)
    if (interaction.isButton()) {
      // Button handling is done within individual commands
    }
    
    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      // Select menu handling is done within individual commands
    }
  },
};
