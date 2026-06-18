export default {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);
    
    client.user.setActivity('F1 Predictions', { type: 3 }); // Watching
  },
};
