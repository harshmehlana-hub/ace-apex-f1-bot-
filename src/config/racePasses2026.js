const race = (key, name, weekendStart, raceStart, timezone) => {
  const raceStartAt = new Date(raceStart);
  const raceEndAt = new Date(raceStartAt.getTime() + 2 * 60 * 60 * 1000);
  const weekendStartAt = new Date(weekendStart);
  const purchaseStartAt = new Date(weekendStartAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  const expiryAt = new Date(raceEndAt.getTime() + 5 * 60 * 60 * 1000);

  return {
    key,
    name,
    timezone,
    weekendStartAt,
    purchaseStartAt,
    purchaseEndAt: raceEndAt,
    activationAt: weekendStartAt,
    raceStartAt,
    raceEndAt,
    expiryAt,
  };
};

// 2026 upcoming rounds. Times are the published local Grand Prix start times.
// Race end is represented by the scheduled two-hour race block, then a five-hour
// member-access buffer is added to expiryAt.
export const RACE_PASSES_2026 = [
  race('bahrain-malaysia', 'Bahrain Grand Prix in Malaysia', '2026-10-02T00:00:00+08:00', '2026-10-04T15:00:00+08:00', 'Asia/Kuala_Lumpur'),
  race('singapore', 'Singapore Grand Prix', '2026-10-09T00:00:00+08:00', '2026-10-11T20:00:00+08:00', 'Asia/Singapore'),
  race('united-states', 'United States Grand Prix', '2026-10-23T00:00:00-05:00', '2026-10-25T15:00:00-05:00', 'America/Chicago'),
  race('mexico', 'Mexico City Grand Prix', '2026-10-30T00:00:00-06:00', '2026-11-01T14:00:00-06:00', 'America/Mexico_City'),
  race('brazil', 'São Paulo Grand Prix', '2026-11-06T00:00:00-03:00', '2026-11-08T14:00:00-03:00', 'America/Sao_Paulo'),
  race('las-vegas', 'Las Vegas Grand Prix', '2026-11-19T00:00:00-08:00', '2026-11-21T20:00:00-08:00', 'America/Los_Angeles'),
  race('qatar', 'Qatar Grand Prix', '2026-11-27T00:00:00+03:00', '2026-11-29T19:00:00+03:00', 'Asia/Qatar'),
  race('abu-dhabi', 'Abu Dhabi Grand Prix', '2026-12-04T00:00:00+04:00', '2026-12-06T17:00:00+04:00', 'Asia/Dubai'),
];

export function getAvailableRacePasses(now = new Date(), season = String(now.getUTCFullYear())) {
  return getRacePassesForSeason(season).filter((race) => now >= race.purchaseStartAt && now <= race.purchaseEndAt);
}

export function getRacePass(key, season = null) {
  const races = season == null ? getAllRacePasses() : getRacePassesForSeason(season);
  return races.find((race) => race.key === key) || null;
}


export const RACE_PASSES_BY_SEASON = {
  '2026': RACE_PASSES_2026,
};

export function getRacePassesForSeason(season) {
  return RACE_PASSES_BY_SEASON[String(season)] || [];
}

export function getAllRacePasses() {
  return Object.values(RACE_PASSES_BY_SEASON).flat();
}
