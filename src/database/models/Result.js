import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  raceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Race',
    required: true,
    unique: true,
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
  enteredAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

export const Result = mongoose.model('Result', resultSchema);
