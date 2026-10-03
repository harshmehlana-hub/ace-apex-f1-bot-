import { randomUUID } from 'crypto';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { PaymentVerification } from '../database/models/PaymentVerification.js';
import { config } from '../config.js';
import { membershipPayments } from '../config/membershipPayments.js';
import { getAvailableRacePasses, getRacePass } from '../config/racePasses2026.js';
import { grantMembership, MEMBERSHIP_DETAILS } from './membershipService.js';
import { createRacePass } from './racePassService.js';

const COUNTRY_PREFIX = 'purchase_country';
const TYPE_PREFIX = 'purchase_type';
const PAID_PREFIX = 'purchase_paid';
const VERIFY_PREFIX = 'membership_verify';
const REJECT_PREFIX = 'membership_reject';
const RACE_SELECT_PREFIX = 'purchase_race_select';

function money(payment) {
  return payment.currency === 'INR' ? '₹' + payment.amount : '$' + payment.amount.toFixed(2);
}

function typeButton(country, type) {
  return new ButtonBuilder()
    .setCustomId(TYPE_PREFIX + ':' + country + ':' + type)
    .setLabel(membershipPayments[country][type].label)
    .setStyle(ButtonStyle.Primary);
}

export async function startPurchase(interaction, client) {
  const pending = await PaymentVerification.findOne({ userId: interaction.user.id, status: { $in: ['pending', 'processing'] } });
  if (pending) {
    return interaction.reply({ content: '⚠️ You already have a payment verification request pending. Please wait for an admin to verify it.', ephemeral: true });
  }

  try {
    await interaction.user.send({
      content: '## 🏁 Ace\'s Apex Membership\n\nChoose where you are paying from:',
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(COUNTRY_PREFIX + ':india').setLabel('🇮🇳 Indian').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(COUNTRY_PREFIX + ':international').setLabel('🌎 Non-Indian').setStyle(ButtonStyle.Secondary),
      )],
    });
    return interaction.reply({ content: '📩 Check your DMs — I sent you the membership purchase options.', ephemeral: true });
  } catch (error) {
    console.error('Failed to start membership purchase DM:', error);
    return interaction.reply({ content: '❌ I could not DM you. Please enable DMs from server members and try again.', ephemeral: true });
  }
}

async function showMembershipPayment(interaction, country, type, raceKey = null) {
  const payment = membershipPayments[country]?.[type];
  if (!payment) return;
  const race = raceKey ? getRacePass(raceKey) : null;
  const paidId = PAID_PREFIX + ':' + country + ':' + type + (raceKey ? ':' + raceKey : '');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(paidId).setLabel('I have paid').setStyle(ButtonStyle.Success)
  );
  const raceText = race
    ? '\n\n**Race:** ' + race.name +
      '\n**Race weekend starts:** <t:' + Math.floor(race.weekendStartAt.getTime() / 1000) + ':F>' +
      '\n**Pass expiry:** <t:' + Math.floor(race.expiryAt.getTime() / 1000) + ':F>'
    : '';

  if (country === 'international') {
    row.addComponents(new ButtonBuilder().setLabel('Pay with PayPal').setStyle(ButtonStyle.Link).setURL(payment.paypalUrl));
    await interaction.update({
      content: '## ' + payment.label + raceText + '\n\n**Price:** ' + money(payment) + '\n\n1. Click **Pay with PayPal**.\n2. Complete the payment.\n3. Click **I have paid** and enter the payer name shown on PayPal.\n\n⚠️ Clicking **I have paid** only sends a verification request. Membership is granted only after an admin verifies the payment.',
      components: [row],
    });
    return;
  }

  const attachment = new AttachmentBuilder(Buffer.from(payment.qrBase64, 'base64'), { name: 'ace-apex-' + type + '-qr.png' });
  await interaction.update({
    content: '## ' + payment.label + raceText + '\n\n**Price:** ' + money(payment) + '\n\nScan the QR code below using any UPI app, complete the payment, then click **I have paid**.\n\n⚠️ Your payment will be manually verified before membership is granted.',
    files: [attachment],
    components: [row],
  });
}

export async function handlePurchaseInteraction(interaction, client) {
  const id = interaction.customId || '';

  if (id.startsWith(COUNTRY_PREFIX + ':')) {
    const country = id.split(':')[1];
    if (!membershipPayments[country]) return;
    await interaction.update({
      content: '## 🎟️ Choose your membership\n\n' + (country === 'india' ? 'India payment via UPI.' : 'International payment via PayPal.'),
      components: [new ActionRowBuilder().addComponents(
        typeButton(country, 'race'),
        typeButton(country, 'monthly'),
        typeButton(country, 'yearly'),
      )],
    });
    return;
  }

  if (id.startsWith(TYPE_PREFIX + ':')) {
    const [, country, type] = id.split(':');
    const payment = membershipPayments[country]?.[type];
    if (!payment) return;

    if (type === 'race') {
      const races = getAvailableRacePasses();
      if (!races.length) {
        await interaction.update({ content: '🏁 No Race Pass is currently available for purchase.\n\nRace Passes open 7 days before a race weekend and remain available until the scheduled Grand Prix begins.', components: [] });
        return;
      }
      const menu = new StringSelectMenuBuilder()
        .setCustomId(RACE_SELECT_PREFIX + ':' + country)
        .setPlaceholder('Select the F1 race')
        .addOptions(races.slice(0, 25).map((race) => ({
          label: race.name,
          value: race.key,
          description: race.raceStartAt.toLocaleString('en-GB', { timeZone: race.timezone, dateStyle: 'medium', timeStyle: 'short' }),
        })));
      await interaction.update({
        content: '## 🏁 Choose your Race Pass\n\nSelect the specific F1 race you want your pass for.\n\n**Price:** ' + money(payment) + '\n\nThe pass activates when that race weekend begins and expires 5 hours after the scheduled race end.',
        components: [new ActionRowBuilder().addComponents(menu)],
      });
      return;
    }

    await showMembershipPayment(interaction, country, type);
    return;
  }

  if (id.startsWith(RACE_SELECT_PREFIX + ':')) {
    const [, country] = id.split(':');
    const raceKey = interaction.values?.[0];
    const race = getRacePass(raceKey);
    if (!race || !getAvailableRacePasses().some((item) => item.key === raceKey)) {
      await interaction.update({ content: '⚠️ That Race Pass is no longer available. Please start the membership purchase again.', components: [] });
      return;
    }
    await showMembershipPayment(interaction, country, 'race', raceKey);
    return;
  }

  if (id.startsWith(PAID_PREFIX + ':')) {
    const [, country, type, raceKey] = id.split(':');
    if (!membershipPayments[country]?.[type]) return;
    if (type === 'race' && (!raceKey || !getRacePass(raceKey))) return;
    const modal = new ModalBuilder()
      .setCustomId(PAID_PREFIX + ':' + country + ':' + type + (raceKey ? ':' + raceKey : ''))
      .setTitle('Confirm your payment');
    const payerName = new TextInputBuilder()
      .setCustomId('payer_name')
      .setLabel(country === 'india' ? 'Name shown on your UPI payment' : 'Name shown on your PayPal payment')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(120)
      .setPlaceholder('Enter the payer name');
    modal.addComponents(new ActionRowBuilder().addComponents(payerName));
    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith(VERIFY_PREFIX + ':')) {
    await verifyPayment(interaction, client, id.slice((VERIFY_PREFIX + ':').length));
    return;
  }

  if (id.startsWith(REJECT_PREFIX + ':')) {
    await rejectPayment(interaction, client, id.slice((REJECT_PREFIX + ':').length));
  }
}

export async function handlePurchaseModal(interaction, client) {
  const id = interaction.customId || '';
  if (!id.startsWith(PAID_PREFIX + ':')) return false;
  const [, country, type, raceKey] = id.split(':');
  const payment = membershipPayments[country]?.[type];
  if (!payment) return true;

  await interaction.deferReply();
  const payerName = interaction.fields.getTextInputValue('payer_name').trim();
  if (!payerName) return interaction.editReply('❌ Please enter the payer name.');

  if (type === 'race' && (!raceKey || !getAvailableRacePasses().some((race) => race.key === raceKey))) return interaction.editReply('⚠️ That Race Pass is no longer available for purchase.');
  const selectedRace = raceKey ? getRacePass(raceKey) : null;
  const existing = await PaymentVerification.findOne({ userId: interaction.user.id, status: 'pending' });
  if (existing) return interaction.editReply('⚠️ You already have a payment verification request pending. Please wait for an admin to verify it.');

  const request = await PaymentVerification.create({
    requestId: randomUUID(),
    userId: interaction.user.id,
    guildId: config.guildId,
    country,
    type,
    amount: payment.amount,
    currency: payment.currency,
    payerName,
    raceKey: selectedRace?.key || null,
    raceName: selectedRace?.name || null,
    status: 'pending',
  });

  try {
    const channel = await client.channels.fetch(config.channels.dmLogs);
    if (!channel) throw new Error('Log channel not found');
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('💳 Membership Payment Verification Needed')
      .setTimestamp()
      .addFields(
        { name: '👤 User', value: interaction.user.tag + '\n`' + interaction.user.id + '`', inline: true },
        { name: '🎟️ Membership', value: MEMBERSHIP_DETAILS[type].name, inline: true },
        ...(selectedRace ? [{ name: '🏁 Race', value: selectedRace.name, inline: true }] : []),
        { name: '💰 Amount', value: money(payment), inline: true },
        { name: '🌍 Payment region', value: country === 'india' ? 'India / UPI' : 'International / PayPal', inline: true },
        { name: '🧾 Payer name', value: payerName, inline: true },
        { name: '🆔 Request ID', value: '`' + request.requestId + '`', inline: true },
      )
      .setFooter({ text: 'Payment is NOT verified yet. Check the actual transaction before granting.' });
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(VERIFY_PREFIX + ':' + request.requestId).setLabel('Verify & Grant').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(REJECT_PREFIX + ':' + request.requestId).setLabel('Reject').setStyle(ButtonStyle.Danger),
    );
    await channel.send({ embeds: [embed], components: [buttons] });
  } catch (error) {
    await PaymentVerification.deleteOne({ _id: request._id });
    console.error('Failed to send payment verification log:', error);
    return interaction.editReply('❌ I could not notify the admin verification channel. Please try again.');
  }

  await interaction.editReply('✅ Payment details submitted for manual verification.\n\nAn admin will check the payment and grant your membership if it is confirmed.');
  return true;
}

async function verifyPayment(interaction, client, requestId) {
  const { isAdmin } = await import('../utils/validators.js');
  if (!interaction.inGuild() || !isAdmin(interaction.member, config.roles.admin)) {
    return interaction.reply({ content: '❌ You do not have permission to verify memberships.', ephemeral: true });
  }
  await interaction.deferUpdate();
  const request = await PaymentVerification.findOneAndUpdate(
    { requestId, status: 'pending' },
    { $set: { status: 'processing', verifiedBy: interaction.user.id } },
    { new: true }
  );
  if (!request) return interaction.followUp({ content: '⚠️ This request has already been processed.', ephemeral: true });

  let user;
  let result;

  try {
    user = await client.users.fetch(request.userId);
    if (request.type === 'race') {
      result = await createRacePass({ client, guild: interaction.guild, user, paymentRequest: request, raceKey: request.raceKey });
    } else {
      result = await grantMembership({ client, guild: interaction.guild, user, type: request.type, grantedBy: interaction.user, source: 'Manual payment verification', paymentRequest: request });
    }

    request.status = 'verified';
    request.verifiedAt = new Date();
    await request.save();
  } catch (error) {
    await PaymentVerification.updateOne(
      { _id: request._id, status: 'processing' },
      { $set: { status: 'pending', verifiedBy: null } }
    );
    console.error('Failed to verify membership payment:', error);
    await interaction.followUp({
      content: '❌ Membership could not be granted: ' + (error?.message || 'Unknown error') + '. The request remains pending.',
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.message.edit({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Membership Payment Verified & Granted').setTimestamp().addFields(
        { name: '👤 User', value: user.tag + '\n`' + user.id + '`', inline: true },
        { name: '🎟️ Membership', value: result.membershipName || 'Race Pass', inline: true },
        { name: '💰 Amount', value: request.currency + ' ' + request.amount, inline: true },
        { name: '🧾 Payer name', value: request.payerName, inline: true },
        { name: '👮 Verified by', value: interaction.user.tag, inline: true },
        ...(request.raceName ? [{ name: '🏁 Race', value: request.raceName, inline: true }] : []),
        { name: '⏰ Expires', value: '<t:' + Math.floor(result.expiry.getTime() / 1000) + ':F>', inline: true },
      )],
      components: [],
    });
  } catch (error) {
    console.error('Failed to update payment verification log message:', error);
  }

  await interaction.followUp({
    content: '✅ Payment verified and membership granted. The user was DMd and the grant was logged.',
    ephemeral: true,
  });
}

async function rejectPayment(interaction, client, requestId) {
  const { isAdmin } = await import('../utils/validators.js');
  if (!interaction.inGuild() || !isAdmin(interaction.member, config.roles.admin)) {
    return interaction.reply({ content: '❌ You do not have permission to reject memberships.', ephemeral: true });
  }
  await interaction.deferUpdate();
  const request = await PaymentVerification.findOneAndUpdate(
    { requestId, status: 'pending' },
    { $set: { status: 'rejected', rejectedBy: interaction.user.id, rejectedAt: new Date() } },
    { new: true }
  );
  if (!request) return interaction.followUp({ content: '⚠️ This request has already been processed.', ephemeral: true });

  try {
    const user = await client.users.fetch(request.userId);
    await user.send('❌ Your ' + MEMBERSHIP_DETAILS[request.type].name + ' payment could not be verified, so no membership was granted. If you believe this was a mistake, please contact the Ace\'s Apex team.');
  } catch (error) {
    console.error('Failed to notify rejected payment user:', error);
  }

  await interaction.message.edit({
    embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Membership Payment Rejected').setTimestamp().addFields(
      { name: '👤 User', value: '<@' + request.userId + '>\n`' + request.userId + '`', inline: true },
      { name: '🎟️ Membership', value: MEMBERSHIP_DETAILS[request.type].name, inline: true },
      { name: '💰 Amount', value: request.currency + ' ' + request.amount, inline: true },
      { name: '🧾 Payer name', value: request.payerName, inline: true },
      { name: '👮 Rejected by', value: interaction.user.tag, inline: true },
      { name: '🆔 Request ID', value: '`' + request.requestId + '`', inline: true },
    )],
    components: [],
  });
  await interaction.followUp({ content: '❌ Payment request rejected. The user was notified.', ephemeral: true });
}

export const purchasePrefixes = { COUNTRY_PREFIX, TYPE_PREFIX, PAID_PREFIX, VERIFY_PREFIX, REJECT_PREFIX, RACE_SELECT_PREFIX };