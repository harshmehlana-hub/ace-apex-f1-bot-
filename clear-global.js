import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function removeAnnouncementCommand() {
  try {
    const applicationId = process.env.DISCORD_CLIENT_ID;
    const commands = await rest.get(Routes.applicationCommands(applicationId));
    const remaining = commands.filter(command => command.name !== 'announcement');
    await rest.put(Routes.applicationCommands(applicationId), { body: remaining });
    console.log(`✅ Global commands updated. Removed /announcement; kept ${remaining.length} other command(s).`);
  } catch (error) {
    console.error('Failed to remove global /announcement:', error);
    process.exitCode = 1;
  }
}

removeAnnouncementCommand();
