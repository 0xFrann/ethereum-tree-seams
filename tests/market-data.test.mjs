import assert from "node:assert/strict";
import test from "node:test";
import { aggregateMarketData, EARLY_VOLUME_FIX_END, ETHEREUM_GENESIS, MARKET_DATA_START, parseCryptoDataDownloadCsv } from "../lib/market-data.mjs";

function syntheticRows(endDate = "2025-12-31") {
  const rows = [];
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let date = new Date(`${MARKET_DATA_START}T00:00:00Z`); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const year = date.getUTCFullYear();
    const day = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000);
    const price = 100 + year - 2017 + day / 10;
    rows.push({ unix: Math.floor(date.getTime() / 1000), date: date.toISOString().slice(0, 10), symbol: "ETH/USD", open: price, high: price + 2, low: price - 2, close: price + 1, volumeEth: 10, volumeUsd: 1_000_000 + day * 100 });
  }
  return rows;
}

test("parses CDD and repairs the documented early volume-column anomaly", () => {
  const rows = parseCryptoDataDownloadCsv(["https://www.CryptoDataDownload.com", "unix,date,symbol,open,high,low,close,Volume ETH,Volume USD", "1510185600,2017-11-09 00:00:00,ETH/USD,310,320,300,315,3982997.05,12850.87"].join("\n"));
  assert.equal(rows[0].date, MARKET_DATA_START);
  assert.equal(rows[0].volumeEth, 12850.87);
  assert.equal(rows[0].volumeUsd, 3982997.05);
  assert.equal(EARLY_VOLUME_FIX_END, "2018-02-27");
});

test("begins with the partial 2017 ring and derives chronology metadata", () => {
  const data = aggregateMarketData(syntheticRows(), { updatedAt: "2026-08-21T14:00:00.000Z" });
  assert.equal(data.chronology.origin, ETHEREUM_GENESIS);
  assert.equal(data.chronology.marketDataFrom, MARKET_DATA_START);
  assert.equal(data.chronology.preSeriesLabel, "2015-07-30—2017-11-08");
  assert.equal(data.years[0].year, 2017);
  assert.ok(data.years[0].startProgress > 0.85);
  assert.deepEqual(data.years[0].months.map((month) => month.month), [10, 11]);
  assert.equal(data.period, "2017–2025");
});

test("keeps encodings normalized and exposes event/cache metadata", () => {
  const data = aggregateMarketData(syntheticRows(), { updatedAt: "2026-08-21T14:00:00.000Z" });
  for (const year of data.years) {
    assert.ok(year.priceShape.every((value) => value >= -1 && value <= 1));
    assert.ok(year.volumeShape.every((value) => value >= 0 && value <= 1));
    assert.equal(year.volumeShape.length, year.months.length * 4);
    assert.ok(year.months.every((month) => month.volumeWeight >= 0 && month.volumeWeight <= 1));
  }
  assert.equal(data.cache.schemaVersion, 3);
  const january = data.years.find((year) => year.year === 2018).months[0];
  assert.equal(january.averageClose, 103.5);
  assert.equal(january.low, 99);
  assert.equal(january.high, 106);
  assert.equal(data.milestones.length, 11);
  assert.equal(data.scars.length, 9);
});

test("accepts an incomplete current year and discloses source gaps without filling them", () => {
  const rows = syntheticRows("2026-08-13").filter((row) => row.date !== "2026-05-22");
  const data = aggregateMarketData(rows);
  const latest = data.years.at(-1);
  assert.equal(latest.year, 2026);
  assert.equal(latest.lastDate, "2026-08-13");
  assert.equal(latest.months.length, 8);
  assert.ok(latest.progress > 0.61 && latest.progress < 0.62);
  assert.deepEqual(data.source.gaps, ["2026-05-22"]);
});

test("rejects duplicate dates and malformed OHLC data", () => {
  const rows = syntheticRows();
  assert.throws(() => aggregateMarketData([...rows, { ...rows[0] }]), /Duplicate ETH\/USD dates/);
  assert.throws(() => aggregateMarketData(rows.map((row, index) => index ? row : { ...row, low: row.high + 1 })), /Invalid OHLC range/);
});

test("rejects truncated history and date/Unix disagreement", () => {
  assert.throws(() => aggregateMarketData(syntheticRows().slice(1)), /must begin on 2017-11-09/);
  assert.throws(
    () => aggregateMarketData(syntheticRows().map((row, index) => index ? row : { ...row, unix: row.unix + 86_400 })),
    /Unix timestamp does not match/,
  );
});
