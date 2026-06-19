import mongoose from 'mongoose';

const qualifyingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  sessionStartTime: {
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
  },
}, {
  timestamps: true,
});

export const Qualifying = mongoose.model('Qualifying', qualifyingSchema);