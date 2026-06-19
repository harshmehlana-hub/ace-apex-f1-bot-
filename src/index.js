import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { connectDatabase } from './database/connection.js';
import { setupScheduler } from './services/schedulerService.js';

// Import commands
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
import predictqualifyingCommand from './commands/predictqualifying.js';
import qualifyingresultCommand from './commands/qualifyingresult.js';
import deletequalifyingCommand from './commands/deletequalifying.js';

// Import events
import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// Initialize commands collection
client.commands = new Collection();

// Register commands
const commands = [
  predictCommand,
  showpredictionCommand,
  leaderboardCommand,
  rankCommand,
  setraceCommand,
  resultsCommand,
  recalculateresultsCommand,
  deleteraceCommand,
  resetseasonCommand,
  adjustpointsCommand,
 setqualifyingCommand,
predictqualifyingCommand,
qualifyingresultCommand,
deletequalifyingCommand,
];

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

// Register events
client.once('ready', () => readyEvent.execute(client));
client.on('interactionCreate', (interaction) => interactionCreateEvent.execute(interaction, client));

// Start the bot
async function main() {
  try {
    console.log("MONGODB_URI:", process.env.MONGODB_URI ? "FOUND" : "NOT FOUND");

    await connectDatabase();
    console.log('Connected to MongoDB');    
    await client.login(config.token);
    
    // Setup scheduler after client is ready
    client.once('ready', () => {
      setupScheduler(client);
    });
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
