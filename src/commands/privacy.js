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
        'https://ace-apex-website.aceflarevisuals.workers.dev/privacy',
      ephemeral: true,
    });
  },
};