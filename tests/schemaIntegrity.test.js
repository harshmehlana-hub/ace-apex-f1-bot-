import test from 'node:test';
import assert from 'node:assert/strict';
import { Membership } from '../src/database/models/Membership.js';

test('Membership is unique per guild and user', () => {
  const indexes = Membership.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => JSON.stringify(keys) === JSON.stringify({ guildId: 1, userId: 1 }) && options?.unique === true));
});
