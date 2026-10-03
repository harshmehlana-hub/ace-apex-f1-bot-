import mongoose from 'mongoose';

const qualifyingSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  season: { type: String, required: true, index: true },
  sessionStartTime: { type: Date, required: true, index: true },
  predictionOpenTime: { type: Date, required: true },
  predictionCloseTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'open', 'closed', 'completed', 'cancelled'],
    default: 'upcoming',
    index: true,
  },
  announcementSent: { type: Boolean, default: false },
}, { timestamps: true });

qualifyingSchema.index({ season: 1, name: 1 }, { unique: true });
qualifyingSchema.index({ season: 1, sessionStartTime: 1 });

export const Qualifying = mongoose.model('Qualifying', qualifyingSchema);
