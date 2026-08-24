import { get, put } from '@vercel/blob';
import type { CacheSnapshot, CacheWrite, MarketCache } from './types';

export const MARKET_CACHE_PATH = 'market-data/latest.json';

export const blobMarketCache: MarketCache = {
  async read(): Promise<CacheSnapshot | null> {
    const response = await get(MARKET_CACHE_PATH, { access: 'private', useCache: false });
    if (!response || response.statusCode !== 200 || !response.stream) return null;
    return { text: await new Response(response.stream).text(), etag: response.blob.etag };
  },

  async write({ text, previousEtag }: CacheWrite): Promise<void> {
    await put(MARKET_CACHE_PATH, text, {
      access: 'private',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      contentType: 'application/json; charset=utf-8',
      ...(previousEtag ? { ifMatch: previousEtag } : { allowOverwrite: false }),
    });
  },
};
