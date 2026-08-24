# ETH/USD market-data source audit

**Decision status:** recommendation for the Wave 1 integration gate  
**Checked:** 2026-08-21  
**Question:** which one daily OHLC + volume series gets closest to Ethereum genesis without silently joining different markets?

## Recommendation

Use **Kraken spot ETH/USD, UTC daily candles**, and describe it everywhere as a Kraken venue series—not as “the ETH price” or market-wide ETH volume.

The first trade returned by Kraken's public Trades endpoint when queried from genesis is at Unix `1438956205.775445`, or **2015-08-07 14:03:25.775 UTC**, at USD 3.00. Thus the single observable market misses only 2015-07-30 through 2015-08-06, much less than the current Bitstamp file's 2015-07-30 through 2017-11-08 absence. Kraken itself supplies downloadable OHLCVT from the beginning of each market and defines its candles as first/highest/lowest/final trade, total traded volume, and trade count. Confidence is **high** for the venue/pair choice and observed start timestamp; the complete historical file still needs a one-time row-and-gap audit before it becomes canonical.

This choice has a precise meaning:

- Price shape is the path of trades in **Kraken ETH/USD spot**, bounded into UTC calendar days.
- Volume weight is **ETH units traded on that market** if the Kraken OHLCVT `volume` field is used. It is not exchange-wide or global volume, and it must not be labelled USD volume. Exact USD turnover would require aggregating Kraken trades as `sum(price × quantity)` rather than multiplying a daily close by base volume.
- The 2015 ring begins where observed Kraken trading begins on 2015-08-07. Ethereum genesis remains a separately labelled origin/protocol marker on 2015-07-30. The eight-day unobserved interval must remain visibly unpriced; do not backfill, draw a zero-price segment, or borrow another exchange.
- The candle for the current UTC day is provisional. Kraken documents that the last REST OHLC entry is the current, not-yet-committed interval. A payload cut on 2026-08-21 may show that date only as an explicitly unfinished candle; the last finalized daily candle is 2026-08-20.

### Reproducible delivery pattern

Kraken splits full history and live retrieval across two official delivery surfaces for the **same market**:

1. As an offline setup step, download Kraken's complete OHLCVT ZIP, extract and validate the ETH/USD 1,440-minute file, aggregate it directly into the application's one seed payload, and record the upstream retrieval date, byte size, row count, first/last timestamp, and SHA-256 in a source manifest. Do **not** deploy or retain a second raw-candle history store. Kraken says the complete archive covers every pair from its market beginning, with quarterly incremental archives.
2. During the single hourly scheduled refresh, make one unauthenticated Kraken OHLC request for `ETHUSD` at interval `1440`. The 720-day response is sufficient to rebuild the current partial year (and validate overlap with the previous year); combine that result with the immutable completed-year summaries already in the one cached aggregate, then atomically replace that payload. At a year boundary, finalize the previous year from the overlapping REST window. This is not market stitching: both inputs are Kraken ETH/USD and Kraken calls downloaded OHLCVT the API equivalent of its chart candles.
3. Never attempt to reconstruct the archive from the OHLC REST endpoint: it returns at most 720 recent candles regardless of `since`. Never send visitor traffic upstream. Exclude or flag the endpoint's final provisional candle.

The historical archive is currently linked through Google Drive as an all-pairs ZIP rather than a stable pair-scoped API URL. That is workable for a checksummed offline seed operation, but poor for an hourly worker. The small public REST response is suitable for hourly server fetch/cache and Kraken states that one public request per second or less stays within its rate limits; this design needs only one per hour and retains only the required single aggregated payload.

**Licensing gate:** Kraken's public API requires no account, but public availability is not an open-data license. Current Kraken regional terms assert ownership (or licensor ownership) of pricing data and, in at least the EEA terms, direct other uses to `marketdata@kraken.com`. Before publicly redistributing a cached historical payload or using it commercially, the owner must confirm that the intended display/cache/redistribution is permitted. Prefer serving derived annual/monthly geometry and summaries rather than republishing raw candles, but do not treat derivation as legal clearance.

## Comparison

| Source | Earliest directly observed / documented history | One consistent market? | Daily OHLC + volume | Gaps, candle boundary, and retrieval | Terms / operational fit | Decision |
|---|---|---|---|---|---|---|
| **Kraken ETH/USD spot** (official) | First returned trade: **2015-08-07 14:03:25.775 UTC**. Official complete files claim coverage from each market's beginning. | Yes: Kraken ETH/USD throughout. | Yes. Download has 1,440-minute OHLCVT; REST has OHLC, VWAP, base volume and trade count. | Unix timestamps; use UTC days and verify that convention during ingestion. Kraken explicitly omits intervals with no trades, so gaps are meaningful rather than missing zero-volume rows. Full ZIP + quarterly updates; REST is only 720 recent entries and its last entry is provisional. | Public REST needs no key; about 1 request/sec is documented safe. Full archive is an all-pairs Google Drive ZIP, so pin/checksum the extracted baseline. No explicit open redistribution license was found; obtain permission as needed. | **Recommended**, subject to archive QA and licensing gate. |
| **CryptoDataDownload Bitstamp ETH/USD daily** (current application) | File begins **2017-11-09 00:00:00** (`1510185600`) and currently ends with a partial **2026-08-21** row. | Yes in market identity (Bitstamp ETH/USD), but CDD is a secondary republisher/aggregator. | Yes, nominally crypto and USD volume. Direct inspection found the two volume columns appear reversed for the first **111 rows (2017-11-09–2018-02-27)**: the field labelled ETH volume behaves like quote notional and the field labelled USD behaves like ETH units. | 3,207 data rows on 2026-08-21; no duplicates; one missing date, **2026-05-22**. The file's epoch and printed dates are at 00:00 UTC, while the website says its Date field is converted to New York EST—an unresolved documentation conflict. One small CSV is easy to fetch and cache. | Direct CSV has no published rate limit/SLA. CDD says its free data is unverified, as-is, and non-commercial only. Its separate programmatic warehouse API is currently advertised at $79.99/month with token auth and unspecified “competitive” limits. | Do not use to imply genesis-era price. Acceptable fallback only with explicit 2015–2017 absence, volume-column repair, gap handling, and non-commercial fit. |
| **Bitfinex `tETHUSD` spot candles** (official) | Direct `1D` request returned **2016-03-09 UTC** through 2026-08-21 (3,811 rows at check time). | Yes. | Yes; official schema defines O/C/H/L and base quantity. | Up to 10,000 candles in one request; direct range showed seven absent UTC dates, which require audit as no-trade vs provider gaps. 30 requests/min documented. | Easy unauthenticated server fetch, but starts more than seven months after Kraken and terms still require review. | Credible second-place venue, not the closest defensible series. |
| **Coinbase Exchange `ETH-USD` spot candles** (official) | Direct daily range request first returned **2016-05-18 UTC**. | Yes. | Yes; base volume. | Maximum 300 candles/request; Coinbase warns historical rates may be incomplete and omits no-tick buckets. Requires paginated time ranges and gap checks. | Public and cacheable, but materially later and more requests than Kraken. | Credible alternative, not selected. |
| **Gemini `ethusd` spot candles** (official) | Current daily endpoint exposed only a rolling **364-candle** window (2025-08-22–2026-08-20 when checked), so it cannot bootstrap genesis-near history from this surface. | Yes. | Yes. | The official candle endpoint has no start/end parameters in its documented interface; the retrieved order was newest first. | Simple public endpoint but unsuitable for reproducible full history without another licensed archive. | Reject for this artifact's historical requirement. |
| **Coin Metrics ETH-USD pair candles / reference-rate products** | Potentially long history; exact entitled start must be checked against the paid catalog. | **No venue identity:** pair candles are derived from Coin Metrics reference rates across selected constituent markets. | Pair candles provide OHLC but **no volume**; Coin Metrics explains that they are calculated from 1-second reference rates, not all pair trades. Market candles do have venue OHLCV but then reduce to one venue again. | UTC beginning-of-interval convention; engineered gapless market candles forward-fill OHLC/VWAP and set volume to zero. Full historical market data is professional/paid; community market data is recent-only. | Strong methodology and reproducibility for a licensed composite, but changes both semantics and cost. | Do not substitute invisibly. Consider only after an explicit product decision to depict a composite price and source volume separately. |

## Why a composite would change the artifact

The existing rings say a concrete pair and venue: Bitstamp ETH/USD. A composite reference rate answers a different question—an engineered, outlier-resistant estimate of ETH/USD across a changing constituent set. Coin Metrics also states that its pair candles have no volume because the underlying reference-rate observations contain price, not trade quantity. Combining composite OHLC with global, exchange-wide, or separately summed volume would make contour and weight describe different populations.

That may be a valid future editorial direction, but it is not a drop-in data upgrade. It would require renaming the specimen, disclosing the index and constituent methodology, choosing an independently defensible volume universe, handling constituent changes, and revisiting whether historical shapes remain comparable. This report therefore does **not** recommend a composite and does not recommend invisible stitching between Kraken, Bitfinex, Coinbase, Gemini, Bitstamp, or an index.

## Honest fallback boundary

If the Kraken archive cannot pass the licensing gate, cannot be fetched reproducibly in the deployment/build environment, or fails the complete-file audit, keep the current **CryptoDataDownload Bitstamp ETH/USD** market rather than filling its missing years from another venue.

Under that fallback:

- 2015-07-30 through 2017-11-08 is a clearly labelled **pre-series / no Bitstamp observation** interval, not a price ring. Protocol knots and security scars may occupy the chronology, but ring shape and volume weight do not exist there.
- The first priced growth begins on 2017-11-09. Do not extend the first close backward or use zeroes.
- Correct or reject the apparently swapped CDD volume columns through 2018-02-27 before expanding the renderer earlier than 2019, and record that transformation in code/tests.
- Decide explicitly how to treat the missing 2026-05-22 row and the provisional current-day row; no-trade, missing-source, and not-yet-final are different states.
- Confirm the project is non-commercial or obtain different rights: CDD's current terms limit the free data to non-commercial use.

This fallback is less historically complete, but its boundary is honest and preserves the meaning of a single venue.

## Required ingestion checks before approval

For the extracted Kraken `ETH/USD` 1,440-minute file:

1. Confirm schema and pair identifier; parse timestamps as epoch UTC and reject duplicates or non-monotonic order.
2. Record SHA-256, source URL, retrieval timestamp, archive release/quarter, byte size, row count, and first/last candle.
3. Confirm the first daily candle and reconcile it with the observed first trade at 2015-08-07 14:03:25.775 UTC.
4. Enumerate every missing UTC day. Preserve a gap as `noTrades` only where Kraken's source semantics support it; never silently forward-fill price for this visualization.
5. Validate `low <= open/close <= high`, finite positive prices, nonnegative volume/trade count, and annual date coverage.
6. Compare multiple overlapping finalized archive/REST candles field-for-field. If Kraken revises recent candles, document the precedence rule rather than accepting drift silently.
7. Keep the current REST candle marked provisional until its UTC interval closes. Expose source market, observation start, finalized-through time, refresh time, and any gaps in payload metadata.
8. Obtain and record market-data usage permission appropriate to the intended public/commercial deployment.

## Evidence and direct observations

Primary/official documentation:

- [Kraken downloadable historical OHLCVT](https://support.kraken.com/articles/360047124832-downloadable-historical-ohlcvt-open-high-low-close-volume-trades-data) — candle definitions, intervals, market-beginning coverage, missing-candle semantics, complete and quarterly downloads.
- [Kraken downloadable time and sales](https://support.kraken.com/articles/360047543791-downloadable-historical-market-data-time-and-sales-) — full trade-history availability and fields.
- [Kraken REST OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data) — 720-entry ceiling and provisional final entry.
- [Kraken public API access](https://support.kraken.com/articles/360000919986-public-endpoint-examples-you-can-try-them-directly-in-a-web-browser-) and [rate limits](https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-) — no-account HTTP access and safe polling guidance.
- [Kraken legal terms selector](https://www.kraken.com/legal) and [current EEA terms](https://www.kraken.com/legal/eea-terms) — jurisdiction-dependent terms and the pricing-data permission boundary.
- [Bitfinex candles](https://docs.bitfinex.com/reference/rest-public-candles) — schema, 10,000-row maximum, and 30 requests/minute.
- [Coinbase Exchange product candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) — candle schema, missing-tick warning, and 300-candle maximum.
- [Gemini market-data REST documentation](https://docs.gemini.com/rest-api/#list-candles) — candle endpoint and supported daily interval.
- [Coin Metrics candles methodology](https://docs.coinmetrics.io/market-data-timeseries/market-candles) and [market-data FAQ](https://docs.coinmetrics.io/resources/faqs) — market/pair candle construction, gap filling, interval convention, reference-rate composition, and lack of pair-candle volume.

Current secondary source documentation:

- [CryptoDataDownload Bitstamp page](https://www.cryptodatadownload.com/data/bitstamp/) — declared columns, source, update behavior, and stated New York timestamp conversion.
- [CryptoDataDownload terms](https://www.cryptodatadownload.com/terms-of-use/) — unverified/as-is disclaimer and non-commercial restriction.

Direct checks performed 2026-08-21:

```text
GET https://api.kraken.com/0/public/Trades?pair=ETHUSD&since=1438300800000000000
  first row timestamp = 1438956205.775445 (2015-08-07T14:03:25.775Z)

GET https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv
  HTTP 200; Content-Length 322343; Last-Modified Fri, 21 Aug 2026 00:08:58 GMT
  3,207 rows; first 2017-11-09; last 2026-08-21; 0 duplicate dates
  missing date 2026-05-22; first 111 rows have volume columns apparently reversed

GET https://api-pub.bitfinex.com/v2/candles/trade:1D:tETHUSD/hist?limit=10000&sort=1
  3,811 rows; first 2016-03-09T00:00:00Z; last 2026-08-21T00:00:00Z

GET https://api.exchange.coinbase.com/products/ETH-USD/candles
  with daily bounded ranges: first observed 2016-05-18T00:00:00Z

GET https://api.gemini.com/v2/candles/ethusd/1day
  364 rows; retrieved window 2025-08-22 through 2026-08-20
```

Direct endpoint results are observations, not guarantees of permanent availability. Pin the accepted archive's checksum and provenance manifest with the seed aggregate so the dataset can be audited even if upstream delivery changes; retain the raw archive offline only if licensing and project policy allow it.
