import { validateEvents } from '@/features/annual-rings/domain/events';
import type { MarketDocument } from '@/features/annual-rings/domain/types';

export function parseMarketDocument(text: string): MarketDocument {
  const value: unknown = JSON.parse(text);
  if (!isDocument(value)) throw new Error('Cached market data has an invalid shape.');
  if (!Number.isFinite(Date.parse(value.refreshedAt)))
    throw new Error('Cached market data has an invalid refresh time.');
  validateEvents(value.milestones, value.scars);
  return value;
}

function isDocument(value: unknown): value is MarketDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<MarketDocument>;
  return (
    document.schemaVersion === 1 &&
    typeof document.refreshedAt === 'string' &&
    Array.isArray(document.years) &&
    document.years.length > 0 &&
    Array.isArray(document.milestones) &&
    Array.isArray(document.scars) &&
    typeof document.source?.cutoff === 'string' &&
    typeof document.chronology?.marketDataFrom === 'string'
  );
}
