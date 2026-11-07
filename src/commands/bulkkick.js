import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bulkkick')
    .setDescription('Review and kick multiple server members (Admin only)')
    .addStringOption(option => option.setName('user_ids').setDescription('Discord user IDs separated by commas, spaces, or new lines (up to 25)').setRequired(true).setMaxLength(4000))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the kicks').setRequired(false).setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '❌ I need the Kick Members permission to do this.', ephemeral: true });

    const rawIds = interaction.options.getString('user_ids');
    const ids = [...new Set(rawIds.split(/[\\s,;]+/).map(value => value.trim()).filter(Boolean))];
    const invalid = ids.filter(id => !/^\\d{17,20}$/.test(id));
    if (invalid.length) return interaction.reply({ content: '❌ Invalid Discord user IDs: ' + invalid.slice(0, 10).join(', '), ephemeral: true });
    if (!ids.length) return interaction.reply({ content: '❌ Please provide at least one Discord user ID.', ephemeral: true });
    if (ids.length > 25) return interaction.reply({ content: '❌ You can process up to 25 accounts per command. Split the list into smaller batches.', ephemeral: true });

    const reason = interaction.options.getString('reason') || 'Bulk moderation action';
    const eligible = [];
    const skipped = [];
    for (const id of ids) {
      if (id === interaction.user.id || id === interaction.client.user.id || id === interaction.guild.ownerId) { skipped.push(id + ' (protected account)'); continue; }
      try {
        const member = await interaction.guild.members.fetch(id);
        if (!member.kickable) skipped.push(member.user.tag + ' (role hierarchy or permissions)');
        else eligible.push(member);
      } catch { skipped.push(id + ' (not found in this server)'); }
    }
    if (!eligible.length) return interaction.reply({ content: '❌ No eligible server members were found to kick.\\n' + skipped.join('\\n'), ephemeral: true });

    const preview = eligible.map(member => '• ' + member.user.tag + ' (' + member.id + ')').join('\\n');
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bulk_kick_confirm').setLabel('Confirm kick ' + eligible.length + ' account(s)').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('bulk_kick_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: '**Review this bulk kick before confirming.**\\n\\n' + preview + '\\n\\n**Reason:** ' + reason + (skipped.length ? '\\n\\n**Skipped:**\\n' + skipped.join('\\n') : '') + '\\n\\nOnly the accounts listed above will be kicked.', components: [buttons], ephemeral: true });
    const response = await interaction.fetchReply();
    try {
      const confirmation = await response.awaitMessageComponent({ componentType: ComponentType.Button, time: 60000, filter: button => button.user.id === interaction.user.id });
      if (confirmation.customId === 'bulk_kick_cancel') return confirmation.update({ content: 'Bulk kick cancelled. No accounts were kicked.', components: [] });
      await confirmation.update({ content: '⏳ Processing the approved kick list…', components: [] });
      const kicked = []; const failed = [];
      for (const target of eligible) {
        try {
          const currentMember = await interaction.guild.members.fetch(target.id);
          if (!currentMember.kickable) { failed.push(target.user.tag + ' (no longer kickable)'); continue; }
          await currentMember.kick(reason); kicked.push(target.user.tag + ' (' + target.id + ')');
        } catch (error) { failed.push(target.user.tag + ' (' + (error?.message || 'kick failed') + ')'); }
      }
      await confirmation.editReply({ content: '**Bulk kick completed.**\\n✅ Kicked: **' + kicked.length + '**\\n❌ Failed: **' + failed.length + '**' + (kicked.length ? '\\n\\n**Kicked accounts:**\\n' + kicked.join('\\n') : '') + (failed.length ? '\\n\\n**Failed:**\\n' + failed.join('\\n') : ''), components: [] });
    } catch (error) {
      if (error?.code === 'InteractionCollectorError') await interaction.editReply({ content: '⌛ Confirmation expired. No accounts were kicked.', components: [] }).catch(() => {});
      else throw error;
    }
  },
};
