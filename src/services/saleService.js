import { randomUUID } from 'crypto';
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, Routes,
} from 'discord.js';
import { PaymentVerification } from '../database/models/PaymentVerification.js';
import { SaleConfig } from '../database/models/SaleConfig.js';
import { SaleEntitlement } from '../database/models/SaleEntitlement.js';
import { RacePass } from '../database/models/RacePass.js';
import { Membership } from '../database/models/Membership.js';
import { config } from '../config.js';
import { isAdmin } from '../utils/validators.js';

const SETUP_MODAL = 'sale:setup-modal';
const COUNTRY = 'sale:country';
const PAID = 'sale:paid';
const PAYMENT_MODAL = 'sale:payment-modal';
const VERIFY_PREFIX = 'membership_verify:';
const REJECT_PREFIX = 'membership_reject:';
const pendingUploads = new Map();

function money(country, sale) {
  return country === 'india' ? '₹' + sale.inrAmount : '$' + sale.usdAmount.toFixed(2);
}

export async function startSaleSetup(interaction) {
  const modal = new ModalBuilder().setCustomId(SETUP_MODAL).setTitle('Configure sale');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sale_name').setLabel('Sale name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue('End of Season Pass')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prices').setLabel('Prices: INR, USD (e.g. 99, 4.99)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30).setValue('99, 4.99')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('paypal_url').setLabel('PayPal payment link').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500).setPlaceholder('https://...')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sale_expiry').setLabel('Sale expiry (UTC ISO, e.g. 2026-11-15T18:30:00Z)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30).setPlaceholder('2026-11-15T18:30:00Z')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_expiry').setLabel('Race Pass role expiry (UTC ISO)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30).setPlaceholder('2026-12-07T00:00:00Z'))
  );
  await interaction.showModal(modal);
}

export async function handleSaleModal(interaction) {
  if (!interaction.isModalSubmit() || interaction.customId !== SETUP_MODAL) return false;
  if (!interaction.inGuild() || !isAdmin(interaction.member, config.roles.admin)) {
    await interaction.reply({ content: '❌ You do not have permission to configure a sale.', ephemeral: true });
    return true;
  }
  const name = interaction.fields.getTextInputValue('sale_name').trim();
  const priceParts = interaction.fields.getTextInputValue('prices').split(',').map(value => Number(value.trim()));
  const [inrAmount, usdAmount] = priceParts;
  const paypalUrl = interaction.fields.getTextInputValue('paypal_url').trim();
  const saleExpiryInput = interaction.fields.getTextInputValue('sale_expiry').trim();
  const roleExpiryInput = interaction.fields.getTextInputValue('role_expiry').trim();
  const saleExpiresAt = new Date(saleExpiryInput);
  const roleExpiresAt = new Date(roleExpiryInput);
  if (!name || priceParts.length !== 2 || !Number.isFinite(inrAmount) || inrAmount <= 0 || !Number.isFinite(usdAmount) || usdAmount <= 0) {
    await interaction.reply({ content: '❌ Enter a sale name and valid prices as `INR, USD` (for example `99, 4.99`).', ephemeral: true });
    return true;
  }
  const hasTimezone = value => /(Z|[+-]\\d{2}:?\\d{2})$/i.test(value);
  if (Number.isNaN(saleExpiresAt.getTime()) || Number.isNaN(roleExpiresAt.getTime()) || !hasTimezone(saleExpiryInput) || !hasTimezone(roleExpiryInput)) {
    await interaction.reply({ content: '❌ Enter both dates as ISO date/time with timezone, e.g. `2026-11-15T18:30:00Z` (UTC).', ephemeral: true });
    return true;
  }
  if (saleExpiresAt <= new Date() || roleExpiresAt <= new Date() || roleExpiresAt < saleExpiresAt) {
    await interaction.reply({ content: '❌ Both dates must be in the future, and Race Pass role expiry must be on or after sale expiry.', ephemeral: true });
    return true;
  }
  let parsedUrl;
  try { parsedUrl = new URL(paypalUrl); } catch {}
  if (!parsedUrl || parsedUrl.protocol !== 'https:' || !/(^|\.)(paypal\.com|paypal\.me)$/i.test(parsedUrl.hostname)) {
    await interaction.reply({ content: '❌ Please enter a valid HTTPS PayPal link.', ephemeral: true });
    return true;
  }
  pendingUploads.set(interaction.user.id, {
    guildId: interaction.guildId, channelId: interaction.channelId, name, inrAmount, usdAmount,
    paypalUrl, saleExpiresAt, roleExpiresAt, createdBy: interaction.user.id, expiresAfter: Date.now() + 10 * 60 * 1000,
  });
  await interaction.reply({
    content: '✅ Sale details received. Upload the UPI QR image in this channel within 10 minutes. The new sale replaces the active sale after the image is saved.\n\n**Sale closes:** <t:' + Math.floor(saleExpiresAt.getTime() / 1000) + ':F>\n**Race Pass role expires:** <t:' + Math.floor(roleExpiresAt.getTime() / 1000) + ':F>',
    ephemeral: true,
  });
  return true;
}

export async function handleSaleUploadMessage(message) {
  if (!message || message.author?.bot || !message.guild || !message.attachments?.size) return false;
  const pending = pendingUploads.get(message.author.id);
  if (!pending || pending.guildId !== message.guild.id || pending.channelId !== message.channel.id) return false;
  if (Date.now() > pending.expiresAfter) {
    pendingUploads.delete(message.author.id);
    await message.reply('⌛ Sale setup expired. Run /sale again.');
    return true;
  }
  if (!isAdmin(message.member, config.roles.admin)) return false;
  const attachment = message.attachments.find(a => /^image\/(png|jpeg|webp)$/i.test(a.contentType || '') && a.size <= 2 * 1024 * 1024);
  if (!attachment) {
    await message.reply('❌ Please attach a PNG, JPG, or WEBP image no larger than 2 MB.');
    return true;
  }
  try {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error('Could not download the QR image.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 2 * 1024 * 1024) throw new Error('QR image exceeds the 2 MB limit.');
    const newSale = await SaleConfig.create({
      guildId: pending.guildId,
      name: pending.name, inrAmount: pending.inrAmount, usdAmount: pending.usdAmount,
      paypalUrl: pending.paypalUrl, qrBase64: buffer.toString('base64'),
      qrContentType: attachment.contentType || 'image/png', qrFileName: attachment.name || 'upi-qr.png',
      expiresAt: pending.saleExpiresAt, roleExpiresAt: pending.roleExpiresAt, active: false, createdBy: pending.createdBy,
    });
    await SaleConfig.updateMany({ guildId: pending.guildId, active: true }, { $set: { active: false } });
    await SaleConfig.updateOne({ _id: newSale._id }, { $set: { active: true } });
    pendingUploads.delete(message.author.id);
    await message.reply('✅ **' + pending.name + '** is now active. Users can DM SALE to purchase it. The UPI QR image is saved with the sale.');
    await message.delete().catch(() => {});
    return true;
  } catch (error) {
    console.error('Failed to save sale QR:', error);
    await message.reply('❌ I could not save the QR image. Run /sale again and retry.');
    return true;
  }
}

export async function startSalePurchase(user) {
  const pendingPayment = await PaymentVerification.findOne({ userId: user.id, status: { $in: ['pending', 'processing'] } });
  if (pendingPayment) {
    await user.send('⚠️ You already have a payment verification request pending. Please wait for an admin to verify it.');
    return;
  }
  const sale = await SaleConfig.findOne({ guildId: config.guildId, active: true, expiresAt: { $gt: new Date() } }).lean();
  if (!sale) {
    await user.send('🏁 There is no active sale right now. Please check again later.');
    return;
  }
  await user.send({
    content: '## 🏁 ' + sale.name + '\n\nChoose where you are paying from. This sale accepts new purchases until <t:' + Math.floor(new Date(sale.expiresAt).getTime() / 1000) + ':F>. Verified buyers keep the Race Pass role until <t:' + Math.floor(new Date(sale.roleExpiresAt || sale.expiresAt).getTime() / 1000) + ':F>.',
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(COUNTRY + ':india:' + sale._id).setLabel('🇮🇳 India · ₹' + sale.inrAmount).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(COUNTRY + ':international:' + sale._id).setLabel('🌎 International · $' + sale.usdAmount.toFixed(2)).setStyle(ButtonStyle.Secondary),
    )],
  });
}

export async function handleSaleInteraction(interaction) {
  const id = interaction.customId || '';
  if (id.startsWith(COUNTRY + ':')) {
    const [, , country, saleId] = id.split(':');
    if (!['india', 'international'].includes(country)) return true;
    const sale = await SaleConfig.findOne({ _id: saleId, guildId: config.guildId, expiresAt: { $gt: new Date() } }).lean();
    if (!sale) return interaction.update({ content: '🏁 This sale is no longer active.', components: [] });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PAID + ':' + country + ':' + sale._id).setLabel('I have paid').setStyle(ButtonStyle.Success)
    );
    if (country === 'international') row.addComponents(new ButtonBuilder().setLabel('Pay with PayPal').setStyle(ButtonStyle.Link).setURL(sale.paypalUrl));
    const content = '## ' + sale.name + '\n\n**Price:** ' + money(country, sale) +
      '\n**Sale closes:** <t:' + Math.floor(new Date(sale.expiresAt).getTime() / 1000) + ':F>' +
      '\n**Race Pass role expires:** <t:' + Math.floor(new Date(sale.roleExpiresAt || sale.expiresAt).getTime() / 1000) + ':F>\n\n' +
      (country === 'india'
        ? 'Scan the UPI QR below, complete payment, then click I have paid and enter the payer name.'
        : 'Click Pay with PayPal, complete payment, then click I have paid and enter the payer name.') +
      '\n\n⚠️ Access is granted only after an admin manually verifies your payment.';
    if (country === 'india') {
      return interaction.update({ content, files: [new AttachmentBuilder(Buffer.from(sale.qrBase64, 'base64'), { name: sale.qrFileName || 'upi-qr.png' })], components: [row] });
    }
    return interaction.update({ content, components: [row] });
  }

  if (id.startsWith(PAID + ':')) {
    const [, , country, saleId] = id.split(':');
    const sale = await SaleConfig.findOne({ _id: saleId, guildId: config.guildId }).lean();
    if (!sale || new Date(sale.expiresAt) <= new Date()) return interaction.reply({ content: '⚠️ This sale has expired.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(PAYMENT_MODAL + ':' + country + ':' + saleId + ':' + interaction.message.id).setTitle('Confirm your payment');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('payer_name').setLabel(country === 'india' ? 'Name shown on your UPI payment' : 'Name shown on your PayPal payment').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(120).setPlaceholder('Enter the payer name')
    ));
    await interaction.showModal(modal);
    return true;
  }
  return false;
}

export async function handleSalePaymentModal(interaction, client) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith(PAYMENT_MODAL + ':')) return false;
  const [, , country, saleId, messageId] = interaction.customId.split(':');
  await interaction.deferReply({ ephemeral: true });
  const sale = await SaleConfig.findOne({ _id: saleId, guildId: config.guildId }).lean();
  if (!sale || new Date(sale.expiresAt) <= new Date()) return interaction.editReply('⚠️ This sale has expired.');
  const payerName = interaction.fields.getTextInputValue('payer_name').trim();
  if (!payerName) return interaction.editReply('❌ Please enter the payer name.');
  const existing = await PaymentVerification.findOne({ userId: interaction.user.id, status: { $in: ['pending', 'processing'] } });
  if (existing) return interaction.editReply('⚠️ You already have a payment verification request pending.');
  const amount = country === 'india' ? sale.inrAmount : sale.usdAmount;
  const currency = country === 'india' ? 'INR' : 'USD';
  const request = await PaymentVerification.create({
    requestId: randomUUID(), userId: interaction.user.id, guildId: config.guildId, country,
    type: 'sale', saleName: sale.name, saleExpiresAt: sale.expiresAt, saleRoleExpiresAt: sale.roleExpiresAt || sale.expiresAt, saleConfigId: sale._id.toString(),
    amount, currency, payerName, status: 'pending',
  });
  try {
    const channel = await client.channels.fetch(config.channels.dmLogs);
    if (!channel) throw new Error('Payment log channel not found.');
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('💳 Sale Payment Verification Needed').setTimestamp().addFields(
      { name: '👤 User', value: interaction.user.tag + '\n' + interaction.user.id, inline: true },
      { name: '🎟️ Sale', value: sale.name, inline: true },
      { name: '💰 Amount', value: money(country, sale), inline: true },
      { name: '🌍 Payment region', value: country === 'india' ? 'India / UPI' : 'International / PayPal', inline: true },
      { name: '🧾 Payer name', value: payerName, inline: true },
      { name: '🛒 Sale closes', value: '<t:' + Math.floor(new Date(sale.expiresAt).getTime() / 1000) + ':F>', inline: true },
      { name: '⏰ Role expires', value: '<t:' + Math.floor(new Date(sale.roleExpiresAt || sale.expiresAt).getTime() / 1000) + ':F>', inline: true },
      { name: '🆔 Request ID', value: request.requestId, inline: true },
    ).setFooter({ text: 'Payment is NOT verified yet. Check the actual transaction before granting access.' });
    await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(VERIFY_PREFIX + request.requestId).setLabel('Verify & Grant').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(REJECT_PREFIX + request.requestId).setLabel('Reject').setStyle(ButtonStyle.Danger),
    )] });
  } catch (error) {
    await PaymentVerification.deleteOne({ _id: request._id });
    console.error('Failed to log sale payment request:', error);
    return interaction.editReply('❌ I could not notify the admin verification channel. Please try again.');
  }
  await interaction.editReply('✅ Payment details submitted for manual verification. Access is granted only after an admin verifies the payment.');
  if (messageId && interaction.channel?.messages) {
    const paymentMessage = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (paymentMessage) {
      const rows = paymentMessage.components.map(row => {
        const rebuilt = ActionRowBuilder.from(row);
        for (const component of rebuilt.components) {
          if (component.customId?.startsWith(PAID + ':')) component.setLabel('Payment submitted').setDisabled(true);
        }
        return rebuilt;
      });
      await paymentMessage.edit({ components: rows }).catch(() => {});
    }
  }
  return true;
}

export async function grantSaleEntitlement({ client, guild, user, paymentRequest }) {
  const expiry = new Date(paymentRequest.saleRoleExpiresAt || paymentRequest.saleExpiresAt);
  if (!paymentRequest.saleExpiresAt || expiry <= new Date()) throw new Error('This sale access period has expired.');
  let entitlement = await SaleEntitlement.findOne({ requestId: paymentRequest.requestId });
  if (entitlement && (entitlement.status !== 'active' || entitlement.expiresAt <= new Date())) throw new Error('This sale entitlement has already expired.');
  if (!entitlement) entitlement = await SaleEntitlement.create({
    requestId: paymentRequest.requestId, userId: user.id, guildId: guild.id,
    saleName: paymentRequest.saleName || 'Sale Pass', expiresAt: expiry, status: 'active',
  });
  if (!config.roles.racePass) throw new Error('Race Pass role is not configured.');
  await client.rest.put(Routes.guildMemberRole(guild.id, user.id, config.roles.racePass));
  await user.send('**🏁 Sale Pass access granted!**\n\n**Sale:** ' + entitlement.saleName + '\n**Valid until:** <t:' + Math.floor(expiry.getTime() / 1000) + ':F>\n\nEnjoy the remaining race weekends with Ace\'s Apex! 🏎️').catch(error => console.error('Sale access DM failed:', error));
  return { membershipName: entitlement.saleName, expiry };
}

export async function processSaleEntitlements(client) {
  const now = new Date();
  const expired = await SaleEntitlement.find({ status: 'active', expiresAt: { $lte: now } }).limit(200);
  for (const item of expired) {
    const claimed = await SaleEntitlement.findOneAndUpdate({ _id: item._id, status: 'active' }, { $set: { status: 'expired' } }, { new: true });
    if (!claimed) continue;
    const [otherSale, otherPass, legacyRace] = await Promise.all([
      SaleEntitlement.exists({ userId: claimed.userId, guildId: claimed.guildId, status: 'active', expiresAt: { $gt: now }, _id: { $ne: claimed._id } }),
      RacePass.exists({ userId: claimed.userId, guildId: claimed.guildId, status: 'active', expiresAt: { $gt: now } }),
      Membership.exists({ userId: claimed.userId, guildId: claimed.guildId, type: 'race', expiresAt: { $gt: now } }),
    ]);
    if (!otherSale && !otherPass && !legacyRace && config.roles.racePass) {
      await client.rest.delete(Routes.guildMemberRole(claimed.guildId, claimed.userId, config.roles.racePass)).catch(error => { if (error?.status !== 404) console.error('Failed to remove expired sale Race Pass role:', error); });
    }
    try {
      const user = await client.users.fetch(claimed.userId);
      await user.send('🏁 Your ' + claimed.saleName + ' access has expired. Thank you for supporting Ace\'s Apex!');
    } catch (error) { console.error('Sale expiry DM failed:', error); }
  }
}
