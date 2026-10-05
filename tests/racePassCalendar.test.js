import test from 'node:test';
import assert from 'node:assert/strict';
import { RACE_PASSES_2026, getAvailableRacePasses, getRacePass } from '../src/config/racePasses2026.js';

test('2026 Race Pass keys are unique', () => {
  const keys = RACE_PASSES_2026.map(r => r.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('each Race Pass has a seven-day purchase window', () => {
  for (const race of RACE_PASSES_2026) {
    assert.equal(race.activationAt.getTime() - race.purchaseStartAt.getTime(), 7 * 24 * 60 * 60 * 1000);
    assert.equal(race.purchaseEndAt.getTime(), race.raceEndAt.getTime());
    assert.ok(race.expiryAt > race.raceEndAt);
  }
});

test('Race Pass lookup and availability are season-aware', () => {
  const race = RACE_PASSES_2026[0];
  assert.equal(getRacePass(race.key)?.key, race.key);
  assert.equal(getAvailableRacePasses(new Date('2026-10-01T12:00:00Z'), '2026').length > 0, true);
  assert.equal(getAvailableRacePasses(new Date('2027-01-01T00:00:00Z'), '2027').length, 0);
});
