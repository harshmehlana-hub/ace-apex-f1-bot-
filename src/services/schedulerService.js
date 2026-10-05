import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { Routes } from 'discord.js';
import { Race } from '../database/models/Race.js';
import { Reminder } from '../database/models/Reminder.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { createRaceAnnouncementEmbed, createQualifyingAnnouncementEmbed, createPredictionStatisticsEmbed } from '../utils/embeds.js';
import { Prediction } from '../database/models/Prediction.js';
import { getCurrentSeason } from './seasonService.js';
import { processRacePasses, cancelRacePassesForRace } from './racePassService.js';
import { PaymentVerification } from '../database/models/PaymentVerification.js';
import { syncVerifiedPaymentToSheet } from './paymentSheetSyncService.js';
import { SchedulerLock } from '../database/models/SchedulerLock.js';

export function setupScheduler(client) {
  const run = async () => {
    const holder = await acquireSchedulerLock();
    if (!holder) return;
    try {
      await Promise.allSettled([
        updateRaceStatuses(client),
        updateQualifyingStatuses(client),
        processReminders(client),
        processMemberships(client),
        processRacePasses(client),
        processCancelledRacePasses(client),
        processGoogleSheetSync(client),
        processStalePaymentVerifications(),
      ]);
    } finally {
      await releaseSchedulerLock(holder);
    }
  };

  run().catch(error => console.error('Initial scheduler run failed:', error));
  cron.schedule('* * * * *', () => run().catch(error => console.error('Scheduler cycle failed:', error)));
  console.log('Scheduler initialized');
}


async function acquireSchedulerLock() {
  const now = new Date();
  const holder = randomUUID();
  const expiresAt = new Date(now.getTime() + 90 * 1000);

  const existing = await SchedulerLock.findOneAndUpdate(
    {
      _id: 'global',
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: { $exists: false } },
      ],
    },
    { $set: { holder, expiresAt } },
    { new: true }
  );

  if (existing) return holder;

  try {
    await SchedulerLock.create({ _id: 'global', holder, expiresAt });
    return holder;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function releaseSchedulerLock(holder) {
  await SchedulerLock.deleteOne({ _id: 'global', holder });
}

function getTimeStatus(openTime, closeTime, now) {
  if (now < openTime) return 'upcoming';
  if (now < closeTime) return 'open';
  return 'closed';
}

async function updateRaceStatuses(client) {
  const now = new Date();
  const season = await getCurrentSeason();
  const races = await Race.find({ season, status: { $in: ['upcoming', 'open', 'closed'] } });

  for (const race of races) {
    const desired = getTimeStatus(race.predictionOpenTime, race.predictionCloseTime, now);

    if (desired === 'open' && race.status !== 'open') {
      race.status = 'open';
      await race.save();
      await claimAndSendRaceAnnouncement(client, race);
    } else if (desired === 'closed' && race.status === 'open') {
      race.status = 'closed';
      await race.save();
      await claimAndSendStatistics(client, race);
    } else if (desired === 'closed' && race.status === 'upcoming') {
      race.status = 'closed';
      await race.save();
      await claimAndSendStatistics(client, race);
    }

    if (desired === 'open') {
      await processPredictionReminders(client, race, false);
    }
  }
}

async function updateQualifyingStatuses(client) {
  const now = new Date();
  const season = await getCurrentSeason();
  const sessions = await Qualifying.find({ season, status: { $in: ['upcoming', 'open', 'closed'] } });

  for (const qualifying of sessions) {
    const desired = getTimeStatus(qualifying.predictionOpenTime, qualifying.predictionCloseTime, now);
    if (desired === 'open' && qualifying.status !== 'open') {
      qualifying.status = 'open';
      await qualifying.save();
      await claimAndSendQualifyingAnnouncement(client, qualifying);
    } else if (desired === 'closed' && qualifying.status !== 'closed') {
      qualifying.status = 'closed';
      await qualifying.save();
    }

    if (desired === 'open') {
      await processPredictionReminders(client, qualifying, true);
    }
  }
}

async function processPredictionReminders(client, session, isQualifying) {
  const now = Date.now();
  const startTime = (isQualifying ? session.sessionStartTime : session.raceStartTime).getTime();
  const thresholds = [
    { key: 'reminder12hSent', offset: 12 * 60 * 60 * 1000, label: '12 hours' },
    { key: 'reminder6hSent', offset: 6 * 60 * 60 * 1000, label: '6 hours' },
    { key: 'reminder1hSent', offset: 60 * 60 * 1000, label: '1 hour' },
  ];

  // Allow a short catch-up window so a brief Railway restart does not permanently lose a reminder.
  // The window is intentionally much smaller than the gap between reminders.
  const reminderWindow = 10 * 60 * 1000;

  for (const reminder of thresholds) {
    const reminderAt = startTime - reminder.offset;
    if (
      Math.abs(now - reminderAt) > reminderWindow ||
      now >= startTime ||
      session[reminder.key]
    ) continue;

    const Model = isQualifying ? Qualifying : Race;
    const claimed = await Model.findOneAndUpdate(
      {
        _id: session._id,
        $or: [
          { [reminder.key]: false },
          { [reminder.key]: { $exists: false } },
        ],
      },
      { $set: { [reminder.key]: true } },
      { new: true }
    );
    if (!claimed) continue;

    try {
      const channel = await client.channels.fetch(config.channels.announcements);
      if (!channel) throw new Error('Announcement channel not found');

      const command = isQualifying ? '/predictqualifying' : '/predict';
      const type = isQualifying ? 'Qualifying predictions' : 'Race predictions';
      await channel.send({
        content: `@everyone ⏰ **${reminder.label} remaining** to submit your ${type.toLowerCase()} for **${session.name}**. Use ${command} and submit now!`,
      });
    } catch (error) {
      await Model.updateOne({ _id: session._id }, { $set: { [reminder.key]: false } });
      console.error(`Failed to send ${isQualifying ? 'qualifying' : 'race'} prediction reminder:`, error);
    }
  }
}

async function claimAndSendRaceAnnouncement(client, race) {
  if (race.announcementSent) return;
  const claimed = await Race.findOneAndUpdate(
    { _id: race._id, announcementSent: false },
    { $set: { announcementSent: true } },
    { new: true }
  );
  if (!claimed) return;
  try {
    const channel = await client.channels.fetch(config.channels.announcements);
    if (!channel) throw new Error('Announcement channel not found');
    await channel.send({ content: '@everyone 🏁 Race Predictions are now LIVE!', embeds: [createRaceAnnouncementEmbed(race)] });
  } catch (error) {
    await Race.updateOne({ _id: race._id }, { $set: { announcementSent: false } });
    console.error('Failed to send prediction announcement:', error);
  }
}

async function claimAndSendQualifyingAnnouncement(client, qualifying) {
  if (qualifying.announcementSent) return;
  const claimed = await Qualifying.findOneAndUpdate(
    { _id: qualifying._id, announcementSent: false },
    { $set: { announcementSent: true } },
    { new: true }
  );
  if (!claimed) return;
  try {
    const channel = await client.channels.fetch(config.channels.announcements);
    if (!channel) throw new Error('Announcement channel not found');
    await channel.send({ content: '@everyone 🏁 Qualifying Predictions are now LIVE!', embeds: [createQualifyingAnnouncementEmbed(qualifying)] });
  } catch (error) {
    await Qualifying.updateOne({ _id: qualifying._id }, { $set: { announcementSent: false } });
    console.error('Failed to send qualifying announcement:', error);
  }
}

async function claimAndSendStatistics(client, race) {
  const claimed = await Race.findOneAndUpdate(
    { _id: race._id, statisticsSent: false },
    { $set: { statisticsSent: true } },
    { new: true }
  );
  if (!claimed) return;

  try {
    const predictions = await Prediction.find({ raceId: race._id });
    if (!predictions.length) return;
    const total = predictions.length;
    const count = key => predictions.reduce((map, p) => { map[p[key]] = (map[p[key]] || 0) + 1; return map; }, {});
    const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const p1 = top(count('p1Driver')); const p2 = top(count('p2Driver')); const p3 = top(count('p3Driver'));
    const channel = await client.channels.fetch(config.channels.statistics);
    if (!channel) throw new Error('Statistics channel not found');
    await channel.send({ embeds: [createPredictionStatisticsEmbed(race, total, p1[0], p1[1], ((p1[1] / total) * 100).toFixed(1), p2[0], p2[1], ((p2[1] / total) * 100).toFixed(1), p3[0], p3[1], ((p3[1] / total) * 100).toFixed(1))] });
  } catch (error) {
    await Race.updateOne({ _id: race._id }, { $set: { statisticsSent: false } });
    console.error('Failed to send prediction statistics:', error);
  }
}

async function processReminders(client) {
  const now = new Date();
  const reminders = await Reminder.find({ sent: false, remindAt: { $lte: now } }).limit(100);
  for (const reminder of reminders) {
    const claimed = await Reminder.findOneAndUpdate({ _id: reminder._id, sent: false }, { $set: { sent: true } }, { new: true });
    if (!claimed) continue;
    try {
      const channel = await client.channels.fetch(reminder.channelId);
      if (!channel) throw new Error('Reminder channel not found');
      await channel.send({ content: `<@${reminder.userId}>\n\n⚠️ **Reminder**\n\n${reminder.message}` });
    } catch (error) {
      await Reminder.updateOne({ _id: reminder._id }, { $set: { sent: false } });
      console.error('Failed to send reminder:', error);
    }
  }
}


async function processCancelledRacePasses(client) {
  const cancelledRaces = await Race.find({ status: 'cancelled' }).select('name season racePassKey').limit(200).lean();
  for (const race of cancelledRaces) {
    try {
      await cancelRacePassesForRace(client, config.guildId, race.name, race.racePassKey);
    } catch (error) {
      console.error('Failed to reconcile cancelled Race Passes for ' + race.name + ':', error);
    }
  }
}

async function processGoogleSheetSync(client) {
  const payments = await PaymentVerification.find({
    status: 'verified',
    sheetSyncStatus: { $in: ['pending', 'failed'] },
  }).sort({ updatedAt: 1 }).limit(20);

  for (const payment of payments) {
    try {
      const user = await client.users.fetch(payment.userId);
      await syncVerifiedPaymentToSheet(payment, user);
    } catch (error) {
      console.error(`Failed to retry Google Sheet sync for ${payment.requestId}:`, error);
    }
  }
}

async function processMemberships(client) {
  const now = new Date();
  const memberships = await Membership.find({
    expiresAt: { $lte: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) },
  }).limit(200);

  for (const membership of memberships) {
    try {
      await client.guilds.fetch(membership.guildId);

      const fiveDays = membership.expiresAt.getTime() - 5 * 24 * 60 * 60 * 1000;
      const oneDay = membership.expiresAt.getTime() - 24 * 60 * 60 * 1000;

      if (now.getTime() >= fiveDays && now < membership.expiresAt && !membership.fiveDayReminderSent) {
        const claimed = await Membership.findOneAndUpdate(
          { _id: membership._id, fiveDayReminderSent: false },
          { $set: { fiveDayReminderSent: true } },
          { new: true }
        );
        if (claimed && !(await sendMembershipDM(client, membership, '5 days remaining', `Your ${membership.type} membership expires in 5 days.`))) {
          await Membership.updateOne({ _id: membership._id }, { $set: { fiveDayReminderSent: false } });
        }
      }

      if (now.getTime() >= oneDay && now < membership.expiresAt && !membership.oneDayReminderSent) {
        const claimed = await Membership.findOneAndUpdate(
          { _id: membership._id, oneDayReminderSent: false },
          { $set: { oneDayReminderSent: true } },
          { new: true }
        );
        if (claimed && !(await sendMembershipDM(client, membership, '1 day remaining', `Your ${membership.type} membership expires tomorrow.`))) {
          await Membership.updateOne({ _id: membership._id }, { $set: { oneDayReminderSent: false } });
        }
      }

      if (now >= membership.expiresAt) {
        let roleRemovalSucceeded = true;

        if (membership.roleId) {
          try {
            await client.rest.delete(
              Routes.guildMemberRole(membership.guildId, membership.userId, membership.roleId)
            );
          } catch (error) {
            if (error?.status !== 404) {
              roleRemovalSucceeded = false;
              console.error('Failed to remove expired membership role:', error);
            }
          }
        }

        if (!roleRemovalSucceeded) continue;

        const claimed = await Membership.findOneAndUpdate(
          { _id: membership._id, expiryReminderSent: false },
          { $set: { expiryReminderSent: true } },
          { new: true }
        );

        if (claimed) {
          await sendMembershipDM(client, membership, 'Membership expired', `Your ${membership.type} membership has expired.`);
        }

        await Membership.deleteOne({ _id: membership._id });
      }
    } catch (error) {
      console.error(`Failed to process membership ${membership._id}:`, error);
    }
  }
}

async function processStalePaymentVerifications() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const stale = await PaymentVerification.find({
    status: 'processing',
    processingAt: { $lte: cutoff },
  }).limit(50);

  for (const payment of stale) {
    const claimed = await PaymentVerification.findOneAndUpdate(
      { _id: payment._id, status: 'processing', processingAt: { $lte: cutoff } },
      { $set: { status: 'pending', processingAt: null, verifiedBy: null } },
      { new: true }
    );
    if (claimed) {
      console.warn('[Payments] Reset stale verification ' + claimed.requestId + ' to pending for retry.');
    }
  }
}

async function sendMembershipDM(client, membership, title, message) {
  try {
    const user = await client.users.fetch(membership.userId);
    await user.send(`**${title}**\n\n${message}`);
    return true;
  } catch (error) {
    console.error(`Failed to DM membership user ${membership.userId}:`, error);
    return false;
  }
}
