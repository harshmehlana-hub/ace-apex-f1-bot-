import cron from 'node-cron';
import { Race } from '../database/models/Race.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';
import {
  createRaceAnnouncementEmbed,
  createQualifyingAnnouncementEmbed,
  createPredictionStatisticsEmbed,
} from '../utils/embeds.js';
import { Prediction } from '../database/models/Prediction.js';

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
await sendPredictionStatistics(client, race);
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

async function sendPredictionStatistics(client, race) {
  try {
    const predictions = await Prediction.find({
      raceId: race._id,
    });

    if (predictions.length === 0) return;

    const totalPredictions = predictions.length;

    const p1Counts = {};
    const p2Counts = {};
    const p3Counts = {};

    for (const prediction of predictions) {
      p1Counts[prediction.p1Driver] =
        (p1Counts[prediction.p1Driver] || 0) + 1;

      p2Counts[prediction.p2Driver] =
        (p2Counts[prediction.p2Driver] || 0) + 1;

      p3Counts[prediction.p3Driver] =
        (p3Counts[prediction.p3Driver] || 0) + 1;
    }

    const topP1 = Object.entries(p1Counts)
      .sort((a, b) => b[1] - a[1])[0];

    const topP2 = Object.entries(p2Counts)
      .sort((a, b) => b[1] - a[1])[0];

    const topP3 = Object.entries(p3Counts)
      .sort((a, b) => b[1] - a[1])[0];

    const channel = await client.channels.fetch(
      config.channels.statistics
    );

    if (!channel) return;

    const embed = createPredictionStatisticsEmbed(
      race,
      totalPredictions,

      topP1[0],
      topP1[1],
      ((topP1[1] / totalPredictions) * 100).toFixed(1),

      topP2[0],
      topP2[1],
      ((topP2[1] / totalPredictions) * 100).toFixed(1),

      topP3[0],
      topP3[1],
      ((topP3[1] / totalPredictions) * 100).toFixed(1)
    );

    await channel.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error(
      'Failed to send prediction statistics:',
      error
    );
  }
}