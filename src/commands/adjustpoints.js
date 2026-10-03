import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { User } from '../database/models/User.js';
import { PointTransaction } from '../database/models/PointTransaction.js';
import { getCurrentSeason } from '../services/seasonService.js';
import { rebuildSeasonStanding } from '../services/seasonStandingService.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { runInTransaction } from '../services/scoringService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('adjustpoints')
    .setDescription('Add or remove points from a user (Admin only)')
    .addUserOption(option => option.setName('user').setDescription('User to adjust points for').setRequired(true))
    .addIntegerOption(option => option.setName('points').setDescription('Points to add/remove').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for adjustment').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    // Point reconciliation can take longer than Discord's initial 3-second response window.
    // Acknowledge immediately, then edit the response when the adjustment is complete.
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('user');
    const requestedPoints = interaction.options.getInteger('points');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const season = await getCurrentSeason();

    const user = await User.findOneAndUpdate({ discordId: targetUser.id }, { $set: { username: targetUser.username } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const currentStanding = await rebuildSeasonStanding(targetUser.id, season);
    let amount = requestedPoints;
    if (currentStanding.totalPoints + amount < 0) amount = -currentStanding.totalPoints;

    if (amount === 0) return interaction.editReply({ content: '❌ This adjustment would not change the user\'s season score.' });

    await runInTransaction(async session => {
      await PointTransaction.create([{
        userId: user.discordId,
        season,
        amount,
        sourceType: 'admin_adjustment',
        sourceId: `${interaction.id}:${Date.now()}`,
        reason,
        createdBy: interaction.user.id,
      }], { session });
      await rebuildSeasonStanding(user.discordId, season, { session });
    });

    const updated = await rebuildSeasonStanding(targetUser.id, season);
    try {
      const logsChannel = await client.channels.fetch(config.channels.logs);
      if (logsChannel) await logsChannel.send(`📝 **Points Adjusted**\n👤 User: <@${targetUser.id}>\n⚙️ Admin: <@${interaction.user.id}>\n📈 Change: ${amount > 0 ? '+' : ''}${amount}\n🏆 Season ${season}: ${currentStanding.totalPoints} → ${updated.totalPoints}\n📄 Reason: ${reason}`);
    } catch (error) { console.error('Failed to send log message:', error); }

    await interaction.editReply({ content: `✅ **Season points updated**\n\n👤 User: <@${targetUser.id}>\n📅 Season: ${season}\n📈 Change: ${amount > 0 ? '+' : ''}${amount}\n🏆 Total: ${currentStanding.totalPoints} → ${updated.totalPoints}\n📄 Reason: ${reason}` });
  },
};
