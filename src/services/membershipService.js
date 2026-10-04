import { Routes } from 'discord.js';
import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { logDM } from '../utils/dmLogger.js';

const MEMBERSHIP_DETAILS = {
  race: { name: 'Race Pass', roleKey: 'racePass', durationDays: 7 },
  monthly: { name: 'Monthly Membership', roleKey: 'supporter', durationDays: 30 },
  yearly: { name: 'Yearly Membership', roleKey: 'supporter', durationDays: 365 },
};

export async function grantMembership({ client, guild, user, type, grantedBy, source = 'Admin command', paymentRequest = null }) {
  const details = MEMBERSHIP_DETAILS[type];
  if (!details) throw new Error('Invalid membership type.');
  const roleId = config.roles[details.roleKey];
  if (!roleId) throw new Error('Membership role is not configured.');
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) throw new Error('Membership role not found.');

  await client.rest.put(Routes.guildMemberRole(guild.id, user.id, roleId));

  let membership = await Membership.findOne({ userId: user.id });
  if (membership?.roleId && membership.roleId !== roleId) {
    await client.rest.delete(Routes.guildMemberRole(guild.id, user.id, membership.roleId)).catch(error => {
      if (error?.status !== 404) console.error('Failed to remove previous membership role:', error);
    });
  }

  const now = new Date();
  let expiry = membership && membership.expiresAt > now ? new Date(membership.expiresAt) : now;
  expiry.setDate(expiry.getDate() + details.durationDays);

  if (membership) {
    membership.roleId = roleId;
    membership.type = type;
    membership.guildId = guild.id;
    membership.expiresAt = expiry;
    membership.fiveDayReminderSent = false;
    membership.oneDayReminderSent = false;
    membership.expiryReminderSent = false;
    await membership.save();
  } else {
    membership = await Membership.create({ userId: user.id, guildId: guild.id, roleId, type, expiresAt: expiry });
  }

  try {
    await user.send(
      '**Hey ' + user.username + '! 👋**\n\n' +
      'Your membership is now active on the server.\n\n' +
      '**Type:** ' + details.name + '\n' +
      '**Valid till:** <t:' + Math.floor(expiry.getTime() / 1000) + ':F>\n\n' +
      'Thank you for supporting **Ace\'s Apex**! We truly appreciate your support. 🥳❤️'
    );
    await logDM(client, 'Membership Activated', grantedBy, user, 'Membership Type: ' + details.name);
  } catch (error) {
    console.error('Membership activation DM failed:', error);
  }

  return { membership, expiry, membershipName: details.name };
}

export { MEMBERSHIP_DETAILS };