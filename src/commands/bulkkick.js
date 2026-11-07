import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

const PAGE_SIZE = 15;

function selectionRow() {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId('bulkkick:select')
      .setPlaceholder('Search and select server members')
      .setMinValues(1)
      .setMaxValues(25),
  );
}

function menuButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bulkkick:add').setLabel('Add more members').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bulkkick:review').setLabel('Review list').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bulkkick:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
}

function reviewRows(page, totalPages) {
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder().setCustomId('bulkkick:previous').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('bulkkick:next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
    new ButtonBuilder().setCustomId('bulkkick:confirm').setLabel('Confirm kick').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('bulkkick:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  return row;
}

function reviewText(members, page, reason) {
  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const pageMembers = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const lines = pageMembers.map((member, index) => `${page * PAGE_SIZE + index + 1}. ${member.user.tag} — \`${member.id}\``);
  return {
    content: `**Review bulk kick — ${members.length} member(s)** (Page ${page + 1}/${totalPages})\\n\\n${lines.join('\\n')}\\n\\n**Reason:** ${reason}\\nReview every page, then select **Confirm kick** to proceed.`,
    components: [reviewRows(page, totalPages)],
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName('bulkkick')
    .setDescription('Search, review, and kick multiple server members (Admin only)')
    .addStringOption(option => option.setName('reason').setDescription('Reason for the kicks').setRequired(false).setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: '❌ I need the Kick Members permission to do this.', ephemeral: true });
    }

    const reason = interaction.options.getString('reason') || 'Bulk moderation action';
    const selected = new Map();
    let page = 0;

    await interaction.reply({
      content: 'Use the member picker below to search by server display name or username and select up to 25 members at a time. You can add more batches; there is no overall selection limit.',
      components: [selectionRow()],
      ephemeral: true,
    });
    const response = await interaction.fetchReply();

    while (true) {
      let component;
      try {
        component = await response.awaitMessageComponent({
          time: 180000,
          filter: item => item.user.id === interaction.user.id,
        });
      } catch {
        await interaction.editReply({ content: '⌛ Bulk kick selection expired. No members were kicked.', components: [] }).catch(() => {});
        return;
      }

      if (component.customId === 'bulkkick:cancel') {
        await component.update({ content: 'Bulk kick cancelled. No members were kicked.', components: [] });
        return;
      }

      if (component.customId === 'bulkkick:select') {
        for (const id of component.values) {
          if (selected.has(id) || id === interaction.user.id || id === interaction.client.user.id || id === interaction.guild.ownerId) continue;
          try {
            const member = await interaction.guild.members.fetch(id);
            if (member.kickable) selected.set(id, member);
          } catch {
            // A member may have left or may no longer be accessible.
          }
        }
        await component.update({
          content: `Added eligible members. **${selected.size}** unique member(s) selected so far. Choose another batch or review the list.`,
          components: [menuButtons()],
        });
        continue;
      }

      if (component.customId === 'bulkkick:add') {
        await component.update({
          content: `Select another batch of members. **${selected.size}** already selected; duplicates and protected accounts are ignored.`,
          components: [selectionRow()],
        });
        continue;
      }

      if (component.customId === 'bulkkick:review') {
        if (!selected.size) {
          await component.update({ content: 'No eligible members selected yet. Add at least one member to continue.', components: [selectionRow()] });
          continue;
        }
        page = 0;
        const members = [...selected.values()];
        const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
        await component.update(reviewText(members, page, reason));

        while (true) {
          let reviewAction;
          try {
            reviewAction = await response.awaitMessageComponent({
              time: 180000,
              filter: item => item.user.id === interaction.user.id,
            });
          } catch {
            await interaction.editReply({ content: '⌛ Bulk kick review expired. No members were kicked.', components: [] }).catch(() => {});
            return;
          }

          if (reviewAction.customId === 'bulkkick:cancel') {
            await reviewAction.update({ content: 'Bulk kick cancelled. No members were kicked.', components: [] });
            return;
          }
          if (reviewAction.customId === 'bulkkick:previous' || reviewAction.customId === 'bulkkick:next') {
            page = Math.max(0, Math.min(totalPages - 1, page + (reviewAction.customId === 'bulkkick:next' ? 1 : -1)));
            await reviewAction.update(reviewText(members, page, reason));
            continue;
          }
          if (reviewAction.customId !== 'bulkkick:confirm') continue;

          await reviewAction.update({ content: `⏳ Kicking ${members.length} approved member(s)…`, components: [] });
          const kicked = [];
          const failed = [];
          for (const target of members) {
            try {
              const currentMember = await interaction.guild.members.fetch(target.id);
              if (!currentMember.kickable) {
                failed.push(`${target.user.tag} (${target.id}) — no longer kickable`);
                continue;
              }
              await currentMember.kick(reason);
              kicked.push(`${target.user.tag} (${target.id})`);
            } catch (error) {
              failed.push(`${target.user.tag} (${target.id}) — ${error?.message || 'kick failed'}`);
            }
          }

          const resultLines = [
            '**Bulk kick completed.**',
            `✅ Kicked: **${kicked.length}**`,
            `❌ Failed: **${failed.length}**`,
          ];
          if (kicked.length) resultLines.push('', '**Kicked members:**', ...kicked);
          if (failed.length) resultLines.push('', '**Failed:**', ...failed);
          const result = resultLines.join('\\n');
          await interaction.editReply({
            content: result.length > 1900 ? `**Bulk kick completed.**\\n✅ Kicked: **${kicked.length}**\\n❌ Failed: **${failed.length}**\\nThe full per-member result was too long to display.` : result,
            components: [],
          });
          return;
        }
      }
    }
  },
};
