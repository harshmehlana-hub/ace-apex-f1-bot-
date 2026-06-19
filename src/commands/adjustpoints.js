import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { User } from '../database/models/User.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

export default {
  data: new SlashCommandBuilder()
    .setName('adjustpoints')
    .setDescription('Add or remove points from a user (Admin only)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to adjust points for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('points')
        .setDescription('Points to add/remove (use negative numbers to remove)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for adjustment')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const points = interaction.options.getInteger('points');
    const reason =
      interaction.options.getString('reason') || 'No reason provided';

    let user = await User.findOne({
      discordId: targetUser.id,
    });

    if (!user) {
      user = await User.create({
        discordId: targetUser.id,
        username: targetUser.username,
        totalPoints: 0,
        perfectPredictions: 0,
        pointsReachedAt: new Date(),
      });
    }

    const oldPoints = user.totalPoints;

    user.totalPoints += points;

    if (user.totalPoints < 0) {
      user.totalPoints = 0;
    }

    user.pointsReachedAt = new Date();

    await user.save();

    try {
      const logsChannel = await client.channels.fetch(
        config.channels.logs
      );

      if (logsChannel) {
        await logsChannel.send(
          `📝 **Points Adjusted**\n` +
            `👤 User: <@${targetUser.id}>\n` +
            `⚙️ Admin: <@${interaction.user.id}>\n` +
            `📈 Change: ${points > 0 ? '+' : ''}${points}\n` +
            `🏆 Total: ${oldPoints} → ${user.totalPoints}\n` +
            `📄 Reason: ${reason}`
        );
      }
    } catch (error) {
      console.error('Failed to send log message:', error);
    }

    await interaction.reply({
      content:
        `✅ **Points Updated Successfully**\n\n` +
        `👤 User: <@${targetUser.id}>\n` +
        `📈 Change: ${points > 0 ? '+' : ''}${points}\n` +
        `🏆 Total: ${oldPoints} → ${user.totalPoints}\n` +
        `📄 Reason: ${reason}`,
      ephemeral: true,
    });
  },
};