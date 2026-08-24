import { blobMarketCache } from '@/server/market-cache/blob-store';
import { readCachedMarketData } from '@/server/market-cache/read';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return readCachedMarketData(blobMarketCache);
}
