import mongoose from 'mongoose';

const saleConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  inrAmount: { type: Number, required: true, min: 1 },
  usdAmount: { type: Number, required: true, min: 0.01 },
  paypalUrl: { type: String, required: true, trim: true },
  qrBase64: { type: String, required: true },
  qrContentType: { type: String, default: 'image/png' },
  qrFileName: { type: String, default: 'upi-qr.png' },
  expiresAt: { type: Date, required: true }, // Last time new purchases are accepted.
  roleExpiresAt: { type: Date, required: true }, // When purchased Race Pass access ends.
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

saleConfigSchema.index({ guildId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });

export const SaleConfig = mongoose.model('SaleConfig', saleConfigSchema);
