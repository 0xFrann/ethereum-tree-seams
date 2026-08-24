import type { EventSelection, MarketDocument, MonthSelection } from './types';

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function initialSelection(data: MarketDocument): MonthSelection {
  const year = data.years.at(-1);
  const month = year?.months.at(-1);
  if (!year || !month) throw new Error('Market data has no selectable month.');
  return { year: year.year, month: month.month };
}

export function selectedMonth(data: MarketDocument, selection: MonthSelection) {
  return data.years
    .find((year) => year.year === selection.year)
    ?.months.find((month) => month.month === selection.month);
}

export function eventSelectionForDate(
  data: MarketDocument,
  date: string,
): EventSelection {
  const milestone = data.milestones.find((event) => event.date === date);
  if (milestone) return { kind: 'milestone', id: milestone.id };
  const scar = data.scars.find((event) => event.date === date);
  return scar ? { kind: 'scar', id: scar.id } : null;
}

export function chronologicalMonths(data: MarketDocument): MonthSelection[] {
  return data.years.flatMap((year) =>
    year.months.map((month) => ({ year: year.year, month: month.month })),
  );
}

export function moveSelection(
  data: MarketDocument,
  current: MonthSelection,
  offset: number,
): MonthSelection {
  const months = chronologicalMonths(data);
  const index = months.findIndex(
    (month) => month.year === current.year && month.month === current.month,
  );
  if (index < 0) return initialSelection(data);
  return months[Math.max(0, Math.min(months.length - 1, index + offset))] ?? current;
}
