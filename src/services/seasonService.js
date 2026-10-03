import mongoose from 'mongoose';
import { Season } from '../database/models/Season.js';
import { Race } from '../database/models/Race.js';
import { Qualifying } from '../database/models/Qualifying.js';
import { config } from '../config.js';

export async function getCurrentSeason() {
  let season = await Season.findOne({ active: true }).sort({ startedAt: -1 });
  if (!season) {
    season = await Season.create({ name: config.season, active: true });
  }
  return season.name;
}

export async function startNewSeason(name) {
  const trimmed = String(name || '').trim();
  if (!/^\d{4}$/.test(trimmed)) {
    throw new Error('Season must be a four-digit year.');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const current = await Season.findOne({ active: true }).sort({ startedAt: -1 }).session(session);
      const previousSeason = current?.name || null;

      if (previousSeason && previousSeason !== trimmed) {
        // Predictions for the old season must not remain open after the switch.
        // Closed events are deliberately preserved so their results can still be entered.
        await Race.updateMany(
          { season: previousSeason, status: { $in: ['upcoming', 'open'] } },
          { $set: { status: 'cancelled' } },
          { session }
        );
        await Qualifying.updateMany(
          { season: previousSeason, status: { $in: ['upcoming', 'open'] } },
          { $set: { status: 'cancelled' } },
          { session }
        );
      }

      await Season.updateMany({ active: true }, { $set: { active: false } }, { session });
      result = await Season.findOneAndUpdate(
        { name: trimmed },
        { $set: { active: true, startedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
    });
    return result;
  } finally {
    await session.endSession();
  }
}
