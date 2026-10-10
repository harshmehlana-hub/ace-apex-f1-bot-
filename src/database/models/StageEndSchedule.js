import mongoose from 'mongoose';

const stageEndScheduleSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  scheduledAt: { type: Date, required: true, index: true },
  createdBy: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], default: 'pending', index: true },
  lastError: { type: String, default: null },
}, { timestamps: true });

stageEndScheduleSchema.index({ status: 1, scheduledAt: 1 });

export const StageEndSchedule = mongoose.model('StageEndSchedule', stageEndScheduleSchema);
