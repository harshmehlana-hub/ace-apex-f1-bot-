import { Routes } from 'discord.js';
import { RacePass } from '../database/models/RacePass.js';
import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { getRacePass } from '../config/racePasses2026.js';

async function grantRacePassRole(client, racePass) {
  const roleId = config.roles.racePass;
  if (!roleId) throw new Error('Race Pass role is not configured.');
  await client.rest.put(Routes.guildMemberRole(racePass.guildId, racePass.userId, roleId));
}

async function removeRacePassRoleIfUnused(client, racePass) {
  const roleId = config.roles.racePass;
  if (!roleId) return;
  const now = new Date();
  const anotherActive = await RacePass.exists({ userId: racePass.userId, status: 'active', expiresAt: { $gt: now }, _id: { $ne: racePass._id } });
  const legacyMembership = await Membership.exists({ userId: racePass.userId, type: 'race', expiresAt: { $gt: now } });
  if (!anotherActive && !legacyMembership) {
    await client.rest.delete(Routes.guildMemberRole(racePass.guildId, racePass.userId, roleId)).catch((error) => {
      if (error?.status !== 404) console.error('Failed to remove expired Race Pass role:', error);
    });
  }
}

export async function createRacePass({ client, guild, user, paymentRequest, raceKey, ignoreWindow = false }) {
  const race = getRacePass(raceKey);
  if (!race) throw new Error('The selected Race Pass race is no longer available.');
  const now = new Date();
  if (!ignoreWindow && (now < race.purchaseStartAt || now > race.purchaseEndAt)) throw new Error('The purchase window for this Race Pass has closed.');
  const existing = await RacePass.findOne({ userId: user.id, raceKey });
  if (existing && existing.status !== 'cancelled') {
    if (paymentRequest?.requestId && existing.paymentRequestId === paymentRequest.requestId) {
      if (existing.status === 'active') await grantRacePassRole(client, existing);
      if (existing.status === 'expired') throw new Error('This payment request is already linked to an expired Race Pass.');
      return { racePass: existing, expiry: existing.expiresAt, membershipName: 'Race Pass' };
    }
    throw new Error('You already have a Race Pass for this race.');
  }

  const racePass = await RacePass.create({
    userId: user.id,
    guildId: guild.id,
    raceKey: race.key,
    raceName: race.name,
    country: paymentRequest.country,
    amount: paymentRequest.amount,
    currency: paymentRequest.currency,
    paymentRequestId: paymentRequest.requestId,
    activationAt: race.activationAt,
    raceStartAt: race.raceStartAt,
    raceEndAt: race.raceEndAt,
    expiresAt: race.expiryAt,
    status: now >= race.activationAt ? 'active' : 'scheduled',
    activatedAt: now >= race.activationAt ? now : null,
  });

  if (racePass.status === 'active') {
    try {
      await grantRacePassRole(client, racePass);
    } catch (error) {
      await RacePass.deleteOne({ _id: racePass._id });
      throw error;
    }
    try {
      await user.send('**🏁 Your Race Pass is active!**\n\n**Race:** ' + race.name + '\n**Valid until:** <t:' + Math.floor(race.expiryAt.getTime() / 1000) + ':F>\n\nEnjoy the race weekend with Ace\'s Apex! 🏎️');
    } catch (error) { console.error('Race Pass activation DM failed:', error); }
  } else {
    try {
      await user.send('**🏁 Race Pass confirmed!**\n\n**Race:** ' + race.name + '\n**Access starts:** <t:' + Math.floor(race.activationAt.getTime() / 1000) + ':F>\n**Valid until:** <t:' + Math.floor(race.expiryAt.getTime() / 1000) + ':F>\n\nYour Race Pass will activate automatically when the race weekend begins.');
    } catch (error) { console.error('Race Pass confirmation DM failed:', error); }
  }
  return { racePass, expiry: racePass.expiresAt, membershipName: 'Race Pass' };
}

export async function grantRacePass({ client, guild, user, raceKey, paymentRequest }) {
  return createRacePass({ client, guild, user, paymentRequest, raceKey, ignoreWindow: true });
}


export async function cancelRacePassesForRace(client, guildId, raceName) {
  const passes = await RacePass.find({
    guildId,
    raceName,
    status: { $in: ['scheduled', 'active'] },
  }).limit(200);

  for (const racePass of passes) {
    const claimed = await RacePass.findOneAndUpdate(
      { _id: racePass._id, status: { $in: ['scheduled', 'active'] } },
      { $set: { status: 'cancelled', expiredAt: new Date() } },
      { new: true }
    );
    if (!claimed) continue;

    if (racePass.status === 'active') {
      await removeRacePassRoleIfUnused(client, claimed);
    }

    try {
      const user = await client.users.fetch(claimed.userId);
      await user.send('⚠️ **Race Pass cancelled**\n\nThe **' + claimed.raceName + '** event was cancelled, so your Race Pass has been cancelled. Please contact the Ace\'s Apex team if the event is rescheduled.');
    } catch (error) {
      console.error('Race Pass cancellation DM failed:', error);
    }
  }
}

export async function processRacePasses(client) {
  const now = new Date();
  const scheduled = await RacePass.find({ status: 'scheduled', activationAt: { $lte: now }, expiresAt: { $gt: now } }).limit(200);
  for (const racePass of scheduled) {
    const claimed = await RacePass.findOneAndUpdate({ _id: racePass._id, status: 'scheduled' }, { $set: { status: 'active', activatedAt: now } }, { new: true });
    if (!claimed) continue;
    try {
      await grantRacePassRole(client, claimed);
    } catch (error) {
      await RacePass.updateOne(
        { _id: claimed._id, status: 'active' },
        { $set: { status: 'scheduled', activatedAt: null } }
      );
      console.error('Failed to activate Race Pass role:', error);
      continue;
    }

    try {
      const user = await client.users.fetch(claimed.userId);
      await user.send('**🏁 Your Race Pass is now active!**\n\n**Race:** ' + claimed.raceName + '\n**Valid until:** <t:' + Math.floor(claimed.expiresAt.getTime() / 1000) + ':F>\n\nEnjoy the race weekend with Ace\'s Apex! 🏎️');
    } catch (error) {
      console.error('Race Pass activation DM failed:', error);
    }
  }

  const expiring = await RacePass.find({ status: 'active', expiresAt: { $lte: now } }).limit(200);
  for (const racePass of expiring) {
    const claimed = await RacePass.findOneAndUpdate({ _id: racePass._id, status: 'active' }, { $set: { status: 'expired', expiredAt: now } }, { new: true });
    if (!claimed) continue;
    await removeRacePassRoleIfUnused(client, claimed);
    try {
      const user = await client.users.fetch(claimed.userId);
      await user.send('**🏁 Race Pass expired**\n\nYour **' + claimed.raceName + '** Race Pass has expired. Thank you for joining us! ❤️');
    } catch (error) { console.error('Race Pass expiry DM failed:', error); }
  }
}
