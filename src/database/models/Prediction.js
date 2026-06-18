import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  raceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Race',
    required: true,
    index: true,
  },
  p1Driver: {
    type: String,
    required: true,
  },
  p2Driver: {
    type: String,
    required: true,
  },
  p3Driver: {
    type: String,
    required: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  pointsAwarded: {
    type: Number,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound index for unique prediction per user per race
predictionSchema.index({ userId: 1, raceId: 1 }, { unique: true });

export const Prediction = mongoose.model('Prediction', predictionSchema);
