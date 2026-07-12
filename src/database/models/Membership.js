import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },

  guildId: {
    type: String,
    required: true,
  },

  roleId: {
    type: String,
    required: true,
  },

  type: {
    type: String,
    enum: ['race', 'monthly', 'yearly'],
    required: true,
  },

  expiresAt: {
    type: Date,
    required: true,
  },
});

export const Membership = mongoose.model(
  'Membership',
  membershipSchema
);