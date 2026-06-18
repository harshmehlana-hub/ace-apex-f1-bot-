import cron from 'node-cron';
import { Race } from '../database/models/Race.js';
import { config } from '../config.js';
import { createRaceAnnouncementEmbed } from '../utils/embeds.js';

export function setupScheduler(client) {
  // Run every minute to check race status
  cron.schedule('* * * * *', async () => {
    await updateRaceStatuses(client);
  });
  
  console.log('Scheduler initialized');
}

async function updateRaceStatuses(client) {
  const now = new Date();
  
  // Find races that should be opened
  const racesToOpen = await Race.find({
    status: 'upcoming',
    predictionOpenTime: { $lte: now },
  });
  
  for (const race of racesToOpen) {
    race.status = 'open';
    await race.save();
    
    // Send announcement if not already sent
    if (!race.announcementSent) {
      await sendPredictionOpenAnnouncement(client, race);
      race.announcementSent = true;
      await race.save();
    }
  }
  
  // Find races that should be closed
  const racesToClose = await Race.find({
    status: 'open',
    predictionCloseTime: { $lte: now },
  });
  
  for (const race of racesToClose) {
    race.status = 'closed';
    await race.save();
  }
}

async function sendPredictionOpenAnnouncement(client, race) {
  try {
    const channel = await client.channels.fetch(config.channels.announcements);
    if (!channel) return;
    
    const embed = createRaceAnnouncementEmbed(race);
    await channel.send({
      content: '@everyone',
      embeds: [embed],
    });
  } catch (error) {
    console.error('Failed to send prediction announcement:', error);
  }
}
