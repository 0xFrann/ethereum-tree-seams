import type { MarketDocument, MonthSelection } from '../domain/types';
import type { Point } from './polar';
import { annualRingSamples, nearestMonth } from './rings';

export function monthAtPoint(
  data: MarketDocument,
  point: Point,
  center: Point,
  tolerance = 18,
): MonthSelection | null {
  for (let index = data.years.length - 1; index >= 0; index -= 1) {
    const year = data.years[index];
    if (!year) continue;
    const month = nearestMonth(annualRingSamples(center, year, index), point, tolerance);
    if (month !== null) return { year: year.year, month };
  }
  return null;
}
