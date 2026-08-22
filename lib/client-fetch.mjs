import { aggregateMarketData, MARKET_DATA_START } from "./market-data.mjs";

export const BITSTAMP_OHLC_URL = "https://www.bitstamp.net/api/v2/ohlc/ethusd/";
export const ETHEREUM_RPC_URL = "https://ethereum-rpc.publicnode.com";
export const CLIENT_FETCH_TIMEOUT_MS = 8_000;
export const MARKET_STORAGE_KEY = "eth-rings:market-data:v1";
export const CHAIN_HEAD_STORAGE_KEY = "eth-rings:chain-head:v1";
export const MARKET_CACHE_TTL_MS = 12 * 60 * 60 * 1_000;
export const CHAIN_HEAD_TTL_MS = 10 * 60 * 1_000;

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStored(storage, key) {
  if (!storage?.getItem) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "");
    if (!parsed || typeof parsed.cachedAt !== "number" || parsed.value == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(storage, key, value, cachedAt) {
  if (!storage?.setItem) return;
  try {
    storage.setItem(key, JSON.stringify({ cachedAt, value }));
  } catch {
    /* Private mode and quota errors should not block a successful fetch. */
  }
}

function isFresh(entry, nowMs, ttlMs) {
  return Boolean(entry) && nowMs - entry.cachedAt < ttlMs;
}

const DAY_SECONDS = 86_400;
const OHLC_LIMIT = 1_000;
const HEX_QUANTITY = /^0x[0-9a-f]+$/i;
const HASH = /^0x[0-9a-f]{64}$/i;

function parseQuantity(value) {
  if (typeof value !== "string" || !HEX_QUANTITY.test(value)) throw new Error("Invalid RPC quantity");
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed)) throw new Error("RPC quantity exceeds safe integer range");
  return parsed;
}

function candleRow(candle) {
  const unix = Number(candle.timestamp);
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const volumeEth = Number(candle.volume);
  if (![unix, open, high, low, close, volumeEth].every(Number.isFinite)) {
    throw new Error("Bitstamp returned a non-numeric candle.");
  }
  return {
    unix,
    date: new Date(unix * 1_000).toISOString().slice(0, 10),
    symbol: "ETH/USD",
    open,
    high,
    low,
    close,
    volumeEth,
    volumeUsd: volumeEth * close,
  };
}

/**
 * Temporary GitHub Pages path: the browser fetches Bitstamp directly.
 * Restore `/api/market-data` + R2 when a Worker host is available again.
 */
export async function loadMarketDataFromClient({
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  timeoutMs = CLIENT_FETCH_TIMEOUT_MS,
  storage = browserStorage(),
  force = false,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch implementation is unavailable.");

  const nowMs = now().getTime();
  const cached = readStored(storage, MARKET_STORAGE_KEY);
  if (!force && isFresh(cached, nowMs, MARKET_CACHE_TTL_MS) && cached.value?.years?.length) {
    return cached.value;
  }

  try {
    let cursor = Date.parse(`${MARKET_DATA_START}T00:00:00Z`) / 1_000;
    const cutoff = Math.floor(now().getTime() / 1_000);
    const byDate = new Map();

    while (cursor <= cutoff) {
      const url = `${BITSTAMP_OHLC_URL}?step=${DAY_SECONDS}&limit=${OHLC_LIMIT}&start=${cursor}`;
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error("Unable to load the market specimen.");

      const payload = await response.json();
      const candles = payload?.data?.ohlc;
      if (!Array.isArray(candles) || candles.length === 0) break;

      let maxTimestamp = cursor;
      for (const candle of candles) {
        const unix = Number(candle?.timestamp);
        if (!Number.isFinite(unix) || unix < cursor) continue;
        const row = candleRow(candle);
        byDate.set(row.date, row);
        maxTimestamp = Math.max(maxTimestamp, unix);
      }

      if (candles.length < OHLC_LIMIT) break;
      const next = maxTimestamp + DAY_SECONDS;
      if (next <= cursor) break;
      cursor = next;
    }

    const rows = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
    const data = aggregateMarketData(rows, { updatedAt: now().toISOString() });
    const result = {
      ...data,
      source: {
        ...data.source,
        provider: "Bitstamp",
        url: "https://www.bitstamp.net/api/v2/ohlc/ethusd/",
        timezone: "UTC daily candles from the Bitstamp OHLC API",
      },
    };
    writeStored(storage, MARKET_STORAGE_KEY, result, nowMs);
    return result;
  } catch (error) {
    if (!force && cached?.value?.years?.length) return cached.value;
    throw error;
  }
}

export async function loadChainHeadFromClient({
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  timeoutMs = CLIENT_FETCH_TIMEOUT_MS,
  storage = browserStorage(),
  force = false,
} = {}) {
  const nowMs = now().getTime();
  const cached = readStored(storage, CHAIN_HEAD_STORAGE_KEY);
  if (!force && isFresh(cached, nowMs, CHAIN_HEAD_TTL_MS) && cached.value?.blockHash) {
    return cached.value;
  }

  try {
    const response = await fetchImpl(ETHEREUM_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: ["latest", false],
        id: 1,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error("Ethereum head unavailable");

    const payload = await response.json();
    const block = payload?.result;
    if (!block || typeof block.hash !== "string" || !HASH.test(block.hash)) {
      throw new Error("Ethereum head unavailable");
    }
    if (!Array.isArray(block.transactions) || !block.transactions.every((item) => typeof item === "string" && HASH.test(item))) {
      throw new Error("Ethereum head unavailable");
    }

    const result = {
      blockHash: block.hash,
      blockNumber: parseQuantity(block.number),
      timestamp: parseQuantity(block.timestamp),
      transactionCount: block.transactions.length,
    };
    writeStored(storage, CHAIN_HEAD_STORAGE_KEY, result, nowMs);
    return result;
  } catch (error) {
    if (!force && cached?.value?.blockHash) return cached.value;
    throw error;
  }
}
