# Minimal hourly market cache

## Architecture

The deployment uses one Cloudflare R2 binding, `MARKET_CACHE`, and exactly one object, `market-data/latest.json`.

```text
hourly Cron Trigger (0 * * * *)
  -> one GET to CryptoDataDownload Bitstamp ETH/USD CSV
  -> parse + source normalization + validation + aggregation
  -> one atomic R2 object replacement on success

visitor GET /api/market-data
  -> Worker reads market-data/latest.json from R2
  -> no upstream provider call
```

The cached JSON is the complete frontend aggregate, not a raw candle archive. It includes `cache.updatedAt`, `cache.schemaVersion`, `source.cutoff`, and the disclosed source gap list. There is no database, queue, retry loop, historical-object collection, or cache hierarchy.

## Configuration

- `.openai/hosting.json` requests the R2 binding name `MARKET_CACHE`.
- `vite.config.ts` maps that binding to the local `site-creator-r2` bucket and declares `triggers.crons = ["0 * * * *"]` for an hourly UTC trigger.
- `worker/index.ts` exports both `fetch()` and `scheduled()` handlers. The Worker intercepts `/api/market-data` before vinext routing, so the application route cannot become a visitor-to-provider path.
- `app/api/market-data/route.ts` is a defensive `503` fallback for runtimes that bypass the Worker interception. It contains no provider URL and performs no fetch.

The hosting control plane must provision the R2 bucket/binding and register the declared Cron Trigger. No credentials are required for the public CDD CSV.

## Refresh and failure behavior

Each scheduled invocation calls the provider once with an 8-second timeout and no retry. The response must have a successful status, parse as the documented CDD CSV, pass row/event validation, aggregate successfully, and serialize before `R2.put` is called. R2 replaces one object atomically.

Timeout, network rejection, bad HTTP status, parse error, validation error, aggregation error, serialization error, or R2 write failure produces one concise `Market refresh failed` log. Any previously stored object remains untouched. The next hourly trigger is the only automatic retry.

Visitor responses are derived only from R2:

- a valid object returns `200` with five-minute shared caching and one-minute browser caching;
- headers disclose update time, cache age, source cutoff, and schema version;
- stale data remains serviceable after a failed refresh because its original timestamps are not rewritten;
- missing, unavailable, or invalid cache returns a non-cacheable `503` with `Retry-After: 3600`;
- methods other than `GET` and `HEAD` return `405`.

## Cold start and bootstrap

A new bucket intentionally returns `503` until its first successful scheduled refresh. For an immediate local seed, run the Worker with Wrangler scheduled testing enabled and invoke its scheduled endpoint; production can be seeded by manually triggering the deployed scheduled handler through the Cloudflare control plane. The bootstrap uses the same code path and one-fetch rule as every hourly refresh—there is no public refresh endpoint.

After seeding, verify that `market-data/latest.json` exists and that its custom metadata contains `updatedAt`, `sourceCutoff`, and `schemaVersion` before opening visitor traffic.

## Verification evidence

`tests/market-cache.test.mjs` uses a counting in-memory R2 double and injected fetch implementation to prove:

- one scheduled refresh performs exactly one provider request and one successful object write;
- bad status, invalid CSV/OHLC, and timeout each perform one request and zero writes, preserving the old value;
- 32 concurrent visitor reads perform 32 R2 reads, zero R2 writes, and zero provider requests;
- empty/corrupt cache returns `503`;
- freshness and cutoff headers reflect the stored payload rather than request time;
- `HEAD` and rejected methods never mutate cached state.

Run the focused proof with:

```sh
node --test tests/market-cache.test.mjs
```
