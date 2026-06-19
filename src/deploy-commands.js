import { REST, Routes } from 'discord.js';
import { config } from './config.js';

// Import all command data
import predictCommand from './commands/predict.js';
import showpredictionCommand from './commands/showprediction.js';
import leaderboardCommand from './commands/leaderboard.js';
import rankCommand from './commands/rank.js';
import setraceCommand from './commands/setrace.js';
import resultsCommand from './commands/results.js';
import recalculateresultsCommand from './commands/recalculateresults.js';
import deleteraceCommand from './commands/deleterace.js';
import resetseasonCommand from './commands/resetseason.js';
import adjustpointsCommand from './commands/adjustpoints.js';
import setqualifyingCommand from './commands/setqualifying.js';

const commands = [
  predictCommand.data.toJSON(),
  showpredictionCommand.data.toJSON(),
  leaderboardCommand.data.toJSON(),
  rankCommand.data.toJSON(),
  setraceCommand.data.toJSON(),
  resultsCommand.data.toJSON(),
  recalculateresultsCommand.data.toJSON(),
  deleteraceCommand.data.toJSON(),
  resetseasonCommand.data.toJSON(),
 adjustpointsCommand.data.toJSON(),
setqualifyingCommand.data.toJSON(),
];

const rest = new REST().setToken(config.token);

async function deployCommands() {
  try {
    console.log(`Deploying ${commands.length} commands...`);
    
    // Deploy to specific guild (faster for development)
    await rest.put(
  Routes.applicationGuildCommands(config.clientId, config.guildId),
  { body: commands }
);
    
    console.log('✅ Commands deployed successfully!');
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
}

deployCommands();
