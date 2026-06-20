import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },

  channelId: {
    type: String,
    required: true,
  },

  message: {
    type: String,
    required: true,
  },

  remindAt: {
    type: Date,
    required: true,
    index: true,
  },

  sent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export const Reminder = mongoose.model(
  'Reminder',
  reminderSchema
);