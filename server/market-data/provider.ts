import { aggregateMarketData } from '@/features/annual-rings/domain/aggregate';
import { parseMarketCsv } from '@/features/annual-rings/domain/market';
import type { MarketDocument } from '@/features/annual-rings/domain/types';

export const MARKET_SOURCE_URL =
  'https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv';

export async function fetchMarketDocument(
  fetchImpl: typeof fetch,
  now: Date,
): Promise<MarketDocument> {
  const response = await fetchImpl(MARKET_SOURCE_URL, {
    headers: { Accept: 'text/csv' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Market provider returned ${response.status}.`);
  return aggregateMarketData(parseMarketCsv(await response.text()), now.toISOString());
}
