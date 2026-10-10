import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';
import { getCurrentSeason } from '../services/seasonService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('extendtime')
    .setDescription('Extend the prediction deadline for an active race or qualifying session (Admin only)')
    .addIntegerOption(option => option.setName('minutes').setDescription('Minutes to add to the prediction deadline').setRequired(true).setMinValue(1).setMaxValue(1440))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!isAdmin(interaction.member, config.roles.admin)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const minutes = interaction.options.getInteger('minutes');
    const season = await getCurrentSeason();
    const now = new Date();
    const [races, sessions] = await Promise.all([
      Race.find({ season, status: 'open', predictionOpenTime: { $lte: now }, predictionCloseTime: { $lte: now } }).sort({ predictionCloseTime: 1 }).limit(25),
      Qualifying.find({ season, status: 'open', predictionOpenTime: { $lte: now }, predictionCloseTime: { $gt: now } }).sort({ predictionCloseTime: 1 }).limit(25),
    ]);

    const choices = [
      ...races.map(race => ({ label: ('Race: ' + race.name).slice(0, 100), value: 'race:' + race._id, description: ('Closes ' + race.predictionCloseTime.toISOString()).slice(0, 100) })),
      ...sessions.map(session => ({ label: ('Qualifying: ' + session.name).slice(0, 100), value: 'qualifying:' + session._id, description: ('Closes ' + session.predictionCloseTime.toISOString()).slice(0, 100) })),
    ].slice(0, 25);

    if (!choices.length) {
      return interaction.reply({ content: '❌ There are no race or qualifying sessions with pending results to extend right now.', ephemeral: true });
    }

    const customId = 'extendtime:' + interaction.id;
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('Choose a session with pending results').addOptions(choices)
    );
    await interaction.reply({ content: '⏱️ Select a session with pending results to extend by **' + minutes + ' minute(s)**:', components: [row], ephemeral: true });
    const response = await interaction.fetchReply();

    try {
      const selection = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60_000,
        filter: i => i.user.id === interaction.user.id && i.customId === customId,
      });
      const [type, id] = selection.values[0].split(':');
      const Model = type === 'race' ? Race : type === 'qualifying' ? Qualifying : null;
      if (!Model) return selection.update({ content: '❌ Invalid session selection.', components: [] });

      const session = await Model.findOne({ _id: id, season, status: 'open', predictionCloseTime: { $lte: new Date() } });
      if (!session) {
        return selection.update({ content: '❌ That session no longer has a closed prediction window with pending results. Run /extendtime again.', components: [] });
      }

      const oldCloseTime = new Date(session.predictionCloseTime);
      session.predictionCloseTime = new Date(oldCloseTime.getTime() + minutes * 60_000);
      await session.save();

      try {
        const logsChannel = await client.channels.fetch(config.channels.logs);
        if (logsChannel) await logsChannel.send(
          '⏱️ **Prediction Deadline Extended**\n' +
          '🏁 Session: **' + session.name + '** (' + (type === 'race' ? 'Race' : 'Qualifying') + ')\n' +
          '👤 Admin: <@' + interaction.user.id + '>\n' +
          '➕ Extension: **' + minutes + ' minute(s)**\n' +
          '🕒 Previous deadline: <t:' + Math.floor(oldCloseTime.getTime() / 1000) + ':F>\n' +
          '🕒 New deadline: <t:' + Math.floor(session.predictionCloseTime.getTime() / 1000) + ':F>'
        );
      } catch (error) {
        console.error('Failed to log prediction deadline extension:', error);
      }

      try {
        const announcementsChannel = await client.channels.fetch(config.channels.announcements);
        if (!announcementsChannel) throw new Error('Prediction announcements channel not found');
        await announcementsChannel.send({
          content: '@everyone\\nDue to delayed start the prediction time for ' + session.name + ' is extended by ' + minutes + ' minutes.',
          allowedMentions: { parse: ['everyone'] },
        });
      } catch (error) {
        console.error('Failed to announce prediction deadline extension:', error);
      }

      return selection.update({
        content: '✅ Extended predictions for **' + session.name + '** by **' + minutes + ' minute(s)**.\n\n' +
          'Previous deadline: <t:' + Math.floor(oldCloseTime.getTime() / 1000) + ':F>\n' +
          'New deadline: <t:' + Math.floor(session.predictionCloseTime.getTime() / 1000) + ':F>',
        components: [],
      });
    } catch (error) {
      if (error?.name === 'InteractionCollectorError' || error?.code === 'InteractionCollectorError') {
        return interaction.editReply({ content: '⏰ Session selection timed out. Run /extendtime again.', components: [] }).catch(() => {});
      }
      throw error;
    }
  },
};
