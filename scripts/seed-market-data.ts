import { blobMarketCache } from '@/server/market-cache/blob-store';
import { refreshCachedMarketData } from '@/server/market-cache/refresh';
import { fetchMarketDocument } from '@/server/market-data/provider';

const result = await refreshCachedMarketData(
  blobMarketCache,
  () => fetchMarketDocument(fetch, new Date()),
  new Date(),
);

console.log(`${result.status}: ${result.data.source.cutoff}`);
