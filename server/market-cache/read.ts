import { parseMarketDocument } from '@/server/market-data/document';
import type { MarketCache } from './types';

export async function readCachedMarketData(cache: MarketCache): Promise<Response> {
  try {
    const snapshot = await cache.read();
    if (!snapshot) return unavailable('Market data is awaiting its first refresh.');
    const data = parseMarketDocument(snapshot.text);
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, must-revalidate',
        'X-Market-Refreshed-At': data.refreshedAt,
        'X-Market-Source-Cutoff': data.source.cutoff,
        ...(snapshot.etag ? { ETag: snapshot.etag } : {}),
      },
    });
  } catch {
    return unavailable('Market data is temporarily unavailable.');
  }
}

function unavailable(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '3600' } },
  );
}
