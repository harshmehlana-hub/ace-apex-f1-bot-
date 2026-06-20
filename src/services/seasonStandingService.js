import { SeasonStanding } from '../database/models/SeasonStanding.js';

export async function getOrCreateSeasonStanding(
  userId,
  season
) {
  let standing = await SeasonStanding.findOne({
    userId,
    season,
  });

  if (!standing) {
    standing = await SeasonStanding.create({
      userId,
      season,
    });
  }

  return standing;
}