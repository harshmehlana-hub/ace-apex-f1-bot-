import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export async function logDM(
  client,
  type,
  sender,
  recipient,
  message
) {
  try {
    const channel = await client.channels.fetch(
      config.channels.dmLogs
    );

    if (!channel) return;

let color;

switch (type) {
  case 'Incoming DM':
    color = 0x3498db; // Blue
    break;

  case 'Outgoing DM':
    color = 0x2ecc71; // Green
    break;

  case 'Membership Activated':
    color = 0x2ecc71; // Green
    break;

  case '5-Day Reminder':
  case '1-Day Reminder':
    color = 0xf1c40f; // Yellow
    break;

  case 'Membership Expired':
    color = 0xe74c3c; // Red
    break;

  default:
    color = 0x95a5a6; // Grey
}

   const embed = new EmbedBuilder()
  .setColor(color)
  .setTitle(`📨 ${type}`)
  .setTimestamp()
  .setFooter({
    text: 'Ace\'s Apex DM Logs',
  });

   embed.setAuthor({
  name: "Ace's Apex",
  iconURL: client.user.displayAvatarURL(),
  });

if (sender) {
  embed.addFields({
    name: '👮 Admin',
    value: `${sender.tag}\n\`${sender.id}\``,
    inline: true,
  });
}

embed.addFields({
  name: sender ? '👤 Recipient' : '👤 User',
  value: `${recipient.tag}\n\`${recipient.id}\``,
  inline: true,
});

embed.addFields({
  name: '💬 Message',
  value: `\`\`\`\n${message || 'No message'}\n\`\`\``,
});

    await channel.send({
      embeds: [embed],
    });

  } catch (error) {
    console.error(
      'Failed to log DM:',
      error
    );
  }
}