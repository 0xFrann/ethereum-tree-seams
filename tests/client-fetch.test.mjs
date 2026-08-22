import assert from "node:assert/strict";
import test from "node:test";
import {
  BITSTAMP_OHLC_URL,
  CHAIN_HEAD_STORAGE_KEY,
  CHAIN_HEAD_TTL_MS,
  ETHEREUM_RPC_URL,
  loadChainHeadFromClient,
  loadMarketDataFromClient,
  MARKET_CACHE_TTL_MS,
  MARKET_STORAGE_KEY,
} from "../lib/client-fetch.mjs";
import { MARKET_DATA_START } from "../lib/market-data.mjs";

const START = Date.parse(`${MARKET_DATA_START}T00:00:00Z`) / 1_000;
const DAY = 86_400;
const HASH = "0x" + "ab".repeat(32);
const HASH_B = "0x" + "cd".repeat(32);

function candle(unix, close) {
  return {
    timestamp: String(unix),
    open: String(close),
    high: String(close + 2),
    low: String(close - 2),
    close: String(close),
    volume: "10",
  };
}

function page(startUnix, count, close) {
  return {
    data: {
      ohlc: Array.from({ length: count }, (_, index) => candle(startUnix + index * DAY, close + index)),
    },
  };
}

test("paginates Bitstamp OHLC in the browser and aggregates from 2017-11-09", async () => {
  const requests = [];
  const data = await loadMarketDataFromClient({
    now: () => new Date("2017-11-11T12:00:00.000Z"),
    fetchImpl: async (url) => {
      requests.push(String(url));
      const parsed = new URL(url);
      assert.equal(`${parsed.origin}${parsed.pathname}`, BITSTAMP_OHLC_URL);
      assert.equal(parsed.searchParams.get("step"), "86400");
      assert.equal(parsed.searchParams.get("limit"), "1000");
      const start = Number(parsed.searchParams.get("start"));
      if (start === START) return Response.json(page(START, 2, 300));
      return Response.json({ data: { ohlc: [] } });
    },
  });

  assert.equal(data.chronology.marketDataFrom, MARKET_DATA_START);
  assert.equal(data.source.cutoff, "2017-11-10");
  assert.equal(data.source.provider, "Bitstamp");
  assert.equal(data.years[0].months[0].open, 300);
  assert.match(requests[0], /start=1510185600/);
});

test("surfaces a clear error when Bitstamp is unavailable", async () => {
  await assert.rejects(
    loadMarketDataFromClient({
      fetchImpl: async () => new Response("nope", { status: 503 }),
    }),
    /Unable to load the market specimen/,
  );
});

test("reads the latest Ethereum block from a public RPC in the browser", async () => {
  const head = await loadChainHeadFromClient({
    fetchImpl: async (url, init) => {
      assert.equal(url, ETHEREUM_RPC_URL);
      assert.equal(init.method, "POST");
      const body = JSON.parse(init.body);
      assert.equal(body.method, "eth_getBlockByNumber");
      return Response.json({
        result: {
          hash: HASH,
          number: "0x10",
          timestamp: "0x64",
          transactions: [HASH, HASH_B],
        },
      });
    },
  });

  assert.deepEqual(head, {
    blockHash: HASH,
    blockNumber: 16,
    timestamp: 100,
    transactionCount: 2,
  });
});

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

function successfulMarketFetch() {
  return async (url) => {
    const start = Number(new URL(url).searchParams.get("start"));
    if (start === START) return Response.json(page(START, 2, 300));
    return Response.json({ data: { ohlc: [] } });
  };
}

test("reuses a fresh localStorage market snapshot instead of refetching", async () => {
  const storage = new MemoryStorage();
  const now = () => new Date("2017-11-11T12:00:00.000Z");
  const requests = { count: 0 };
  const fetchImpl = async (url) => {
    requests.count += 1;
    return successfulMarketFetch()(url);
  };

  const first = await loadMarketDataFromClient({ fetchImpl, now, storage });
  const second = await loadMarketDataFromClient({ fetchImpl, now, storage });

  assert.equal(requests.count, 1);
  assert.equal(second.source.cutoff, first.source.cutoff);
  assert.equal(JSON.parse(storage.getItem(MARKET_STORAGE_KEY)).cachedAt, now().getTime());
});

test("keeps the last market snapshot when a later Bitstamp fetch fails", async () => {
  const storage = new MemoryStorage();
  const firstNow = () => new Date("2017-11-11T12:00:00.000Z");
  await loadMarketDataFromClient({ fetchImpl: successfulMarketFetch(), now: firstNow, storage });

  const staleNow = () => new Date(firstNow().getTime() + MARKET_CACHE_TTL_MS + 1);
  const data = await loadMarketDataFromClient({
    fetchImpl: async () => new Response("nope", { status: 503 }),
    now: staleNow,
    storage,
  });

  assert.equal(data.source.cutoff, "2017-11-10");
});

test("reuses a fresh chain-head snapshot and only refetches after the TTL", async () => {
  const storage = new MemoryStorage();
  const requests = { count: 0 };
  const fetchImpl = async () => {
    requests.count += 1;
    return Response.json({
      result: {
        hash: HASH,
        number: `0x${requests.count.toString(16)}`,
        timestamp: "0x64",
        transactions: [HASH],
      },
    });
  };

  const firstNow = () => new Date("2026-08-21T12:00:00.000Z");
  const first = await loadChainHeadFromClient({ fetchImpl, now: firstNow, storage });
  const second = await loadChainHeadFromClient({ fetchImpl, now: firstNow, storage });
  assert.equal(first.blockNumber, 1);
  assert.equal(second.blockNumber, 1);
  assert.equal(requests.count, 1);

  const staleNow = () => new Date(firstNow().getTime() + CHAIN_HEAD_TTL_MS + 1);
  const third = await loadChainHeadFromClient({ fetchImpl, now: staleNow, storage });
  assert.equal(third.blockNumber, 2);
  assert.equal(requests.count, 2);
  assert.ok(storage.getItem(CHAIN_HEAD_STORAGE_KEY));
});
