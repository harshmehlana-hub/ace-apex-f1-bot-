import cron from 'node-cron';
import { Race } from '../database/models/Race.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';
import {
  createRaceAnnouncementEmbed,
  createQualifyingAnnouncementEmbed,
} from '../utils/embeds.js';

export function setupScheduler(client) {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await updateRaceStatuses(client);
    await updateQualifyingStatuses(client);
  });

  console.log('Scheduler initialized');
}

async function updateRaceStatuses(client) {
  const now = new Date();

  // Open races
  const racesToOpen = await Race.find({
    status: 'upcoming',
    predictionOpenTime: { $lte: now },
  });

  for (const race of racesToOpen) {
    race.status = 'open';
    await race.save();

    if (!race.announcementSent) {
      await sendPredictionOpenAnnouncement(client, race);

      race.announcementSent = true;
      await race.save();
    }
  }

  // Close races
  const racesToClose = await Race.find({
    status: 'open',
    predictionCloseTime: { $lte: now },
  });

  for (const race of racesToClose) {
    race.status = 'closed';
    await race.save();
  }
}

async function updateQualifyingStatuses(client) {
  const now = new Date();

  // Open qualifying sessions
  const sessionsToOpen = await Qualifying.find({
    status: 'upcoming',
    predictionOpenTime: { $lte: now },
  });

  for (const qualifying of sessionsToOpen) {
    qualifying.status = 'open';
    await qualifying.save();

    if (!qualifying.announcementSent) {
      await sendQualifyingOpenAnnouncement(
        client,
        qualifying
      );

      qualifying.announcementSent = true;
      await qualifying.save();
    }
  }

  // Close qualifying sessions
  const sessionsToClose = await Qualifying.find({
    status: 'open',
    predictionCloseTime: { $lte: now },
  });

  for (const qualifying of sessionsToClose) {
    qualifying.status = 'closed';
    await qualifying.save();
  }
}

async function sendPredictionOpenAnnouncement(
  client,
  race
) {
  try {
    const channel = await client.channels.fetch(
      config.channels.announcements
    );

    if (!channel) return;

    const embed = createRaceAnnouncementEmbed(race);

    await channel.send({
      content: '@everyone',
      embeds: [embed],
    });
  } catch (error) {
    console.error(
      'Failed to send prediction announcement:',
      error
    );
  }
}

async function sendQualifyingOpenAnnouncement(
  client,
  qualifying
) {
  try {
    const channel = await client.channels.fetch(
      config.channels.announcements
    );

    if (!channel) return;

    const embed =
      createQualifyingAnnouncementEmbed(
        qualifying
      );

    await channel.send({
      content: '@everyone',
      embeds: [embed],
    });
  } catch (error) {
    console.error(
      'Failed to send qualifying announcement:',
      error
    );
  }
}