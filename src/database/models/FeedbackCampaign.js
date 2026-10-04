import mongoose from 'mongoose';

const feedbackCampaignSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  raceKey: { type: String, required: true, index: true },
  raceName: { type: String, required: true },
  startedBy: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

feedbackCampaignSchema.index({ guildId: 1, raceKey: 1 }, { unique: true });

export const FeedbackCampaign = mongoose.model('FeedbackCampaign', feedbackCampaignSchema);
