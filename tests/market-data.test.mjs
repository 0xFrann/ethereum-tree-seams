import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateMarketData, parseCryptoDataDownloadCsv } from "../lib/market-data.mjs";

const data = JSON.parse(await readFile(new URL("../data/eth-market.json", import.meta.url), "utf8"));

function syntheticRows() {
  const rows = [];
  for (let year = 2019; year <= 2025; year += 1) {
    for (let date = new Date(Date.UTC(year, 0, 1)); date.getUTCFullYear() === year; date.setUTCDate(date.getUTCDate() + 1)) {
      const day = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000);
      const price = 100 + year - 2019 + day / 10;
      rows.push({
        unix: Math.floor(date.getTime() / 1000),
        date: date.toISOString().slice(0, 10),
        symbol: "ETH/USD",
        open: price,
        high: price + 2,
        low: price - 2,
        close: price + 1,
        volumeEth: 10,
        volumeUsd: 1_000_000 + day,
      });
    }
  }
  return rows;
}

test("parses the documented CryptoDataDownload format", () => {
  const rows = parseCryptoDataDownloadCsv([
    "https://www.CryptoDataDownload.com",
    "unix,date,symbol,open,high,low,close,Volume ETH,Volume USD",
    "1546300800,2019-01-01 00:00:00,ETH/USD,130.72,141.25,129.50,139.75,28500.87,3982997.05",
  ].join("\n"));
  assert.equal(rows[0].date, "2019-01-01");
  assert.equal(rows[0].close, 139.75);
  assert.equal(rows[0].volumeUsd, 3982997.05);
});

test("aggregates seven complete calendar years", () => {
  assert.deepEqual(data.years.map((year) => year.year), [2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  assert.ok(data.years.every((year) => year.months.length === 12));
  assert.ok(data.years.every((year) => year.priceShape.length === 48));
});

test("reproduces known annual and monthly Bitstamp values", () => {
  const year2021 = data.years.find((year) => year.year === 2021);
  const year2024 = data.years.find((year) => year.year === 2024);
  assert.deepEqual(year2021.annual, {
    open: 737.5,
    close: 3677,
    high: 4868.79,
    low: 716.24,
    returnPct: 398.6,
    volumeUsd: 43671227176,
  });
  assert.equal(year2024.months[10].open, 2514);
  assert.equal(year2024.months[10].close, 3706.3);
  assert.equal(year2024.months[10].returnPct, 47.4);
});

test("keeps artistic encodings within documented normalized domains", () => {
  for (const year of data.years) {
    assert.equal(Math.min(...year.priceShape), -1);
    assert.equal(Math.max(...year.priceShape), 1);
    for (const month of year.months) {
      assert.ok(month.volumeWeight >= 0 && month.volumeWeight <= 1);
    }
  }
});

test("rejects an incomplete calendar year", () => {
  const rows = syntheticRows().filter((row) => row.date !== "2020-02-29");
  assert.throws(() => aggregateMarketData(rows), /Expected a complete 2020/);
});

test("aggregates a complete synthetic source without external files", () => {
  const generated = aggregateMarketData(syntheticRows());
  assert.equal(generated.years.length, 7);
  assert.equal(generated.years[1].months[1].month, 1);
  assert.ok(generated.years[0].annual.close > generated.years[0].annual.open);
});
