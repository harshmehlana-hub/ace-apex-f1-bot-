import mongoose from 'mongoose';

const pointTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  season: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  sourceType: {
    type: String,
    enum: ['race_result', 'qualifying_result', 'admin_adjustment', 'legacy_adjustment'],
    required: true,
  },
  sourceId: { type: String, required: true },
  reason: { type: String, default: '' },
  createdBy: { type: String, default: null },
}, { timestamps: true });

pointTransactionSchema.index(
  { userId: 1, season: 1, sourceType: 1, sourceId: 1 },
  { unique: true }
);

export const PointTransaction = mongoose.model('PointTransaction', pointTransactionSchema);
