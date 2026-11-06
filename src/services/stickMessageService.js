import { StickMessage } from '../database/models/StickMessage.js';

export async function processStickMessages(client) {
  const due = await StickMessage.find({ active: true, nextSendAt: { $lte: new Date() } })
    .sort({ nextSendAt: 1 })
    .limit(50);

  for (const item of due) {
    // Claim each scheduled send before posting so scheduler retries cannot duplicate it.
    const claimedAt = new Date();
    const nextSendAt = new Date(claimedAt.getTime() + (item.intervalMinutes || 15) * 60 * 1000);
    const claimed = await StickMessage.findOneAndUpdate(
      { _id: item._id, active: true, nextSendAt: { $lte: claimedAt } },
      { $set: { nextSendAt } },
      { new: true }
    );
    if (!claimed) continue;

    try {
      const channel = await client.channels.fetch(claimed.channelId);
      if (!channel?.isTextBased() || !channel.send) {
        await StickMessage.updateOne({ _id: claimed._id }, { $set: { active: false } });
        continue;
      }
      await channel.send({ content: claimed.message, allowedMentions: { parse: ['users', 'roles', 'everyone'] } });
    } catch (error) {
      console.error('[Stick Messages] Failed to send repeating message:', error);
      // Retry a failed send after one minute without changing its chosen repeat interval.
      await StickMessage.updateOne(
        { _id: claimed._id, active: true, nextSendAt },
        { $set: { nextSendAt: new Date(Date.now() + 60 * 1000) } }
      );
    }
  }
}
