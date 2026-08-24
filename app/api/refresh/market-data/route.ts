import { hasRefreshAuthorization } from '@/server/market-data/auth';
import { blobMarketCache } from '@/server/market-cache/blob-store';
import { refreshCachedMarketData } from '@/server/market-cache/refresh';
import { fetchMarketDocument } from '@/server/market-data/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (
    !hasRefreshAuthorization(
      request.headers.get('authorization'),
      process.env.MARKET_REFRESH_SECRET,
    )
  ) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const result = await refreshCachedMarketData(
      blobMarketCache,
      () => fetchMarketDocument(fetch, new Date()),
      new Date(),
    );
    return Response.json(
      {
        status: result.status,
        refreshedAt: result.data.refreshedAt,
        cutoff: result.data.source.cutoff,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Market refresh failed.';
    return Response.json(
      { error: message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
