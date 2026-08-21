import { readFile } from "node:fs/promises";

export const START_YEAR = 2019;
export const END_YEAR = 2025;

const EVENTS = [
  {
    year: 2021,
    month: 7,
    name: "Poly Network exploit",
    loss: "$611M",
    sourceUrl: "https://medium.com/poly-network/poly-network-incident-analysis-1a521fe9e9e7",
  },
  {
    year: 2022,
    month: 2,
    name: "Ronin bridge exploit",
    loss: "$625M",
    sourceUrl: "https://roninchain.com/blog/posts/community-alert-ronin-validators-compromised",
  },
  {
    year: 2023,
    month: 2,
    name: "Euler Finance exploit",
    loss: "$197M",
    sourceUrl: "https://www.euler.finance/blog/2023/03/14/euler-protocol-incident-update",
  },
  {
    year: 2023,
    month: 6,
    name: "Curve pool exploits",
    loss: "~$70M",
    sourceUrl: "https://news.curve.finance/curve-dao-voting/curve-dao-vote-to-reimburse-hack-victims/",
  },
  {
    year: 2025,
    month: 1,
    name: "Bybit cold-wallet hack",
    loss: "$1.5B",
    sourceUrl: "https://www.bybit.com/en/press/post/bybit-responds-to-security-incident-blt55f1ee8ebf21d2d8/",
  },
];

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function parseCryptoDataDownloadCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("unix,date,symbol,"));
  if (headerIndex === -1) {
    throw new Error("Could not find the CryptoDataDownload CSV header.");
  }

  return lines.slice(headerIndex + 1).filter(Boolean).map((line, lineOffset) => {
    const columns = line.split(",");
    if (columns.length !== 9) {
      throw new Error(`Unexpected column count on data row ${lineOffset + 1}.`);
    }

    const [unix, date, symbol, open, high, low, close, volumeEth, volumeUsd] = columns;
    const row = {
      unix: Number(unix),
      date: date.slice(0, 10),
      symbol,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volumeEth: Number(volumeEth),
      volumeUsd: Number(volumeUsd),
    };

    if (Object.entries(row).some(([key, value]) => key !== "date" && key !== "symbol" && !Number.isFinite(value))) {
      throw new Error(`Invalid numeric value on ${row.date || `data row ${lineOffset + 1}`}.`);
    }
    return row;
  });
}

function daysInYear(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
}

function sampleMonth(rows, samplesPerMonth = 4) {
  return Array.from({ length: samplesPerMonth }, (_, index) => {
    const position = Math.min(
      rows.length - 1,
      Math.floor(((index + 0.5) / samplesPerMonth) * rows.length),
    );
    return rows[position].close;
  });
}

export function aggregateMarketData(rows) {
  const selectedRows = rows
    .filter((row) => {
      const year = Number(row.date.slice(0, 4));
      return row.symbol === "ETH/USD" && year >= START_YEAR && year <= END_YEAR;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const rawYears = [];
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const yearRows = selectedRows.filter((row) => row.date.startsWith(`${year}-`));
    if (yearRows.length !== daysInYear(year)) {
      throw new Error(`Expected a complete ${year}, found ${yearRows.length} daily rows.`);
    }

    const monthly = [];
    const sampledPrices = [];
    for (let month = 0; month < 12; month += 1) {
      const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
      const monthRows = yearRows.filter((row) => row.date.startsWith(prefix));
      if (monthRows.length === 0) {
        throw new Error(`Missing daily data for ${prefix}.`);
      }
      const volumeUsd = monthRows.reduce((sum, row) => sum + row.volumeUsd, 0);
      monthly.push({
        month,
        open: round(monthRows[0].open, 2),
        close: round(monthRows.at(-1).close, 2),
        returnPct: round((monthRows.at(-1).close / monthRows[0].open - 1) * 100, 1),
        volumeUsd: round(volumeUsd),
        averageDailyVolumeUsd: volumeUsd / monthRows.length,
      });
      sampledPrices.push(...sampleMonth(monthRows));
    }

    const logPrices = sampledPrices.map(Math.log);
    const minimum = Math.min(...logPrices);
    const maximum = Math.max(...logPrices);
    const priceShape = logPrices.map((value) => round(((value - minimum) / (maximum - minimum)) * 2 - 1, 4));
    const first = yearRows[0];
    const last = yearRows.at(-1);

    rawYears.push({
      year,
      annual: {
        open: round(first.open, 2),
        close: round(last.close, 2),
        high: round(Math.max(...yearRows.map((row) => row.high)), 2),
        low: round(Math.min(...yearRows.map((row) => row.low)), 2),
        returnPct: round((last.close / first.open - 1) * 100, 1),
        volumeUsd: round(yearRows.reduce((sum, row) => sum + row.volumeUsd, 0)),
      },
      priceShape,
      months: monthly,
    });
  }

  const logVolumes = rawYears.flatMap((year) =>
    year.months.map((month) => Math.log10(month.averageDailyVolumeUsd)),
  );
  const minVolume = Math.min(...logVolumes);
  const maxVolume = Math.max(...logVolumes);

  const years = rawYears.map((year) => ({
    ...year,
    months: year.months.map(({ averageDailyVolumeUsd, ...month }) => ({
      ...month,
      volumeWeight: round(
        (Math.log10(averageDailyVolumeUsd) - minVolume) / (maxVolume - minVolume),
        4,
      ),
    })),
  }));

  return {
    title: "Ethereum Annual Rings",
    period: `${START_YEAR}–${END_YEAR}`,
    source: {
      provider: "CryptoDataDownload",
      market: "Bitstamp ETH/USD",
      frequency: "daily",
      url: "https://www.cryptodatadownload.com/data/bitstamp/",
      cutoff: `${END_YEAR}-12-31`,
    },
    methodology: {
      price: "Four close-price samples per month, log-transformed and normalized to each year's observed range.",
      volume: "Monthly average daily USD volume, log10-transformed and normalized across the full 2019–2025 period.",
      caveat: "Ring shape shows the rhythm within each year; compare exact magnitude with the annual summary.",
    },
    years,
    events: EVENTS,
  };
}

export async function buildMarketDataFromFile(path) {
  return aggregateMarketData(parseCryptoDataDownloadCsv(await readFile(path, "utf8")));
}
