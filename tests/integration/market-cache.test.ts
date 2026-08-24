import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateMarketData } from '@/features/annual-rings/domain/aggregate';
import { parseMarketCsv } from '@/features/annual-rings/domain/market';
import { readCachedMarketData } from '@/server/market-cache/read';
import { refreshCachedMarketData } from '@/server/market-cache/refresh';
import type { CacheWrite, MarketCache } from '@/server/market-cache/types';

const CSV = [
  'unix,date,symbol,open,high,low,close,Volume ETH,Volume USD',
  '1510185600,2017-11-09 00:00:00,ETH/USD,320,330,310,310,6200,20',
].join('\n');

class MemoryCache implements MarketCache {
  value: string | null = null;
  etag = 'v1';
  writes = 0;

  async read() {
    return this.value ? { text: this.value, etag: this.etag } : null;
  }

  async write(value: CacheWrite) {
    if (this.value && value.previousEtag !== this.etag)
      throw new Error('Conditional write failed.');
    this.writes += 1;
    this.value = value.text;
    this.etag = `v${this.writes + 1}`;
  }
}

test('a refresh is last-known-good and idempotent within the hour', async () => {
  const cache = new MemoryCache();
  let providerCalls = 0;
  const now = new Date('2026-08-24T17:00:00.000Z');
  const load = async () => {
    providerCalls += 1;
    return aggregateMarketData(parseMarketCsv(CSV), now.toISOString());
  };

  assert.equal((await refreshCachedMarketData(cache, load, now)).status, 'refreshed');
  assert.equal((await refreshCachedMarketData(cache, load, now)).status, 'skipped');
  assert.equal(providerCalls, 1);
  assert.equal(cache.writes, 1);
});

test('the visitor route reads only cache data', async () => {
  const cache = new MemoryCache();
  const now = new Date('2026-08-24T17:00:00.000Z');
  await refreshCachedMarketData(
    cache,
    () => Promise.resolve(aggregateMarketData(parseMarketCsv(CSV), now.toISOString())),
    now,
  );

  const response = await readCachedMarketData(cache);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('Cache-Control'),
    'public, max-age=60, s-maxage=300, must-revalidate',
  );
  assert.equal((await response.json()).source.cutoff, '2017-11-09');
});
