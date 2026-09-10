import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketDocument, MARKET_SOURCE_URL } from "../scripts/fetch-market-data.mjs";
import { MARKET_DATA_START } from "../lib/market-data.mjs";

const HEADER = "unix,date,symbol,open,high,low,close,Volume ETH,Volume USD";

function syntheticCsv(endDate = "2025-12-31") {
  const lines = ["https://www.CryptoDataDownload.com", HEADER];
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let date = new Date(`${MARKET_DATA_START}T00:00:00Z`); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const year = date.getUTCFullYear();
    const day = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000);
    const price = 100 + year - 2017 + day / 10;
    const iso = date.toISOString().slice(0, 10);
    // Before 2018-02-28 the source swaps its two volume columns; the parser repairs it.
    const [volumeEth, volumeUsd] = iso <= "2018-02-27" ? [1_000_000 + day * 100, 10] : [10, 1_000_000 + day * 100];
    lines.push([Math.floor(date.getTime() / 1000), `${iso} 00:00:00`, "ETH/USD", price, price + 2, price - 2, price + 1, volumeEth, volumeUsd].join(","));
  }
  return lines.join("\n");
}

function fetchStub(status, body) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { "content-type": "text/csv" } });
  };
  return { calls, fetchImpl };
}

test("fetches the source once and writes a complete specimen document", async () => {
  const { calls, fetchImpl } = fetchStub(200, syntheticCsv());
  const document = await buildMarketDocument({ fetchImpl, now: () => new Date("2026-01-02T03:04:05.000Z") });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, MARKET_SOURCE_URL);
  assert.equal(document.cache.updatedAt, "2026-01-02T03:04:05.000Z");
  assert.equal(document.source.cutoff, "2025-12-31");
  assert.equal(document.chronology.marketDataFrom, MARKET_DATA_START);
  assert.equal(document.years.at(-1).year, 2025);
  assert.ok(Array.isArray(document.milestones) && document.milestones.length > 0);
  assert.ok(!("scars" in document));
});

test("rejects a failed upstream response instead of writing anything", async () => {
  const { fetchImpl } = fetchStub(503, "unavailable");
  await assert.rejects(buildMarketDocument({ fetchImpl }), /returned 503/);
});

test("rejects a response that is not the documented CSV", async () => {
  const { fetchImpl } = fetchStub(200, "<html>maintenance</html>");
  await assert.rejects(buildMarketDocument({ fetchImpl }), /CSV header/);
});

test("rejects a history that no longer starts at the documented first day", async () => {
  const { fetchImpl } = fetchStub(200, syntheticCsv().replace("2017-11-09 00:00:00", "2017-11-10 00:00:00"));
  await assert.rejects(buildMarketDocument({ fetchImpl }));
});
