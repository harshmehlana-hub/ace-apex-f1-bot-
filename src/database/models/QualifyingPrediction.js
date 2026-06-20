import mongoose from 'mongoose';

const qualifyingPredictionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  qualifyingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Qualifying',
    required: true,
    index: true,
  },
season: {
  type: String,
  required: true,
},
  predictedDriver: {
    type: String,
    required: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  pointsAwarded: {
    type: Number,
    default: null,
  },
}, {
  timestamps: true,
});

qualifyingPredictionSchema.index(
  { userId: 1, qualifyingId: 1 },
  { unique: true }
);

export const QualifyingPrediction = mongoose.model(
  'QualifyingPrediction',
  qualifyingPredictionSchema
);