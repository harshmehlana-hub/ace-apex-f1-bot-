import mongoose from 'mongoose';

const saleEntitlementSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  guildId: { type: String, required: true, index: true },
  saleName: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['active', 'expired'], default: 'active', index: true },
  grantedAt: { type: Date, default: Date.now },
}, { timestamps: true });

saleEntitlementSchema.index({ guildId: 1, userId: 1, status: 1, expiresAt: 1 });
export const SaleEntitlement = mongoose.model('SaleEntitlement', saleEntitlementSchema);
