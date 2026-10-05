import { Routes } from 'discord.js';
import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { logDM } from '../utils/dmLogger.js';

const MEMBERSHIP_DETAILS = {
  race: { name: 'Race Pass', roleKey: 'racePass', durationDays: 7 },
  monthly: { name: 'Monthly Membership', roleKey: 'supporter', durationDays: 30 },
  yearly: { name: 'Yearly Membership', roleKey: 'supporter', durationDays: 365 },
};

async function grantRole(client, guildId, userId, roleId) {
  await client.rest.put(Routes.guildMemberRole(guildId, userId, roleId));
}

export async function grantMembership({ client, guild, user, type, grantedBy, source = 'Admin command', paymentRequest = null }) {
  const details = MEMBERSHIP_DETAILS[type];
  if (!details) throw new Error('Invalid membership type.');
  const roleId = config.roles[details.roleKey];
  if (!roleId) throw new Error('Membership role is not configured.');
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) throw new Error('Membership role not found.');

  let membership = await Membership.findOne({ userId: user.id });

  // Payment verification can safely retry the same request after a crash.
  // Never extend the membership twice for the same payment request.
  if (paymentRequest?.requestId && membership?.paymentRequestId === paymentRequest.requestId) {
    await grantRole(client, guild.id, user.id, roleId);
    return {
      membership,
      expiry: membership.expiresAt,
      membershipName: details.name,
    };
  }

  const previousRoleId = membership?.roleId && membership.roleId !== roleId
    ? membership.roleId
    : null;

  const now = new Date();
  let expiry = membership && membership.expiresAt > now
    ? new Date(membership.expiresAt)
    : now;
  expiry.setDate(expiry.getDate() + details.durationDays);

  // Persist the grant before touching Discord. This makes the Mongo record
  // the recovery point if the process crashes after the database write.
  if (membership) {
    membership.roleId = roleId;
    membership.type = type;
    membership.guildId = guild.id;
    membership.expiresAt = expiry;
    if (paymentRequest?.requestId) membership.paymentRequestId = paymentRequest.requestId;
    membership.fiveDayReminderSent = false;
    membership.oneDayReminderSent = false;
    membership.expiryReminderSent = false;
    await membership.save();
  } else {
    membership = await Membership.create({
      userId: user.id,
      guildId: guild.id,
      roleId,
      type,
      expiresAt: expiry,
      paymentRequestId: paymentRequest?.requestId || null,
    });
  }

  try {
    await grantRole(client, guild.id, user.id, roleId);
  } catch (error) {
    console.error('Membership role grant failed; MongoDB grant is retained for retry:', error);
    throw error;
  }

  if (previousRoleId) {
    await client.rest.delete(
      Routes.guildMemberRole(guild.id, user.id, previousRoleId)
    ).catch(error => {
      if (error?.status !== 404) {
        console.error('Failed to remove previous membership role:', error);
      }
    });
  }

  try {
    await user.send(
      '**Hey ' + user.username + '! 👋**\n\n' +
      'Your membership is now active on the server.\n\n' +
      '**Type:** ' + details.name + '\n' +
      '**Valid till:** <t:' + Math.floor(expiry.getTime() / 1000) + ':F>\n\n' +
      'Thank you for supporting **Ace\\'s Apex**! We truly appreciate your support. 🥳❤️'
    );
    await logDM(client, 'Membership Activated', grantedBy, user, 'Membership Type: ' + details.name);
  } catch (error) {
    console.error('Membership activation DM failed:', error);
  }

  return { membership, expiry, membershipName: details.name };
}

export { MEMBERSHIP_DETAILS };
