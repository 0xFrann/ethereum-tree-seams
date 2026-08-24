import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateMarketData } from '@/features/annual-rings/domain/aggregate';
import { parseMarketCsv } from '@/features/annual-rings/domain/market';

const CSV = [
  'source notice',
  'unix,date,symbol,open,high,low,close,Volume ETH,Volume USD',
  '1510358400,2017-11-11 00:00:00,ETH/USD,300,330,290,320,6400,20',
  '1510272000,2017-11-10 00:00:00,ETH/USD,310,320,300,300,6000,20',
  '1510185600,2017-11-09 00:00:00,ETH/USD,320,330,310,310,6200,20',
].join('\n');

test('normalizes source order and preserves the partial first year', () => {
  const data = aggregateMarketData(parseMarketCsv(CSV), '2026-08-24T00:00:00.000Z');

  assert.equal(data.chronology.marketDataFrom, '2017-11-09');
  assert.equal(data.source.cutoff, '2017-11-11');
  assert.equal((data.years[0]?.startProgress ?? 0) > 0.8, true);
  assert.equal(data.years[0]?.months[0]?.volumeUsd, 18_600);
});

test('rejects duplicate or invalid OHLC observations', () => {
  assert.throws(() =>
    parseMarketCsv(`${CSV}\n1510185600,2017-11-09 00:00:00,ETH/USD,3,2,4,5,1,1`),
  );
  assert.throws(() =>
    parseMarketCsv(CSV.replace(',310,320,300,300,', ',310,299,300,300,')),
  );
});
