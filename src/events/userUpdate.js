import { User } from '../database/models/User.js';

export default {
  name: 'userUpdate',
  async execute(oldUser, newUser) {
    if (!newUser?.id || newUser.bot) return;

    const oldUsername = oldUser?.username;
    const newUsername = newUser.username;

    if (!newUsername || oldUsername === newUsername) return;

    try {
      const result = await User.updateOne(
        { discordId: newUser.id },
        { $set: { username: newUsername } }
      );

      if (result.matchedCount > 0) {
        console.log(
          `[UserUpdate] Updated Discord username for ${newUser.id}: ${oldUsername} -> ${newUsername}`
        );
      }
    } catch (error) {
      console.error(
        `[UserUpdate] Failed to update username for ${newUser.id}:`,
        error
      );
    }
  },
};
