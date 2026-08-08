import { setupScheduler } from '../services/schedulerService.js';

export default {
  name: 'ready',
  once: true,

  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log('Bot ID:', client.user.id);
    console.log('Application ID:', client.application.id);

    const guild = client.guilds.cache.first();

    if (guild) {
      console.log('Guild:', guild.name);
    }

    console.log(
      `📊 Serving ${client.guilds.cache.size} guild(s)`
    );

    client.user.setActivity('F1 Predictions', {
      type: 3,
    });

    setupScheduler(client);
  },
};