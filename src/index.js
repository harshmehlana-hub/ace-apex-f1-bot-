import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { config } from './config.js';
import { connectDatabase } from './database/connection.js';
import { logDM } from './utils/dmLogger.js';

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
import predictionstatsCommand from './commands/predictionstats.js';
import remindCommand from './commands/remind.js';
import grantmembershipCommand from './commands/grantmembership.js';
import membershipinfoCommand from './commands/membershipinfo.js';
import deletemembershipCommand from './commands/deletemembership.js';
import privacyCommand from './commands/privacy.js';
import dmCommand from './commands/dm.js';
import recalculatequalifyingCommand from './commands/recalculatequalifying.js';
import purchasemembershipCommand from './commands/purchasemembership.js';
import announcementCommand from './commands/announcement.js';
import { runDataMigrations } from './services/dataMigrationService.js';

// Import events
import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';
import userUpdateEvent from './events/userUpdate.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],

  partials: [
    Partials.Channel,
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
predictionstatsCommand,
remindCommand,
recalculatequalifyingCommand,
grantmembershipCommand,
membershipinfoCommand,
deletemembershipCommand,
privacyCommand,
dmCommand,
  purchasemembershipCommand,
  announcementCommand,
];

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

// Register events
client.once('ready', () => readyEvent.execute(client));
client.on('interactionCreate', (interaction) => interactionCreateEvent.execute(interaction, client));
client.on('userUpdate', (oldUser, newUser) => userUpdateEvent.execute(oldUser, newUser, client));
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Only log DMs
  if (message.guild) return;

let content = message.content;

if (message.attachments.size > 0) {
  const attachments = message.attachments
    .map(a => a.url)
    .join('\n');

  content +=
    (content ? '\n\n' : '') +
    `📎 Attachments:\n${attachments}`;
}

if (!content) {
  content = '*No text message*';
}

await logDM(
  client,
  'Incoming DM',
  null,
  message.author,
  content
);
});

// Start the bot
async function main() {
  try {
    console.log("MONGODB_URI:", process.env.MONGODB_URI ? "FOUND" : "NOT FOUND");

    await connectDatabase();
    console.log('Connected to MongoDB');
    await runDataMigrations();
    console.log('Database integrity migration completed');

console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN ? "FOUND" : "NOT FOUND");
console.log("config.token exists:", !!config.token);
console.log("Attempting Discord login..."); 
    await client.login(config.token);
   
    process.on('exit', (code) => {
  console.log('PROCESS EXITED WITH CODE:', code);
});
    
    
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
