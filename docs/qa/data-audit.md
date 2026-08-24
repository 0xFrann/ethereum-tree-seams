# Gate 4 data audit

**Audited:** 2026-08-21  
**Scope:** shipped market/event payloads, aggregation, cache response path, visible disclosure, and automated tests against `docs/research/decision-gate.md`, the accepted research companions, `docs/design/implementation-contract.md`, and the data/backend portions of `TODO.md`.  
**Initial result:** **FAIL.** The first audit found correct current data content but unsafe refresh regression handling, an incomplete cache-read failure contract, static/incomplete live metadata, and one failing release test.  
**Final re-audit result:** **PASS.** The market/event content still reconciles; all backend integrity findings are remediated; metadata now derives the source, origin, coverage, gap count, schema, update time, and latest-ring state from the payload; browser verification confirms historical-event selection leaves `Growing · 2026 / Open` truthful; and the full suite passes 49/49.

No production files were changed during this audit.

## Executive matrix

| Area | Result | Evidence |
|---|---|---|
| Market chronology and source boundary | **PASS** | Direct CDD inspection produced 3,207 ETH/USD rows from 2017-11-09 through 2026-08-21. The aggregator now requires the fixed first candle and rejects cutoff regression/history shrink before replacement. |
| Missing dates and volume anomaly | **PASS** | Exactly one missing source date, 2026-05-22, is detected, carried in `source.gaps`, and disclosed in the expandable methodology. No fill is performed. The documented CDD volume-column swap is applied through 2018-02-27 and has focused coverage. |
| Partial-year handling | **PASS** | 2017 has `firstDate=2017-11-09`, `startProgress=0.8548`, and only November/December; the contour begins at that true day-of-year position. The 2026 ring ends at 2026-08-21 with `progress=0.6384` and is labelled `Still growing` / `Open · still growing`. The current-day candle remains honestly part of the open ring rather than being described as finalized. |
| Source/freshness disclosure | **PASS** | Venue, distributor, frequency, origin, coverage, gap count, schema, update time, pre-series interval, UTC boundary, exact gap date, methodology, provider link, and latest-ring state derive from the payload. Historical selection does not alter the global open-ring truth. |
| Milestone dataset | **PASS** | 11 knots, in accepted order and on accepted ISO dates; Frontier remains the separate 2015-07-30 origin. All shipped knot source URLs and confidence values reconcile to the accepted protocol report. |
| Scar dataset | **PASS** | Exactly 9 accepted scars; WazirX is excluded. Dates, gross contemporaneous impacts, logarithmic magnitudes, healing states, primary source links, and confidence values reconcile to `security-scars.json`. Bybit is explicitly described as exchange custody/signing compromise, and no summary claims an Ethereum base-protocol compromise or price causation. |
| Cache response contract | **PASS** | Scheduled success, one-fetch/no-retry, atomic replacement, regression/shrink rejection, stale serving, schema-aware validation, freshness headers, visitor zero-upstream behavior, and empty/corrupt/unavailable-cache `503` behavior pass focused tests. |
| Automated verification | **PASS** | Focused data/event/cache/render tests pass 28/28. Typecheck and build pass. `npm test` passes 49/49, including the updated rendered-page and interaction-semantics contracts. |

## Market-series findings

### Current upstream inspection — PASS

The live file `https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv` was fetched and passed through the shipped parser/aggregator on 2026-08-21. Observed results:

- 322,343 bytes and 3,207 data rows, delivered newest-first and sorted correctly by the aggregator;
- earliest record: Bitstamp `ETH/USD`, 2017-11-09, Unix `1510185600`;
- latest record: Bitstamp `ETH/USD`, 2026-08-21, Unix `1787270400`;
- one absent calendar date: 2026-05-22;
- output period: `2017–2026`;
- output chronology: origin 2015-07-30, market data from 2017-11-09, unpriced interval 2015-07-30—2017-11-08;
- annual records for 2017 through 2026, with no exchange stitching or pre-series backfill;
- 2017 contains only month indexes 10 and 11 (November/December), while 2026 contains January through August and remains incomplete.

The current snapshot therefore agrees with the accepted fallback boundary and the direct observations in `market-data-sources.md`.

### Data normalization and gap semantics — PASS

`lib/market-data.mjs` repairs the known early CDD column anomaly for 2017-11-09 through 2018-02-27 before aggregation. It rejects duplicate dates, non-positive prices, invalid OHLC ranges, and negative volume. Missing dates are enumerated from the observed first through last record and exposed without interpolation. The methodology accurately describes reported Bitstamp USD volume, per-year price-shape normalization, the unpriced pre-series boundary, and the provider's observed UTC day boundary.

The missing 2026-05-22 candle affects the observed May aggregate; it is not silently filled or treated as a zero-volume day. This is the accepted behavior.

### [Resolved high] Truncated/regressed history replacement — PASS

The initial audit found that a syntactically valid truncated or stale response could replace the last-known-good series. Remediation now:

- requires the earliest retained ETH/USD row to be exactly 2017-11-09;
- stores `source.observedRows` in new aggregates;
- reads a valid existing cache before replacement and rejects an older cutoff;
- rejects an observed-row shrink when that metadata exists; and
- leaves the previous object untouched when either invariant fails.

Focused tests cover a missing first candle and a regressed/shrunk replacement. The fixed start also prevents a newly initialized cache from accepting a recent-only valid-looking file.

### [Resolved medium] Date/epoch and header validation — PASS

The parser now requires the exact accepted CDD header. Row validation proves that each date is a real UTC calendar day, requires integer Unix seconds, and requires the epoch to equal that date at 00:00 UTC. The focused suite includes a Unix/date mismatch rejection. The current live file passes these stricter checks.

## Visible disclosure and partial years

### Chronology and partial rings — PASS

The renderer constructs calendar bands from the 2015 genesis year through the current source year, while priced rings exist only where market-year data exists. The center acknowledges 2015-07-30, the pre-series label names the entire unpriced interval, and pre-market protocol/security events can occupy neutral chronology bands without creating price geometry. The first priced contour uses 2017's `startProgress`; it does not extend backward through January–October. The current contour uses the source cutoff and the latest partial year receives the locked `Still growing` wording.

The visible month controls further preserve the distinction: January–October 2017 are unavailable, and only observed months can be selected.

### [Resolved medium] Live metadata derivation and current-ring state — PASS

The initial hardcoding/omission finding is substantially resolved. The ready UI now derives:

- market/frequency from `source.market` and `source.frequency`;
- distributor from `source.provider`;
- center origin from `chronology.origin`;
- data start/cutoff from `chronology.marketDataFrom` and `source.cutoff`;
- schema and gap count from `cache.schemaVersion` and `source.gaps`; and
- update time from `cache.updatedAt`.

The intermediate re-audit found one selection-state defect: the global strip reused the selected year's `currentOpen` value, so selecting 2025 could relabel the latest 2026 ring as complete. Final remediation separates `latestOpen`, computed only from the last payload year, from the selection-dependent `currentOpen` used by the readout. Browser verification selecting the Bybit/2025 event confirmed that the global strip remains `Growing · 2026 / Open`.

No release blocker remains. A hydrated regression test that selects a historical year and asserts the global current ring remains open would be useful defense in depth; the current suite has static interaction-semantics coverage and the behavior was browser-verified.

## Event-data reconciliation

### Counts, dates, and selection — PASS

The shipped data contains:

- origin: Frontier genesis, 2015-07-30;
- 11 accepted visible milestones: Homestead (2016-03-14), DAO fork (2016-07-20), Byzantium (2017-10-16), Constantinople / St. Petersburg (2019-02-28), Beacon Chain genesis (2020-12-01), London / EIP-1559 (2021-08-05), The Merge (2022-09-15), Shapella (2023-04-12), Dencun (2024-03-13), Pectra (2025-05-07), and Fusaka (2025-12-03);
- 9 accepted scars: The DAO (2016-06-17), Parity freeze (2017-11-06), Poly Network (2021-08-10), Wormhole (2022-02-02), Ronin (2022-03-23), Nomad (2022-08-01), Euler (2023-03-13), Bybit (2025-02-21), and KelpDAO (2026-04-18).

Frontier is not duplicated as a knot. The DAO exploit scar and DAO fork knot remain distinct records. Event chronology is sorted by exact ISO date, and the DOM index exposes all 20 selectable events even for dates preceding the market series.

### URLs, confidence, magnitude, and wording — PASS

All 11 milestone URLs exactly match the accepted primary URL in `protocol-milestones.json`. All 9 scar URLs match the first accepted primary source in `security-scars.json`. Frontier retains the official EF launch post listed as the accepted backup source. Every shipped event has `confidence: "high"`.

Scar gross values and visual magnitudes match the approved records and fixed `$1M`–`$1.5B` logarithmic rule: DAO 56, Parity 69, Poly 88, Wormhole 79, Ronin 88, Nomad 71, Euler 72, Bybit 100, and KelpDAO 78. Accessible detail exposes the uncapped reported impact, recovery status, affected layer, confidence, and source URL. The summaries separate applications, bridges, sidechains, custody/signing systems, and verification infrastructure from Ethereum consensus/execution, and contain no price-causation claims.

### [Low] Research parity is manually verified, not locked by a test — COVERAGE GAP

The event tests strongly cover counts, IDs, ordering, field validity, magnitude math, healing state, and URL shape, but do not compare shipped dates/URLs/gross values against the accepted JSON companions. A future factual edit could remain structurally valid while drifting from approved research.

**Action:** add a parity test or generated canonical fixture that checks accepted IDs, dates, primary URLs, gross impacts, visual magnitudes, and inclusion/exclusion decisions against the frozen research contract.

## Cache/API contract

### Implemented behavior — PASS

The normal deployment path uses one `MARKET_CACHE` R2 object and one hourly cron (`0 * * * *`). A scheduled refresh makes exactly one upstream request with an 8-second timeout and no retry, then parses, validates, aggregates, serializes, and performs one replacement write. Bad status, rejection, timeout, parse failure, OHLC failure, serialization failure, and write failure leave the old value untouched in the focused test scenarios.

Visitor `/api/market-data` requests are intercepted by the Worker and only read R2. A valid cache returns `200` with honest `updatedAt`, age, cutoff, schema, cache-control, and ETag headers. Missing or syntactically invalid content returns non-cacheable JSON `503` with `Retry-After: 3600`. The application route is a provider-free defensive `503` fallback. Thirty-two concurrent visitor reads in the focused test produce zero provider calls and zero writes.

### [Resolved medium] R2 read rejection — PASS

`bucket.get()` is now caught. A rejected R2 read returns JSON `503`, `Cache-Control: no-store`, and `Retry-After: 3600`; a focused rejecting-bucket test passes.

### [Resolved low] Served-cache schema validation — PASS

Cache validation now requires `MARKET_SCHEMA_VERSION` and minimally requires years, chronology boundary, cutoff, update time, and both event collections. Unsupported or incomplete content returns the invalid-cache `503` path.

## Verification results

Commands executed from the repository root:

```text
node --test tests/market-data.test.mjs tests/event-data.test.mjs tests/market-cache.test.mjs tests/rendered-page.test.mjs
  PASS: 28/28

npm run typecheck
  PASS

npm test
  build: PASS
  tests: PASS, 49/49
```

The stale rendered-page assertions are updated to the accepted archival shell and cache-loading language. The full suite also includes explicit explorer-state and interaction-semantics coverage. The latest-ring state was additionally verified in the browser after selecting a historical event.

## Release disposition

**PASS.** The current data snapshot is defensible: it is a single Bitstamp ETH/USD series, its missing history and missing candle are disclosed, its partial years are represented without backfill, and its canonical events reconcile to the accepted reports. Refresh/cache integrity, truthful live metadata, browser interaction state, typecheck, build, focused checks, and the complete automated suite all pass. The low-priority research-parity and hydrated metadata-interaction test suggestions remain defense-in-depth improvements, not release blockers.
