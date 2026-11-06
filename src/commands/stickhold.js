import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { StickMessage } from '../database/models/StickMessage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stickhold')
    .setDescription('Pause, resume, or stop a repeating message (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const messages = await StickMessage.find({
      guildId: interaction.guildId,
      $or: [{ active: true }, { paused: true }],
    }).sort({ createdAt: 1 }).limit(25);

    if (!messages.length) {
      return interaction.reply({ content: 'There are no active or paused repeating messages in this server.', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('stickhold:select')
      .setPlaceholder('Choose a repeating message to manage')
      .addOptions(messages.map(item => ({
        label: `#${interaction.guild.channels.cache.get(item.channelId)?.name || 'deleted-channel'} — ${item.paused ? 'PAUSED' : 'ACTIVE'}`.slice(0, 100),
        description: item.message.replace(/\s+/g, ' ').slice(0, 100) || 'No message text',
        value: String(item._id),
      })));

    return interaction.reply({
      content: 'Choose a repeating message. You can then pause it, resume it, or stop it permanently.',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  },
};

export async function handleStickHoldInteraction(interaction) {
  if (!interaction.inGuild() || !isAdmin(interaction.member, config.roles.admin)) {
    await interaction.reply({ content: '❌ You do not have permission to manage repeating messages.', ephemeral: true });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'stickhold:select') {
    const item = await StickMessage.findOne({
      _id: interaction.values[0],
      guildId: interaction.guildId,
      $or: [{ active: true }, { paused: true }],
    });
    if (!item) {
      await interaction.update({ content: 'That repeating message is no longer available.', components: [] });
      return true;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`stickhold:pause:${item._id}`).setLabel('Pause').setStyle(ButtonStyle.Secondary).setDisabled(!item.active),
      new ButtonBuilder().setCustomId(`stickhold:resume:${item._id}`).setLabel('Resume').setStyle(ButtonStyle.Success).setDisabled(!item.paused),
      new ButtonBuilder().setCustomId(`stickhold:stop:${item._id}`).setLabel('Stop').setStyle(ButtonStyle.Danger),
    );

    await interaction.update({
      content: `Selected message in <#${item.channelId}> (currently ${item.paused ? 'paused' : 'active'}):\n> ${item.message.slice(0, 1500)}\n\nChoose an action:`,
      components: [row],
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId?.startsWith('stickhold:')) {
    const [, action, id] = interaction.customId.split(':');
    if (!['pause', 'resume', 'stop'].includes(action)) return false;

    let item;
    if (action === 'stop') {
      item = await StickMessage.findOneAndDelete({
        _id: id,
        guildId: interaction.guildId,
        $or: [{ active: true }, { paused: true }],
      });
    } else if (action === 'pause') {
      item = await StickMessage.findOneAndUpdate(
        { _id: id, guildId: interaction.guildId, active: true },
        { $set: { active: false, paused: true } },
        { new: true }
      );
    } else {
      item = await StickMessage.findOneAndUpdate(
        { _id: id, guildId: interaction.guildId, paused: true },
        { $set: { active: true, paused: false, nextSendAt: new Date(Date.now() + (15) * 60 * 1000) } },
        { new: true }
      );
    }

    if (!item) {
      await interaction.update({ content: 'That repeating message has already been changed or no longer exists.', components: [] });
      return true;
    }

    const result = action === 'pause'
      ? `⏸️ Repeating message in <#${item.channelId}> is paused. You can resume it later with /stickhold.`
      : action === 'resume'
        ? `▶️ Repeating message in <#${item.channelId}> is resumed. It will send again after ${item.intervalMinutes || 15} minute(s), then continue on its saved frequency.`
        : `🛑 Repeating message in <#${item.channelId}> has been stopped and removed permanently.`;

    await interaction.update({ content: result, components: [] });
    return true;
  }

  return false;
}
