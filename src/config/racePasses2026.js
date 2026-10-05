import { getSeasonCalendar } from './seasonCalendar2026.js';

const buildRacePass = (calendarRace) => {
  const raceStartAt = new Date(calendarRace.raceStartAt);
  const raceEndAt = new Date(raceStartAt.getTime() + 2 * 60 * 60 * 1000);
  const weekendStartAt = new Date(calendarRace.weekendStartAt);
  const purchaseStartAt = new Date(weekendStartAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  const expiryAt = new Date(raceEndAt.getTime() + 5 * 60 * 60 * 1000);

  return {
    key: calendarRace.racePassKey,
    name: calendarRace.name,
    timezone: calendarRace.timezone,
    weekendStartAt,
    purchaseStartAt,
    purchaseEndAt: raceEndAt,
    activationAt: weekendStartAt,
    raceStartAt,
    raceEndAt,
    expiryAt,
  };
};

export function getRacePassesForSeason(season) {
  return getSeasonCalendar(season).map(buildRacePass);
}

export function getAllRacePasses() {
  return getRacePassesForSeason('2026');
}

export function getRacePass(key, season = null) {
  const races = season == null ? getAllRacePasses() : getRacePassesForSeason(season);
  return races.find((race) => race.key === key) || null;
}

export function getAvailableRacePasses(now = new Date(), season = String(now.getUTCFullYear())) {
  return getRacePassesForSeason(season).filter((race) => now >= race.purchaseStartAt && now <= race.purchaseEndAt);
}

export const RACE_PASSES_2026 = getRacePassesForSeason('2026');
export const RACE_PASSES_BY_SEASON = {
  '2026': RACE_PASSES_2026,
};
