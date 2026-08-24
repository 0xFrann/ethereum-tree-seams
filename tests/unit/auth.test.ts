import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRefreshAuthorization } from '@/server/market-data/auth';

test('refresh authorization requires the exact bearer secret', () => {
  assert.equal(hasRefreshAuthorization('Bearer private-value', 'private-value'), true);
  assert.equal(hasRefreshAuthorization('Bearer private-value', 'other-value'), false);
  assert.equal(hasRefreshAuthorization(null, 'private-value'), false);
  assert.equal(hasRefreshAuthorization('Bearer private-value', undefined), false);
});
