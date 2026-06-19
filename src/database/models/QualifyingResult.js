import mongoose from 'mongoose';

const qualifyingResultSchema = new mongoose.Schema({
  qualifyingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Qualifying',
    required: true,
    unique: true,
  },
  poleDriver: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

export const QualifyingResult = mongoose.model(
  'QualifyingResult',
  qualifyingResultSchema
);