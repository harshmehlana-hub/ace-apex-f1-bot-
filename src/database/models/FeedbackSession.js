import mongoose from 'mongoose';

const feedbackSessionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  raceKey: { type: String, required: true },
  raceName: { type: String, required: true },
  userId: { type: String, required: true },
  attended: { type: Boolean, default: null },
  rating: { type: Number, min: 1, max: 5, default: null },
  improvement: { type: String, default: '' },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

feedbackSessionSchema.index({ guildId: 1, raceKey: 1, userId: 1 }, { unique: true });
feedbackSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 });

export const FeedbackSession = mongoose.model('FeedbackSession', feedbackSessionSchema);
