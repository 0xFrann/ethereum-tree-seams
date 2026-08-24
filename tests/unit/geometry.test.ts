import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarAngle, polarPoint } from '@/features/annual-rings/geometry/polar';
import { annualRingSamples, nearestMonth } from '@/features/annual-rings/geometry/rings';
import type { YearRecord } from '@/features/annual-rings/domain/types';

const year: YearRecord = {
  year: 2024,
  firstDate: '2024-01-01',
  lastDate: '2024-12-31',
  startProgress: 0,
  progress: 1,
  annual: { open: 1, close: 2, high: 3, low: 1, volumeUsd: 5 },
  months: [
    {
      month: 0,
      open: 1,
      close: 2,
      high: 3,
      low: 1,
      volumeUsd: 5,
      priceShape: -1,
      volumeWeight: 0,
    },
    {
      month: 1,
      open: 1,
      close: 2,
      high: 3,
      low: 1,
      volumeUsd: 5,
      priceShape: 1,
      volumeWeight: 1,
    },
  ],
};

test('calendar positions begin at twelve o’clock and preserve price relief', () => {
  const point = polarPoint({ x: 0, y: 0 }, 10, calendarAngle(0));
  assert.ok(point.y < 0);

  const samples = annualRingSamples({ x: 100, y: 100 }, year, 0);
  assert.equal(
    (samples[1]?.radius ?? -Infinity) > (samples[0]?.radius ?? Infinity),
    true,
  );
});

test('pointer hit regions select a month without changing its visual radius', () => {
  const samples = annualRingSamples({ x: 100, y: 100 }, year, 0);
  const january = samples[0];
  if (!january) throw new Error('Expected a January sample.');
  assert.equal(nearestMonth(samples, { x: january.x + 8, y: january.y }, 12), 0);
  assert.equal(nearestMonth(samples, { x: january.x + 20, y: january.y }, 12), null);
});
