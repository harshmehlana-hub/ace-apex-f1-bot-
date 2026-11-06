import { ActionRowBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { StickMessage } from '../database/models/StickMessage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stickstop')
    .setDescription('Stop one active repeating message (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const active = await StickMessage.find({ guildId: interaction.guildId, active: true }).sort({ createdAt: 1 }).limit(25);
    if (!active.length) {
      return interaction.reply({ content: 'There are no active /stickstart messages in this server.', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('stickstop:select')
      .setPlaceholder('Choose the repeating message to stop')
      .addOptions(active.map(item => ({
        label: `#${interaction.guild.channels.cache.get(item.channelId)?.name || 'deleted-channel'}`,
        description: item.message.replace(/\s+/g, ' ').slice(0, 100) || 'No message text',
        value: String(item._id),
      })));

    return interaction.reply({
      content: 'Select the active repeating message you want to stop. Other messages will keep running.',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  },
};

export async function handleStickStopInteraction(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'stickstop:select') return false;

  if (!interaction.inGuild() || !isAdmin(interaction.member, config.roles.admin)) {
    await interaction.reply({ content: '❌ You do not have permission to stop repeating messages.', ephemeral: true });
    return true;
  }

  const stopped = await StickMessage.findOneAndUpdate(
    { _id: interaction.values[0], guildId: interaction.guildId, active: true },
    { $set: { active: false } },
    { new: true }
  );

  await interaction.update({
    content: stopped
      ? `✅ Repeating message in <#${stopped.channelId}> has been stopped.`
      : 'That repeating message is already stopped or no longer exists.',
    components: [],
  });
  return true;
}
