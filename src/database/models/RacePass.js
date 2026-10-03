import mongoose from 'mongoose';

const racePassSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, required: true },
  raceKey: { type: String, required: true, index: true },
  raceName: { type: String, required: true },
  country: { type: String, enum: ['india', 'international'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['INR', 'USD'], required: true },
  paymentRequestId: { type: String, required: true, unique: true },
  purchasedAt: { type: Date, default: Date.now },
  activationAt: { type: Date, required: true },
  raceStartAt: { type: Date, required: true },
  raceEndAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'expired', 'cancelled'],
    default: 'scheduled',
    index: true,
  },
  activatedAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null },
}, { timestamps: true });

racePassSchema.index({ userId: 1, raceKey: 1 }, { unique: true });
racePassSchema.index({ status: 1, activationAt: 1 });
racePassSchema.index({ status: 1, expiresAt: 1 });

export const RacePass = mongoose.model('RacePass', racePassSchema);
