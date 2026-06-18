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
      
      try {
        await command.execute(interaction, client);
      } catch (error) {
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
