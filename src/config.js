import dotenv from 'dotenv';
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  mongoUri: process.env.MONGODB_URI,
  channels: {
  announcements: process.env.ANNOUNCEMENT_CHANNEL_ID,
  logs: process.env.LOGS_CHANNEL_ID,
  results: process.env.RESULTS_CHANNEL_ID,
  statistics: process.env.STATISTICS_CHANNEL_ID,
},
  roles: {
    predictor: process.env.PREDICTOR_ROLE_ID,
    admin: process.env.ADMIN_ROLE_ID,
  },
  // Prediction window timing (in milliseconds)
  timing: {
    openBefore: 24 * 60 * 60 * 1000,  // 24 hours before race
    closeBefore: 10 * 60 * 1000,       // 10 minutes before race
  },
  // Scoring table
  scoring: {
    3: 25,  // 3 correct positions
    2: 18,  // 2 correct positions
    1: 15,  // 1 correct position
    0: 0,   // 0 correct positions
  },

 qualifyingScoring: {
  correct: 5,
  incorrect: 0,
},
};
