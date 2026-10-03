import mongoose from 'mongoose';

const paymentVerificationSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    enum: ['india', 'international'],
    required: true,
  },
  type: {
    type: String,
    enum: ['race', 'monthly', 'yearly'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    enum: ['INR', 'USD'],
    required: true,
  },
  payerName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'verified', 'rejected'],
    default: 'pending',
    required: true,
  },
  verifiedBy: {
    type: String,
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  rejectedBy: {
    type: String,
    default: null,
  },
  rejectedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

paymentVerificationSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export const PaymentVerification = mongoose.model(
  'PaymentVerification',
  paymentVerificationSchema
);
