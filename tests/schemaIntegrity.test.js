import test from 'node:test';
import assert from 'node:assert/strict';
import { Membership } from '../src/database/models/Membership.js';

test('Membership is unique per guild and user', () => {
  const indexes = Membership.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => JSON.stringify(keys) === JSON.stringify({ guildId: 1, userId: 1 }) && options?.unique === true));
});

import { FeedbackSession } from '../src/database/models/FeedbackSession.js';

test('Feedback sessions are unique per guild, race and user', () => {
  const indexes = FeedbackSession.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => JSON.stringify(keys) === JSON.stringify({ guildId: 1, raceKey: 1, userId: 1 }) && options?.unique === true));
});
