import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

const commandData = new SlashCommandBuilder()
  .setName('bulkkick')
  .setDescription('Review and kick up to 10 selected server members (Admin only)');

for (let number = 1; number <= 10; number++) {
  commandData.addUserOption(option =>
    option
      .setName(`user${number}`)
      .setDescription(`Member to kick — selection ${number}`)
      .setRequired(false)
  );
}

commandData
  .addStringOption(option =>
    option.setName('reason').setDescription('Reason for the kicks').setRequired(false).setMaxLength(400)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export default {
  data: commandData,

  async execute(interaction) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: '❌ I need the Kick Members permission to do this.', ephemeral: true });
    }

    const targets = new Map();
    for (let number = 1; number <= 10; number++) {
      const user = interaction.options.getUser(`user${number}`);
      if (user) targets.set(user.id, user);
    }
    if (!targets.size) {
      return interaction.reply({ content: '❌ Select at least one member in the user1–user10 fields.', ephemeral: true });
    }

    const reason = interaction.options.getString('reason') || 'Bulk moderation action';
    const eligible = [];
    const skipped = [];

    for (const user of targets.values()) {
      if (user.id === interaction.user.id || user.id === interaction.client.user.id || user.id === interaction.guild.ownerId) {
        skipped.push(`${user.tag} — protected account`);
        continue;
      }
      try {
        const member = await interaction.guild.members.fetch(user.id);
        if (!member.kickable) skipped.push(`${user.tag} — role hierarchy or permissions`);
        else eligible.push(member);
      } catch {
        skipped.push(`${user.tag} — not found in this server`);
      }
    }

    if (!eligible.length) {
      return interaction.reply({ content: '❌ No eligible members were found.\\n' + skipped.join('\\n'), ephemeral: true });
    }

    const preview = eligible.map((member, index) => `${index + 1}. ${member.user.tag} (${member.id})`).join('\\n');
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bulkkick:confirm').setLabel(`Confirm kick ${eligible.length}`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('bulkkick:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      content: `**Review bulk kick**\\n\\n${preview}\\n\\n**Reason:** ${reason}${skipped.length ? `\\n\\n**Skipped:**\\n${skipped.join('\\n')}` : ''}\\n\\nConfirm to kick only the eligible members listed above.`,
      components: [buttons],
      ephemeral: true,
    });

    const response = await interaction.fetchReply();
    try {
      const confirmation = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 60000,
        filter: button => button.user.id === interaction.user.id,
      });

      if (confirmation.customId === 'bulkkick:cancel') {
        return confirmation.update({ content: 'Bulk kick cancelled. No members were kicked.', components: [] });
      }

      await confirmation.update({ content: `⏳ Kicking ${eligible.length} approved member(s)…`, components: [] });
      const kicked = [];
      const failed = [];

      for (const target of eligible) {
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

      const lines = [
        '**Bulk kick completed.**',
        `✅ Kicked: **${kicked.length}**`,
        `❌ Failed: **${failed.length}**`,
      ];
      if (kicked.length) lines.push('', '**Kicked members:**', ...kicked);
      if (failed.length) lines.push('', '**Failed:**', ...failed);
      const result = lines.join('\\n');
      await confirmation.editReply({
        content: result.length <= 1900 ? result : `**Bulk kick completed.**\\n✅ Kicked: **${kicked.length}**\\n❌ Failed: **${failed.length}**\\nThe full member-by-member result exceeded Discord's message limit.`,
        components: [],
      });
    } catch (error) {
      if (error?.code === 'InteractionCollectorError') {
        await interaction.editReply({ content: '⌛ Confirmation expired. No members were kicked.', components: [] }).catch(() => {});
      } else {
        throw error;
      }
    }
  },
};
