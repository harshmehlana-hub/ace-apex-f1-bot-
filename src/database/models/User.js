import mongoose from 'mongoose';

// Legacy score fields are retained only so the startup migration can read old data.
// New scoring never writes them; SeasonStanding + PointTransaction are authoritative.
const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  totalPoints: { type: Number, default: 0 },
  perfectPredictions: { type: Number, default: 0 },
  pointsReachedAt: { type: Date, default: null },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
