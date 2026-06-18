import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  discordId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
  },
  totalPoints: {
    type: Number,
    default: 0,
    index: true,
  },
  perfectPredictions: {
    type: Number,
    default: 0,
  },
  // Timestamp when user first reached their current point total (for tiebreaking)
  pointsReachedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Update pointsReachedAt when points change
userSchema.methods.addPoints = async function(points) {
  if (points > 0) {
    this.totalPoints += points;
    this.pointsReachedAt = new Date();
    await this.save();
  }
};

export const User = mongoose.model('User', userSchema);
