import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, calculateQualifyingScore } from '../src/services/scoringService.js';

test('race scoring awards the configured points for 0, 1, 2, or 3 correct positions', () => {
  const result = { p1Driver: 'VER', p2Driver: 'NOR', p3Driver: 'LEC' };
  const cases = [
    [{ p1Driver: 'HAM', p2Driver: 'SAI', p3Driver: 'RUS' }, 0, 0],
    [{ p1Driver: 'VER', p2Driver: 'SAI', p3Driver: 'RUS' }, 1, 15],
    [{ p1Driver: 'VER', p2Driver: 'NOR', p3Driver: 'RUS' }, 2, 18],
    [{ p1Driver: 'VER', p2Driver: 'NOR', p3Driver: 'LEC' }, 3, 25],
  ];

  for (const [prediction, correctPositions, points] of cases) {
    const score = calculateScore(prediction, result);
    assert.equal(score.correctPositions, correctPositions);
    assert.equal(score.points, points);
    assert.equal(score.isPerfect, correctPositions === 3);
  }
});

test('qualifying scoring distinguishes a correct pole prediction from an incorrect one', () => {
  const result = { poleDriver: 'VER' };
  assert.equal(calculateQualifyingScore({ predictedDriver: 'VER' }, result), 5);
  assert.equal(calculateQualifyingScore({ predictedDriver: 'NOR' }, result), 0);
});
