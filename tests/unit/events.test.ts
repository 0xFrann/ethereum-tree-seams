import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MILESTONES,
  SCARS,
  scarMagnitude,
  validateEvents,
} from '@/features/annual-rings/domain/events';

test('event records are sourced, unique, and use a deterministic scar scale', () => {
  assert.doesNotThrow(() => validateEvents(MILESTONES, SCARS));
  assert.equal(scarMagnitude(1_000_000), 0);
  assert.equal(scarMagnitude(1_500_000_000), 100);
  assert.equal(scarMagnitude(1_000_000_000) > scarMagnitude(100_000_000), true);
});
