import mongoose from 'mongoose';

const raceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  raceStartTime: {
    type: Date,
    required: true,
  },
  predictionOpenTime: {
    type: Date,
    required: true,
  },
  predictionCloseTime: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'open', 'closed', 'completed'],
    default: 'upcoming',
    index: true,
  },
  announcementSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Virtual to check if predictions are currently open
raceSchema.virtual('isPredictionOpen').get(function() {
  const now = new Date();
  return this.status === 'open' && 
         now >= this.predictionOpenTime && 
         now < this.predictionCloseTime;
});

export const Race = mongoose.model('Race', raceSchema);
