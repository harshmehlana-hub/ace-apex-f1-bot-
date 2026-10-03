import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  active: { type: Boolean, default: false, index: true },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

seasonSchema.index({ active: 1 }, { unique: true, partialFilterExpression: { active: true } });

export const Season = mongoose.model('Season', seasonSchema);
