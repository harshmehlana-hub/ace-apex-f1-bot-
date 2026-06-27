import cron from 'node-cron';
import { Race } from '../database/models/Race.js';
import { Reminder } from '../database/models/Reminder.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { Announcement } from '../database/models/Announcement.js';
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
    await processReminders(client);
    await processAnnouncements(client);
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
      content: '@everyone 🏁 Race Predictions are now LIVE!',
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
      content: '@everyone 🏁 Qualifying Predictions are now LIVE!',
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
async function processReminders(client) {
  const now = new Date();

  const reminders = await Reminder.find({
    sent: false,
    remindAt: { $lte: now },
  });

  for (const reminder of reminders) {
    try {
      const channel = await client.channels.fetch(
        reminder.channelId
      );

      if (channel) {
        await channel.send({
          content:
            `<@${reminder.userId}>\n\n` +
            `⚠️ **Reminder**\n\n` +
            reminder.message,
        });
      }

      reminder.sent = true;
      await reminder.save();
    } catch (error) {
      console.error(
        'Failed to send reminder:',
        error
      );
    }
  }
}
async function processAnnouncements(client) {
  const now = new Date();

  const announcements = await Announcement.find({
    nextAnnouncementAt: { $lte: now },
  });

  for (const announcement of announcements) {
    // Stop if prediction has already closed
    if (now >= announcement.predictionCloseTime) {
      await announcement.deleteOne();
      continue;
    }

    try {
      const channel = await client.channels.fetch(
        announcement.channelId
      );

      if (!channel) continue;

      const command =
        announcement.type === 'race'
          ? '/predict'
          : '/predictqualifying';

      const title =
        announcement.type === 'race'
          ? '🏎️ Race Predictions are OPEN!'
          : '🏁 Qualifying Predictions are OPEN!';

      await channel.send({
        content:
          `@everyone ${title}\n\n` +
          `Predictions are now open for **${announcement.name}**.\n\n` +
          `Use \`${command}\` to submit your prediction.\n\n` +
          `⏰ Predictions close:\n` +
          `• <t:${Math.floor(
            announcement.predictionCloseTime.getTime() / 1000
          )}:R>\n` +
          `• <t:${Math.floor(
            announcement.predictionCloseTime.getTime() / 1000
          )}:F>`
      });

      // Schedule next reminder
      if (announcement.sendIndex === 0) {
        announcement.nextAnnouncementAt =
          new Date(now.getTime() + 3 * 60 * 60 * 1000);
      } else {
        announcement.nextAnnouncementAt =
          new Date(now.getTime() + 6 * 60 * 60 * 1000);
      }

      announcement.sendIndex += 1;

      // Finished all 5 announcements
      if (announcement.sendIndex >= 5) {
        await announcement.deleteOne();
      } else {
        await announcement.save();
      }

    } catch (error) {
      console.error(
        'Failed to send announcement:',
        error
      );
    }
  }
}