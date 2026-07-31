import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription("View the bot's privacy policy"),

  async execute(interaction) {
    await interaction.reply({
      content:
        '🔒 **Privacy Policy**\n\n' +
        'You can view our privacy policy here:\n' +
        'https://gist.githubusercontent.com/harshmehlana-hub/41b8aa247a59e674315419165582909a/raw/d79b0fcc407cf1c18d9550fa5bcc3969b4062151/gistfile1.txt',
      ephemeral: true,
    });
  },
};