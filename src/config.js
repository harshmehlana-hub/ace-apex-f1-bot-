import dotenv from 'dotenv';
dotenv.config();

console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  mongoUri: process.env.MONGODB_URI,
  channels: {
    announcements: process.env.ANNOUNCEMENT_CHANNEL_ID,
    logs: process.env.LOGS_CHANNEL_ID,
    results: process.env.RESULTS_CHANNEL_ID,
  },
  roles: {
    predictor: process.env.PREDICTOR_ROLE_ID,
    admin: process.env.ADMIN_ROLE_ID,
  },
  timing: {
    openBefore: 24 * 60 * 60 * 1000,
    closeBefore: 10 * 60 * 1000,
  },
  scoring: {
    3: 25,
    2: 18,
    1: 15,
    0: 0,
  },
};