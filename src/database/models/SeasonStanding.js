import mongoose from 'mongoose';

const seasonStandingSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },

  season: {
    type: String,
    required: true,
    index: true,
  },

  racePoints: {
    type: Number,
    default: 0,
  },

  qualifyingPoints: {
    type: Number,
    default: 0,
  },

  totalPoints: {
    type: Number,
    default: 0,
  },

  perfectPodiums: {
    type: Number,
    default: 0,
  },

  correctPolePredictions: {
    type: Number,
    default: 0,
  },
correctP1Predictions: {
  type: Number,
  default: 0,
},

correctP2Predictions: {
  type: Number,
  default: 0,
},

correctP3Predictions: {
  type: Number,
  default: 0,
},

racePredictionsSubmitted: {
  type: Number,
  default: 0,
},

qualifyingPredictionsSubmitted: {
  type: Number,
  default: 0,
},
}, {
  timestamps: true,
});

seasonStandingSchema.index(
  { userId: 1, season: 1 },
  { unique: true }
);

export const SeasonStanding = mongoose.model(
  'SeasonStanding',
  seasonStandingSchema
);