import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['race', 'qualifying'],
    required: true,
  },

  name: {
    type: String,
    required: true,
  },

  channelId: {
    type: String,
    required: true,
  },

  predictionCloseTime: {
    type: Date,
    required: true,
  },

  nextAnnouncementAt: {
    type: Date,
    required: true,
    index: true,
  },

  sendIndex: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export const Announcement = mongoose.model(
  'Announcement',
  announcementSchema
);