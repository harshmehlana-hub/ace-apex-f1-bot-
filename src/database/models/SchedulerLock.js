import mongoose from 'mongoose';

const schedulerLockSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  holder: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

export const SchedulerLock = mongoose.model('SchedulerLock', schedulerLockSchema);
