const session = (key, name, qualifying, race, timezone, racePassKey = key) => {
  const qualifyingStartAt = new Date(qualifying);
  const raceStartAt = new Date(race);
  const raceLocalDate = race.slice(0, 10);
  const raceLocalOffset = race.slice(-6);
  const raceLocalMidnight = new Date(raceLocalDate + 'T00:00:00' + raceLocalOffset);
  const weekendStartAt = new Date(raceLocalMidnight.getTime() - 2 * 24 * 60 * 60 * 1000);

  return {
    key,
    name,
    qualifyingName: name.replace('Grand Prix', 'Qualifying'),
    timezone,
    qualifyingStartAt,
    raceStartAt,
    weekendStartAt,
    racePassKey,
  };
};

// Official 2026 calendar currently used by F1, including the relocated
// Bahrain Grand Prix in Malaysia. Times are the published local session times
// converted to absolute instants with the circuit's UTC offset.
// Sprint sessions are intentionally not included because this bot predicts
// the main qualifying and Grand Prix only.
export const SEASON_CALENDAR_2026 = [
  session('australia', 'Australian Grand Prix', '2026-03-07T16:00:00+11:00', '2026-03-08T15:00:00+11:00', 'Australia/Melbourne'),
  session('china', 'Chinese Grand Prix', '2026-03-14T15:00:00+08:00', '2026-03-15T15:00:00+08:00', 'Asia/Shanghai'),
  session('japan', 'Japanese Grand Prix', '2026-03-28T15:00:00+09:00', '2026-03-29T14:00:00+09:00', 'Asia/Tokyo'),
  session('saudi-arabia', 'Saudi Arabian Grand Prix', '2026-04-18T20:00:00+03:00', '2026-04-19T20:00:00+03:00', 'Asia/Riyadh'),
  session('miami', 'Miami Grand Prix', '2026-05-02T16:00:00-04:00', '2026-05-03T16:00:00-04:00', 'America/New_York'),
  session('canada', 'Canadian Grand Prix', '2026-05-23T16:00:00-04:00', '2026-05-24T16:00:00-04:00', 'America/Toronto'),
  session('monaco', 'Monaco Grand Prix', '2026-06-06T16:00:00+02:00', '2026-06-07T15:00:00+02:00', 'Europe/Monaco'),
  session('barcelona-catalunya', 'Barcelona-Catalunya Grand Prix', '2026-06-13T16:00:00+02:00', '2026-06-14T15:00:00+02:00', 'Europe/Madrid'),
  session('austria', 'Austrian Grand Prix', '2026-06-27T16:00:00+02:00', '2026-06-28T15:00:00+02:00', 'Europe/Vienna'),
  session('great-britain', 'British Grand Prix', '2026-07-04T16:00:00+01:00', '2026-07-05T15:00:00+01:00', 'Europe/London'),
  session('belgium', 'Belgian Grand Prix', '2026-07-18T16:00:00+02:00', '2026-07-19T15:00:00+02:00', 'Europe/Brussels'),
  session('hungary', 'Hungarian Grand Prix', '2026-07-25T16:00:00+02:00', '2026-07-26T15:00:00+02:00', 'Europe/Budapest'),
  session('netherlands', 'Dutch Grand Prix', '2026-08-22T16:00:00+02:00', '2026-08-23T15:00:00+02:00', 'Europe/Amsterdam'),
  session('italy', 'Italian Grand Prix', '2026-09-05T16:00:00+02:00', '2026-09-06T15:00:00+02:00', 'Europe/Rome'),
  session('spain', 'Spanish Grand Prix', '2026-09-12T16:00:00+02:00', '2026-09-13T15:00:00+02:00', 'Europe/Madrid'),
  session('azerbaijan', 'Azerbaijan Grand Prix', '2026-09-25T16:00:00+04:00', '2026-09-26T15:00:00+04:00', 'Asia/Baku'),
  session('bahrain-malaysia', 'Bahrain Grand Prix in Malaysia', '2026-10-03T16:00:00+08:00', '2026-10-04T15:00:00+08:00', 'Asia/Kuala_Lumpur'),
  session('singapore', 'Singapore Grand Prix', '2026-10-10T21:00:00+08:00', '2026-10-11T20:00:00+08:00', 'Asia/Singapore'),
  session('united-states', 'United States Grand Prix', '2026-10-24T16:00:00-05:00', '2026-10-25T15:00:00-05:00', 'America/Chicago'),
  session('mexico', 'Mexico City Grand Prix', '2026-10-31T15:00:00-06:00', '2026-11-01T14:00:00-06:00', 'America/Mexico_City'),
  session('sao-paulo', 'São Paulo Grand Prix', '2026-11-07T15:00:00-03:00', '2026-11-08T14:00:00-03:00', 'America/Sao_Paulo'),
  session('las-vegas', 'Las Vegas Grand Prix', '2026-11-21T20:00:00-08:00', '2026-11-21T20:00:00-08:00', 'America/Los_Angeles'),
  session('qatar', 'Qatar Grand Prix', '2026-11-28T21:00:00+03:00', '2026-11-29T19:00:00+03:00', 'Asia/Qatar'),
  session('abu-dhabi', 'Abu Dhabi Grand Prix', '2026-12-05T18:00:00+04:00', '2026-12-06T17:00:00+04:00', 'Asia/Dubai'),
];

export const SEASON_CALENDAR_BY_SEASON = {
  '2026': SEASON_CALENDAR_2026,
};

export function getSeasonCalendar(season) {
  return SEASON_CALENDAR_BY_SEASON[String(season)] || [];
}

export function getCalendarRace(key, season) {
  return getSeasonCalendar(season).find((race) => race.key === key) || null;
}

export function getCalendarRaceByName(name, season) {
  return getSeasonCalendar(season).find((race) => race.name === name) || null;
}

export function getCalendarChoices(season) {
  return getSeasonCalendar(season).map((race) => ({
    name: race.name,
    value: race.key,
  }));
}
