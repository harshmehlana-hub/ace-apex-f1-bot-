import { setupScheduler } from '../services/schedulerService.js';

export default {
  name: 'ready',
  once: true,

  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log("Bot ID:", client.user.id);
    console.log("Application ID:", client.application.id);

    const guild = client.guilds.cache.first();

    console.log("Guild:", guild.name);

    const member = await guild.members.fetch("1476246684752150528");

    console.log("Fetched member:", member.user.tag);
    try {
  const dm = await member.user.createDM();

  console.log("DM Channel ID:", dm.id);

  await dm.send("Test message from ready event!");

  console.log("✅ DM sent successfully");
} catch (err) {
  console.error("DM TEST FAILED");
  console.error(err);
}

    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setActivity('F1 Predictions', { type: 3 });

    setupScheduler(client);
  },
};