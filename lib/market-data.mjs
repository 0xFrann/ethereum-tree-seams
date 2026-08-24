import { MILESTONES, ORIGIN, SCARS, validateEventData } from "./event-data.mjs";

export const ETHEREUM_GENESIS = "2015-07-30";
export const MARKET_DATA_START = "2017-11-09";
export const EARLY_VOLUME_FIX_END = "2018-02-27";
export const MARKET_SCHEMA_VERSION = 3;

const DAY_MS = 86_400_000;

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeKnownSourceAnomalies(row) {
  if (row.date >= MARKET_DATA_START && row.date <= EARLY_VOLUME_FIX_END) {
    return { ...row, volumeEth: row.volumeUsd, volumeUsd: row.volumeEth };
  }
  return row;
}

export function parseCryptoDataDownloadCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const expectedHeader = "unix,date,symbol,open,high,low,close,Volume ETH,Volume USD";
  const headerIndex = lines.findIndex((line) => line === expectedHeader);
  if (headerIndex === -1) throw new Error("Could not find the CryptoDataDownload CSV header.");

  return lines.slice(headerIndex + 1).filter(Boolean).map((line, lineOffset) => {
    const columns = line.split(",");
    if (columns.length !== 9) throw new Error(`Unexpected column count on data row ${lineOffset + 1}.`);
    const [unix, date, symbol, open, high, low, close, volumeEth, volumeUsd] = columns;
    const parsed = {
      unix: Number(unix), date: date.slice(0, 10), symbol, open: Number(open), high: Number(high),
      low: Number(low), close: Number(close), volumeEth: Number(volumeEth), volumeUsd: Number(volumeUsd),
    };
    if (Object.entries(parsed).some(([key, value]) => key !== "date" && key !== "symbol" && !Number.isFinite(value))) {
      throw new Error(`Invalid numeric value on ${parsed.date || `data row ${lineOffset + 1}`}.`);
    }
    return normalizeKnownSourceAnomalies(parsed);
  });
}

function daysInYear(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
}

function dayProgress(date, includeDay) {
  const [year, month, day] = date.split("-").map(Number);
  const elapsed = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS;
  return Math.min(1, Math.max(0, (elapsed + (includeDay ? 1 : 0)) / daysInYear(year)));
}

function sampleMonth(rows, valueAt, samplesPerMonth = 4) {
  return Array.from({ length: samplesPerMonth }, (_, index) => {
    const position = Math.min(rows.length - 1, Math.floor(((index + 0.5) / samplesPerMonth) * rows.length));
    return valueAt(rows[position]);
  });
}

function findMissingDates(rows) {
  const present = new Set(rows.map((row) => row.date));
  const missing = [];
  const cursor = new Date(`${rows[0].date}T00:00:00Z`);
  const end = new Date(`${rows.at(-1).date}T00:00:00Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (!present.has(date)) missing.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return missing;
}

function validateRows(rows) {
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Invalid source date ${row.date}.`);
    const utc = Date.parse(`${row.date}T00:00:00Z`);
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== row.date) throw new Error(`Invalid source date ${row.date}.`);
    if (!Number.isInteger(row.unix) || row.unix !== utc / 1_000) throw new Error(`Unix timestamp does not match ${row.date}.`);
    if (row.open <= 0 || row.high <= 0 || row.low <= 0 || row.close <= 0) throw new Error(`Non-positive OHLC value on ${row.date}.`);
    if (row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close) || row.low > row.high) {
      throw new Error(`Invalid OHLC range on ${row.date}.`);
    }
    if (row.volumeEth < 0 || row.volumeUsd < 0) throw new Error(`Negative volume on ${row.date}.`);
  }
}

export function aggregateMarketData(rows, options = {}) {
  validateEventData({ origin: ORIGIN, milestones: MILESTONES, scars: SCARS });
  const selectedRows = rows.filter((row) => row.symbol === "ETH/USD" && row.date >= MARKET_DATA_START).sort((a, b) => a.date.localeCompare(b.date));
  if (selectedRows.length === 0) throw new Error(`No ETH/USD rows found from ${MARKET_DATA_START} onward.`);
  if (new Set(selectedRows.map((row) => row.date)).size !== selectedRows.length) throw new Error("Duplicate ETH/USD dates found in the source data.");
  validateRows(selectedRows);
  if (selectedRows[0].date !== MARKET_DATA_START) throw new Error(`Market history must begin on ${MARKET_DATA_START}.`);

  const earliestRow = selectedRows[0];
  const latestRow = selectedRows.at(-1);
  const sourceEarliestYear = Number(earliestRow.date.slice(0, 4));
  const latestYear = Number(latestRow.date.slice(0, 4));
  const earliestYear = sourceEarliestYear;
  const gaps = findMissingDates(selectedRows);
  const rawYears = [];

  for (let year = earliestYear; year <= latestYear; year += 1) {
    const yearRows = selectedRows.filter((row) => row.date.startsWith(`${year}-`));
    if (yearRows.length === 0) throw new Error(`No ETH/USD rows found for ${year}.`);
    const monthly = [];
    const sampledPrices = [];
    const sampledVolumes = [];
    for (let month = 0; month < 12; month += 1) {
      const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
      const monthRows = yearRows.filter((row) => row.date.startsWith(prefix));
      if (monthRows.length === 0) continue;
      const volumeUsd = monthRows.reduce((sum, row) => sum + row.volumeUsd, 0);
      monthly.push({
        month, open: round(monthRows[0].open, 2), close: round(monthRows.at(-1).close, 2),
        averageClose: round(monthRows.reduce((sum, row) => sum + row.close, 0) / monthRows.length, 2),
        low: round(Math.min(...monthRows.map((row) => row.low)), 2),
        high: round(Math.max(...monthRows.map((row) => row.high)), 2),
        volumeUsd: round(volumeUsd),
        averageDailyVolumeUsd: volumeUsd / monthRows.length,
      });
      sampledPrices.push(...sampleMonth(monthRows, (row) => row.close));
      sampledVolumes.push(...sampleMonth(monthRows, (row) => row.volumeUsd));
    }
    const logPrices = sampledPrices.map(Math.log);
    const minimum = Math.min(...logPrices);
    const maximum = Math.max(...logPrices);
    const priceShape = logPrices.map((value) => round(maximum === minimum ? 0 : ((value - minimum) / (maximum - minimum)) * 2 - 1, 4));
    const first = yearRows[0];
    const last = yearRows.at(-1);
    rawYears.push({
      year, firstDate: first.date, lastDate: last.date, startProgress: round(dayProgress(first.date, false), 4), progress: round(dayProgress(last.date, true), 4),
      annual: {
        open: round(first.open, 2), close: round(last.close, 2), high: round(Math.max(...yearRows.map((row) => row.high)), 2),
        low: round(Math.min(...yearRows.map((row) => row.low)), 2),
        volumeUsd: round(yearRows.reduce((sum, row) => sum + row.volumeUsd, 0)),
      },
      priceShape, volumeSamples: sampledVolumes, months: monthly,
    });
  }

  const logVolumes = rawYears.flatMap((year) => year.volumeSamples.map(Math.log10));
  const minVolume = Math.min(...logVolumes);
  const maxVolume = Math.max(...logVolumes);
  const volumeRange = maxVolume - minVolume;
  const years = rawYears.map(({ volumeSamples, ...year }) => ({
    ...year,
    volumeShape: volumeSamples.map((volume) => round(volumeRange === 0 ? 0 : (Math.log10(volume) - minVolume) / volumeRange, 4)),
    months: year.months.map(({ averageDailyVolumeUsd, ...month }) => ({
      ...month, volumeWeight: round(volumeRange === 0 ? 0 : (Math.log10(averageDailyVolumeUsd) - minVolume) / volumeRange, 4),
    })),
  }));
  const preSeriesEnd = new Date(Date.parse(`${earliestRow.date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

  return {
    title: "Ethereum Annual Rings", period: `${earliestYear}–${latestYear}`,
    chronology: { origin: ETHEREUM_GENESIS, marketDataFrom: earliestRow.date, preSeriesLabel: `${ETHEREUM_GENESIS}—${preSeriesEnd}` },
    source: {
      provider: "CryptoDataDownload", market: "Bitstamp ETH/USD", frequency: "daily",
      url: "https://www.cryptodatadownload.com/data/bitstamp/", cutoff: latestRow.date,
      timezone: "Observed UTC day boundary", gaps, observedRows: selectedRows.length,
    },
    cache: { schemaVersion: MARKET_SCHEMA_VERSION, updatedAt: options.updatedAt ?? `${latestRow.date}T00:00:00.000Z` },
    methodology: {
      price: "Four close-price samples per observed month, log-transformed and normalized to each year's observed range.",
      volume: `Four sampled daily reported USD-volume observations per month, log10-transformed across the observed ${earliestYear}–${latestYear} Bitstamp period. The rendered weight retains global scale while amplifying each ring's within-year variation.`,
      caveat: `Ethereum chronology begins at genesis, and Bitstamp observations begin ${earliestRow.date}. The partial first year keeps its unobserved arc as ghost grain; source gaps are disclosed and never forward-filled.`,
    },
    years, milestones: MILESTONES, scars: SCARS,
  };
}
