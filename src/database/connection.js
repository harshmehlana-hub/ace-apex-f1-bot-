import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}
