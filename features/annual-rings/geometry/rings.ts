import type { MonthRecord, YearRecord } from '../domain/types';
import { calendarAngle, polarPoint, type Point } from './polar';

export type RingSample = Point & {
  month: number;
  radius: number;
  weight: number;
};

export function annualRingSamples(
  center: Point,
  year: YearRecord,
  index: number,
  gap = 32,
): RingSample[] {
  const baseline = 72 + index * gap;
  return year.months.map((month) => sampleMonth(center, month, baseline));
}

export function sampleMonth(
  center: Point,
  month: MonthRecord,
  baseline: number,
): RingSample {
  const radius = baseline + month.priceShape * 10;
  return {
    ...polarPoint(center, radius, calendarAngle(month.month)),
    month: month.month,
    radius,
    weight: 0.8 + month.volumeWeight * 2.6,
  };
}

export function nearestMonth(
  samples: RingSample[],
  target: Point,
  tolerance: number,
): number | null {
  const nearest = samples.reduce<RingSample | null>((winner, sample) => {
    if (!winner) return sample;
    return squaredDistance(sample, target) < squaredDistance(winner, target)
      ? sample
      : winner;
  }, null);
  if (!nearest || squaredDistance(nearest, target) > tolerance ** 2) return null;
  return nearest.month;
}

function squaredDistance(left: Point, right: Point): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}
