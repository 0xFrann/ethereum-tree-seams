import { dayOfYearProgress } from './dates';
import { MILESTONES, ORIGIN, SCARS } from './events';
import type { DailyMarketRecord, MarketDocument, MonthRecord, YearRecord } from './types';

const DAY_MS = 86_400_000;

export function aggregateMarketData(
  records: DailyMarketRecord[],
  refreshedAt: string,
): MarketDocument {
  if (records.length === 0) throw new Error('Cannot aggregate an empty market history.');
  const gaps = findGaps(records);
  const years = groupYears(records);
  const cutoff = records.at(-1)?.date;
  if (!cutoff) throw new Error('Market history has no cutoff.');

  return {
    schemaVersion: 1,
    refreshedAt,
    chronology: { origin: ORIGIN.date, marketDataFrom: records[0]?.date ?? '' },
    source: {
      provider: 'CryptoDataDownload',
      market: 'Bitstamp ETH/USD',
      cutoff,
      observedRows: records.length,
      gaps,
    },
    years,
    milestones: [...MILESTONES],
    scars: [...SCARS],
  };
}

function groupYears(records: DailyMarketRecord[]): YearRecord[] {
  const byYear = new Map<number, DailyMarketRecord[]>();
  for (const record of records) {
    const year = Number(record.date.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) ?? []), record]);
  }
  const rawYears = [...byYear.entries()].map(([year, rows]) => buildYear(year, rows));
  const logVolumes = rawYears.flatMap((year) =>
    year.months.map((month) => Math.log10(Math.max(month.volumeUsd, 1))),
  );
  const volumeMin = Math.min(...logVolumes);
  const volumeMax = Math.max(...logVolumes);

  return rawYears.map((year) => ({
    ...year,
    months: year.months.map((month) => ({
      ...month,
      volumeWeight: normalize(
        Math.log10(Math.max(month.volumeUsd, 1)),
        volumeMin,
        volumeMax,
      ),
    })),
  }));
}

function buildYear(year: number, rows: DailyMarketRecord[]): YearRecord {
  const months = Array.from({ length: 12 }, (_, month) => buildMonth(rows, month)).filter(
    (month): month is MonthRecord => month !== null,
  );
  const logPrices = months.map((month) => Math.log(month.close));
  const priceMin = Math.min(...logPrices);
  const priceMax = Math.max(...logPrices);
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) throw new Error(`Market year ${year} has no rows.`);

  return {
    year,
    firstDate: first.date,
    lastDate: last.date,
    startProgress: dayOfYearProgress(first.date, false),
    progress: dayOfYearProgress(last.date, true),
    annual: {
      open: first.open,
      close: last.close,
      high: Math.max(...rows.map((row) => row.high)),
      low: Math.min(...rows.map((row) => row.low)),
      volumeUsd: rows.reduce((total, row) => total + row.volumeUsd, 0),
    },
    months: months.map((month) => ({
      ...month,
      priceShape: normalize(Math.log(month.close), priceMin, priceMax) * 2 - 1,
    })),
  };
}

function buildMonth(
  rows: DailyMarketRecord[],
  month: number,
): Omit<MonthRecord, 'priceShape' | 'volumeWeight'> | null {
  const prefix = `${rows[0]?.date.slice(0, 4)}-${String(month + 1).padStart(2, '0')}`;
  const selected = rows.filter((row) => row.date.startsWith(prefix));
  const first = selected[0];
  const last = selected.at(-1);
  if (!first || !last) return null;
  return {
    month,
    open: first.open,
    close: last.close,
    high: Math.max(...selected.map((row) => row.high)),
    low: Math.min(...selected.map((row) => row.low)),
    volumeUsd: selected.reduce((total, row) => total + row.volumeUsd, 0),
  };
}

function normalize(value: number, minimum: number, maximum: number): number {
  return maximum === minimum ? 0.5 : (value - minimum) / (maximum - minimum);
}

function findGaps(records: DailyMarketRecord[]): string[] {
  const present = new Set(records.map((record) => record.date));
  const first = records[0]?.date;
  const last = records.at(-1)?.date;
  if (!first || !last) return [];
  const gaps: string[] = [];
  const cursor = new Date(`${first}T00:00:00.000Z`);
  const end = Date.parse(`${last}T00:00:00.000Z`);
  while (cursor.getTime() <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (!present.has(date)) gaps.push(date);
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return gaps;
}
