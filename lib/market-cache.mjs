import { MILESTONES, SCARS } from "./event-data.mjs";
import { aggregateMarketData, MARKET_SCHEMA_VERSION, parseCryptoDataDownloadCsv } from "./market-data.mjs";

export const MARKET_CACHE_KEY = "market-data/latest.json";
export const MARKET_SOURCE_URL = "https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv";
export const UPSTREAM_TIMEOUT_MS = 8_000;
const LEGACY_MARKET_SCHEMA_VERSION = 2;

/**
 * @typedef {{
 *   httpEtag?: string,
 *   text: () => Promise<string>
 * }} CacheObject
 */

/**
 * @typedef {{
 *   get: (key: string) => Promise<CacheObject | null>,
 *   put: (
 *     key: string,
 *     value: string,
 *     options?: {
 *       httpMetadata?: { contentType?: string },
 *       customMetadata?: Record<string, string>
 *     }
 *   ) => Promise<unknown>
 * }} MarketCacheBucket
 */

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function validateCacheDocument(value) {
  if (!value || typeof value !== "object") throw new Error("Cached market data is not an object.");
  if (!Array.isArray(value.years) || value.years.length === 0) throw new Error("Cached market data has no years.");
  if (!value.cache || ![LEGACY_MARKET_SCHEMA_VERSION, MARKET_SCHEMA_VERSION].includes(value.cache.schemaVersion)) {
    throw new Error("Cached market data has an unsupported schema version.");
  }
  if (!Number.isFinite(Date.parse(value.cache.updatedAt))) throw new Error("Cached market data has an invalid update time.");
  if (!value.source || !/^\d{4}-\d{2}-\d{2}$/.test(value.source.cutoff)) throw new Error("Cached market data has an invalid source cutoff.");
  if (!value.chronology || typeof value.chronology.marketDataFrom !== "string") throw new Error("Cached market data has no chronology boundary.");
  if (!Array.isArray(value.milestones) || !Array.isArray(value.scars)) throw new Error("Cached market data has no event collections.");
  return value;
}

/**
 * @param {{
 *   bucket?: MarketCacheBucket,
 *   fetchImpl?: typeof globalThis.fetch,
 *   now?: () => Date,
 *   timeoutMs?: number
 * }} [options]
 */
export async function refreshMarketCache({
  bucket,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  timeoutMs = UPSTREAM_TIMEOUT_MS,
} = {}) {
  if (!bucket?.put) throw new Error("MARKET_CACHE binding is unavailable.");
  if (typeof fetchImpl !== "function") throw new Error("Fetch implementation is unavailable.");

  const response = await fetchImpl(MARKET_SOURCE_URL, {
    headers: { accept: "text/csv" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Market source returned ${response.status}.`);

  const updatedAt = now().toISOString();
  const aggregate = aggregateMarketData(parseCryptoDataDownloadCsv(await response.text()), { updatedAt });
  validateCacheDocument(aggregate);
  if (bucket.get) {
    const existing = await bucket.get(MARKET_CACHE_KEY);
    if (existing) {
      try {
        const previous = validateCacheDocument(JSON.parse(await existing.text()));
        if (aggregate.source.cutoff < previous.source.cutoff) throw new Error("Market source cutoff regressed.");
        if (Number.isInteger(previous.source.observedRows) && aggregate.source.observedRows < previous.source.observedRows) {
          throw new Error("Market source history shrank.");
        }
      } catch (error) {
        if (/regressed|shrank/.test(errorMessage(error))) throw error;
      }
    }
  }
  const serialized = JSON.stringify(aggregate);

  await bucket.put(MARKET_CACHE_KEY, serialized, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      updatedAt: aggregate.cache.updatedAt,
      sourceCutoff: aggregate.source.cutoff,
      schemaVersion: String(aggregate.cache.schemaVersion),
    },
  });

  return aggregate;
}

/**
 * @param {{
 *   bucket?: MarketCacheBucket,
 *   fetchImpl?: typeof globalThis.fetch,
 *   now?: () => Date,
 *   timeoutMs?: number,
 *   logger?: { error: (...parts: unknown[]) => void }
 * }} [options]
 */
export async function runScheduledRefresh({ bucket, fetchImpl, now, timeoutMs, logger = console } = {}) {
  try {
    const data = await refreshMarketCache({ bucket, fetchImpl, now, timeoutMs });
    return { ok: true, updatedAt: data.cache.updatedAt, sourceCutoff: data.source.cutoff };
  } catch (error) {
    logger.error("Market refresh failed", errorMessage(error));
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * The cache is a record of the market, not of the chronology. Both are written
 * into the same document at refresh time so the client makes one request, but
 * only the market rows come from upstream: the knots are the deployed
 * `event-data` module, and joining them in on the way out is what keeps an
 * edit to a milestone's wording from waiting an hour for the next cron. A
 * chronology that ships with the code should be live the moment the code is.
 */
function withCurrentChronology(document) {
  return { ...document, milestones: MILESTONES, scars: SCARS };
}

/**
 * A 32-bit FNV-1a over the chronology, taken once at module load. The body we
 * return is assembled rather than served byte-for-byte from the store, so the
 * stored validator alone no longer names it; the fingerprint is what makes a
 * conditional request notice a deploy that only changed the writing.
 */
const CHRONOLOGY_FINGERPRINT = (() => {
  const text = JSON.stringify({ milestones: MILESTONES, scars: SCARS });
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
})();

/** @param {string} storedEtag */
function chronologyEtag(storedEtag) {
  const inner = storedEtag.replace(/^W\//, "").replace(/^"|"$/g, "");
  return `"${inner}~${CHRONOLOGY_FINGERPRINT}"`;
}

function jsonError(message, status, extraHeaders = {}) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    },
  );
}

/**
 * @param {MarketCacheBucket | undefined} bucket
 * @param {{ method?: string, now?: () => Date }} [options]
 */
export async function readMarketCacheResponse(bucket, { method = "GET", now = () => new Date() } = {}) {
  if (method !== "GET" && method !== "HEAD") {
    return jsonError("Method not allowed.", 405, { Allow: "GET, HEAD" });
  }
  if (!bucket?.get) {
    return jsonError("Market data cache is not configured.", 503, { "Retry-After": "3600" });
  }

  let cached;
  try {
    cached = await bucket.get(MARKET_CACHE_KEY);
  } catch {
    return jsonError("Market data cache could not be read. The next request may retry.", 503, {
      "Retry-After": "3600",
    });
  }
  if (!cached) {
    return jsonError("Market data cache is empty. The first scheduled refresh has not completed.", 503, {
      "Retry-After": "3600",
    });
  }

  let text;
  let data;
  try {
    data = withCurrentChronology(validateCacheDocument(JSON.parse(await cached.text())));
    text = JSON.stringify(data);
  } catch {
    return jsonError("Market data cache is invalid. The next scheduled refresh will retry.", 503, {
      "Retry-After": "3600",
    });
  }

  const updatedAtMs = Date.parse(data.cache.updatedAt);
  const ageSeconds = Math.max(0, Math.floor((now().getTime() - updatedAtMs) / 1_000));
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300, must-revalidate",
    "X-Market-Cache-Updated-At": data.cache.updatedAt,
    "X-Market-Cache-Age": String(ageSeconds),
    "X-Market-Source-Cutoff": data.source.cutoff,
    "X-Market-Schema-Version": String(data.cache.schemaVersion),
  });
  if (cached.httpEtag) headers.set("ETag", chronologyEtag(cached.httpEtag));

  return new Response(method === "HEAD" ? null : text, { status: 200, headers });
}
