import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MARKET_CACHE_KEY,
  readMarketCacheResponse,
  refreshMarketCache,
  runScheduledRefresh,
} from "../lib/market-cache.mjs";

const NOW = new Date("2026-08-21T12:00:00.000Z");
const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/market-data/route.ts", import.meta.url), "utf8");
const viteSource = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
const hostingConfig = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
const CSV = [
  "https://www.CryptoDataDownload.com",
  "unix,date,symbol,open,high,low,close,Volume ETH,Volume USD",
  "1510272000,2017-11-10 00:00:00,ETH/USD,321.32,325.61,291.00,298.66,10580539.65,34411.65",
  "1510185600,2017-11-09 00:00:00,ETH/USD,322.15,331.70,317.29,321.32,4270934.90,13118.15",
].join("\n");

class MemoryBucket {
  constructor(initial = null) {
    this.value = initial;
    this.getCalls = 0;
    this.putCalls = 0;
    this.lastPut = null;
  }

  async get(key) {
    this.getCalls += 1;
    assert.equal(key, MARKET_CACHE_KEY);
    if (this.value === null) return null;
    return {
      httpEtag: '"memory-etag"',
      text: async () => this.value,
    };
  }

  async put(key, value, options) {
    this.putCalls += 1;
    this.lastPut = { key, value, options };
    this.value = value;
  }
}

function successfulFetch(counter) {
  return async () => {
    counter.count += 1;
    return new Response(CSV, { status: 200, headers: { "content-type": "text/csv" } });
  };
}

test("one scheduled refresh makes one request and atomically replaces the one object", async () => {
  const bucket = new MemoryBucket("old-value");
  const requests = { count: 0 };
  const result = await runScheduledRefresh({
    bucket,
    fetchImpl: successfulFetch(requests),
    now: () => NOW,
    logger: { error: () => assert.fail("refresh should not log") },
  });

  assert.equal(result.ok, true);
  assert.equal(requests.count, 1);
  assert.equal(bucket.putCalls, 1);
  assert.equal(bucket.lastPut.key, MARKET_CACHE_KEY);
  assert.equal(bucket.lastPut.options.httpMetadata.contentType, "application/json; charset=utf-8");
  const stored = JSON.parse(bucket.value);
  assert.equal(stored.cache.updatedAt, NOW.toISOString());
  assert.equal(stored.source.cutoff, "2017-11-10");
  assert.equal(bucket.lastPut.options.customMetadata.sourceCutoff, "2017-11-10");
});

test("bad upstream status makes one request and preserves the last-known-good object", async () => {
  const previous = JSON.stringify({ sentinel: "last-known-good" });
  const bucket = new MemoryBucket(previous);
  let requests = 0;
  const errors = [];
  const result = await runScheduledRefresh({
    bucket,
    fetchImpl: async () => {
      requests += 1;
      return new Response("unavailable", { status: 503 });
    },
    logger: { error: (...parts) => errors.push(parts) },
  });

  assert.equal(result.ok, false);
  assert.equal(requests, 1);
  assert.equal(bucket.putCalls, 0);
  assert.equal(bucket.value, previous);
  assert.equal(errors.length, 1);
});

test("an R2 write failure cannot erase the previous object", async () => {
  const previous = JSON.stringify({ sentinel: "last-known-good" });
  const bucket = new MemoryBucket(previous);
  bucket.put = async () => {
    bucket.putCalls += 1;
    throw new Error("R2 unavailable");
  };
  const requests = { count: 0 };
  const errors = [];

  const result = await runScheduledRefresh({
    bucket,
    fetchImpl: successfulFetch(requests),
    now: () => NOW,
    logger: { error: (...parts) => errors.push(parts) },
  });

  assert.equal(result.ok, false);
  assert.equal(requests.count, 1);
  assert.equal(bucket.putCalls, 1);
  assert.equal(bucket.value, previous);
  assert.equal(errors.length, 1);
});

test("parse and validation failures never replace the old object", async () => {
  for (const body of [
    "not,cdd,csv",
    [
      "https://www.CryptoDataDownload.com",
      "unix,date,symbol,open,high,low,close,Volume ETH,Volume USD",
      "1510185600,2017-11-09 00:00:00,ETH/USD,322.15,300.00,317.29,321.32,10,100",
    ].join("\n"),
  ]) {
    const previous = JSON.stringify({ sentinel: "last-known-good" });
    const bucket = new MemoryBucket(previous);
    let requests = 0;
    await assert.rejects(
      refreshMarketCache({
        bucket,
        fetchImpl: async () => {
          requests += 1;
          return new Response(body, { status: 200 });
        },
        now: () => NOW,
      }),
    );
    assert.equal(requests, 1);
    assert.equal(bucket.putCalls, 0);
    assert.equal(bucket.value, previous);
  }
});

test("timeout aborts the sole request and preserves the old object", async () => {
  const previous = JSON.stringify({ sentinel: "last-known-good" });
  const bucket = new MemoryBucket(previous);
  let requests = 0;

  await assert.rejects(
    refreshMarketCache({
      bucket,
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) => {
        requests += 1;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    }),
    (error) => error?.name === "TimeoutError",
  );

  assert.equal(requests, 1);
  assert.equal(bucket.putCalls, 0);
  assert.equal(bucket.value, previous);
});

test("arbitrary concurrent visitor traffic reads R2 and makes zero provider requests", async () => {
  const seedBucket = new MemoryBucket();
  await refreshMarketCache({ bucket: seedBucket, fetchImpl: successfulFetch({ count: 0 }), now: () => NOW });
  seedBucket.getCalls = 0;
  seedBucket.putCalls = 0;
  let providerRequests = 0;

  const responses = await Promise.all(
    Array.from({ length: 32 }, () => readMarketCacheResponse(seedBucket, { now: () => new Date("2026-08-21T13:00:00.000Z") })),
  );

  assert.equal(providerRequests, 0);
  assert.equal(seedBucket.getCalls, 32);
  assert.equal(seedBucket.putCalls, 0);
  assert.ok(responses.every((response) => response.status === 200));
  assert.ok(responses.every((response) => response.headers.get("X-Market-Cache-Age") === "3600"));
  assert.ok(responses.every((response) => response.headers.get("X-Market-Source-Cutoff") === "2017-11-10"));
});

test("continues serving the prior cache schema while a refresh adds monthly price details", async () => {
  const bucket = new MemoryBucket();
  await refreshMarketCache({ bucket, fetchImpl: successfulFetch({ count: 0 }), now: () => NOW });
  const legacy = JSON.parse(bucket.value);
  legacy.cache.schemaVersion = 2;
  legacy.years.forEach((year) => {
    delete year.volumeShape;
    year.months.forEach((month) => {
      delete month.averageClose;
      delete month.low;
      delete month.high;
    });
  });
  bucket.value = JSON.stringify(legacy);

  const response = await readMarketCacheResponse(bucket, { now: () => NOW });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cache.schemaVersion, 2);
});

test("empty or invalid cache returns a clear non-cacheable 503", async () => {
  for (const bucket of [new MemoryBucket(), new MemoryBucket("not-json")]) {
    const response = await readMarketCacheResponse(bucket);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Retry-After"), "3600");
    assert.match((await response.json()).error, /cache/i);
  }
});

test("an R2 read rejection returns the clear non-cacheable 503 contract", async () => {
  const response = await readMarketCacheResponse({ get: async () => { throw new Error("R2 unavailable"); } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Retry-After"), "3600");
  assert.match((await response.json()).error, /cache/i);
});

test("a regressed source cutoff cannot replace last-known-good history", async () => {
  const bucket = new MemoryBucket();
  const newerCsv = `${CSV}\n1510358400,2017-11-11 00:00:00,ETH/USD,298.66,315.00,295.00,310.00,32000,9800000`;
  await refreshMarketCache({ bucket, fetchImpl: async () => new Response(newerCsv), now: () => NOW });
  const previous = bucket.value;
  await assert.rejects(
    refreshMarketCache({ bucket, fetchImpl: async () => new Response(CSV), now: () => NOW }),
    /cutoff regressed|history shrank/,
  );
  assert.equal(bucket.value, previous);
});

test("HEAD and method handling never mutate cache", async () => {
  const bucket = new MemoryBucket();
  await refreshMarketCache({ bucket, fetchImpl: successfulFetch({ count: 0 }), now: () => NOW });
  bucket.putCalls = 0;

  const head = await readMarketCacheResponse(bucket, { method: "HEAD", now: () => NOW });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("ETag"), '"memory-etag"');

  const post = await readMarketCacheResponse(bucket, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
  assert.equal(bucket.putCalls, 0);
});

test("worker routing and deployment config keep visitors away from the provider", () => {
  assert.match(
    workerSource,
    /if \(url\.pathname === "\/api\/market-data"\) \{\s*return readMarketCacheResponse/,
  );
  assert.match(workerSource, /async scheduled\([\s\S]*runScheduledRefresh/);
  assert.doesNotMatch(routeSource, /fetch\(|CryptoDataDownload|cryptodatadownload/);
  assert.match(routeSource, /status:\s*503/);
  assert.equal(hostingConfig.r2, "MARKET_CACHE");
  assert.match(viteSource, /triggers:\s*\{ crons: \["0 \* \* \* \*"\] \}/);
});
