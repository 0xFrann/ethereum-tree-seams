import { assertIsoDate, dateFromUnixSeconds } from './dates';
import type { DailyMarketRecord } from './types';

const HEADER = 'unix,date,symbol,open,high,low,close,Volume ETH,Volume USD';
export const MARKET_DATA_START = '2017-11-09';

export function parseMarketCsv(text: string): DailyMarketRecord[] {
  const lines = text.trim().split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line === HEADER);
  if (headerIndex < 0) throw new Error('The market CSV header is missing.');

  const records = lines
    .slice(headerIndex + 1)
    .filter(Boolean)
    .map(parseLine);
  const ethUsd = records.filter(
    (record) => record.symbol === 'ETH/USD' && record.date >= MARKET_DATA_START,
  );
  ethUsd.sort((left, right) => left.date.localeCompare(right.date));
  validateRecords(ethUsd);
  if (ethUsd[0]?.date !== MARKET_DATA_START) {
    throw new Error(`Market history must start on ${MARKET_DATA_START}.`);
  }
  return ethUsd.map(({ symbol: _symbol, ...record }) => record);
}

type SourceRecord = DailyMarketRecord & { symbol: string };

function parseLine(line: string, index: number): SourceRecord {
  const columns = line.split(',');
  if (columns.length !== 9)
    throw new Error(`Market row ${index + 1} has the wrong column count.`);
  const [unix, rawDate, symbol, open, high, low, close, volumeEth, volumeUsd] = columns;
  const date = rawDate?.slice(0, 10) ?? '';
  const parsed = {
    date,
    symbol: symbol ?? '',
    unix: Number(unix),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volumeEth: Number(volumeEth),
    volumeUsd: Number(volumeUsd),
  };
  if (
    Object.values(parsed).some(
      (value) => typeof value === 'number' && !Number.isFinite(value),
    )
  ) {
    throw new Error(`Market row ${index + 1} has an invalid numeric value.`);
  }
  if (dateFromUnixSeconds(parsed.unix) !== date)
    throw new Error(`Market row ${index + 1} has a mismatched date.`);

  const reportedVolume = date <= '2018-02-27' ? parsed.volumeEth : parsed.volumeUsd;
  return { ...parsed, volumeUsd: reportedVolume };
}

function validateRecords(records: SourceRecord[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    assertIsoDate(record.date);
    if (seen.has(record.date)) throw new Error(`Duplicate market date: ${record.date}.`);
    seen.add(record.date);
    if (record.open <= 0 || record.high <= 0 || record.low <= 0 || record.close <= 0) {
      throw new Error(`Market prices must be positive on ${record.date}.`);
    }
    if (
      record.low > Math.min(record.open, record.close) ||
      record.high < Math.max(record.open, record.close)
    ) {
      throw new Error(`Market prices are inconsistent on ${record.date}.`);
    }
    if (record.volumeUsd < 0)
      throw new Error(`Market volume cannot be negative on ${record.date}.`);
  }
}
