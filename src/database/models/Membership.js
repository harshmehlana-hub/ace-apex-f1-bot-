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
  default: null,
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

  fiveDayReminderSent: {
    type: Boolean,
    default: false,
  },

  oneDayReminderSent: {
    type: Boolean,
    default: false,
  },

  expiryReminderSent: {
    type: Boolean,
    default: false,
  },
});

export const Membership = mongoose.model(
  'Membership',
  membershipSchema
);