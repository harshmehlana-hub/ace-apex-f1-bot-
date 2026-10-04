import mongoose from 'mongoose';

const feedbackResponseSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  raceKey: { type: String, required: true, index: true },
  raceName: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  attended: { type: Boolean, required: true },
  rating: { type: Number, min: 1, max: 5, default: null },
  improvement: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

feedbackResponseSchema.index({ guildId: 1, raceKey: 1, userId: 1 }, { unique: true });
feedbackResponseSchema.index({ guildId: 1, raceKey: 1, submittedAt: 1 });

export const FeedbackResponse = mongoose.model('FeedbackResponse', feedbackResponseSchema);
