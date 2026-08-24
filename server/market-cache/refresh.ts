import { parseMarketDocument } from '@/server/market-data/document';
import type { MarketDocument } from '@/features/annual-rings/domain/types';
import type { MarketCache } from './types';

type RefreshResult =
  | { status: 'refreshed'; data: MarketDocument }
  | { status: 'skipped'; data: MarketDocument };

export async function refreshCachedMarketData(
  cache: MarketCache,
  fetchDocument: () => Promise<MarketDocument>,
  now: Date,
): Promise<RefreshResult> {
  const snapshot = await cache.read();
  const existing = snapshot ? parseMarketDocument(snapshot.text) : null;
  if (existing && isFreshWithinHour(existing.refreshedAt, now))
    return { status: 'skipped', data: existing };

  const candidate = await fetchDocument();
  if (existing && candidate.source.cutoff < existing.source.cutoff) {
    throw new Error('Market source cutoff regressed.');
  }
  await cache.write({
    text: JSON.stringify(candidate),
    previousEtag: snapshot?.etag ?? null,
  });
  return { status: 'refreshed', data: candidate };
}

function isFreshWithinHour(refreshedAt: string, now: Date): boolean {
  const refreshed = Date.parse(refreshedAt);
  if (!Number.isFinite(refreshed)) return false;
  return Math.floor(refreshed / 3_600_000) === Math.floor(now.getTime() / 3_600_000);
}
