import mongoose from 'mongoose';

const raceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  raceStartTime: { type: Date, required: true, index: true },
  season: { type: String, required: true, index: true },
  racePassKey: { type: String, default: null, index: true },
  predictionOpenTime: { type: Date, required: true },
  predictionCloseTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'open', 'closed', 'completed', 'cancelled'],
    default: 'upcoming',
    index: true,
  },
  predictorOfTheWeekIds: { type: [String], default: [] },
  announcementSent: { type: Boolean, default: false },
  reminder12hSent: { type: Boolean, default: false },
  reminder6hSent: { type: Boolean, default: false },
  reminder1hSent: { type: Boolean, default: false },
  statisticsSent: { type: Boolean, default: false },
}, { timestamps: true });

raceSchema.index({ season: 1, raceStartTime: 1 });
raceSchema.index({ season: 1, name: 1 }, { unique: true });

raceSchema.virtual('isPredictionOpen').get(function () {
  const now = new Date();
  return this.status === 'open' && now >= this.predictionOpenTime && now < this.predictionCloseTime;
});

export const Race = mongoose.model('Race', raceSchema);
