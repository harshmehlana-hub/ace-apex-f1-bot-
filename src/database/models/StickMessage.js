import mongoose from 'mongoose';

const stickMessageSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  createdBy: { type: String, required: true },
  intervalMinutes: { type: Number, required: true, min: 1, max: 10080 },
  active: { type: Boolean, default: true, index: true },
  nextSendAt: { type: Date, required: true, index: true },
}, { timestamps: true });

export const StickMessage = mongoose.model('StickMessage', stickMessageSchema);
