# ETH/USD market-data sources

Last reviewed: 2026-08-21

The rings need one daily OHLC and volume series for ETH/USD that reaches as close to Ethereum genesis as possible without quietly joining different markets. This note compares the candidates, explains which one the site uses today, and records what adopting the better-reaching alternative would involve.

## What the site uses

The site draws the **CryptoDataDownload copy of Bitstamp ETH/USD daily candles**. It is one market throughout, it is a single small CSV that can be fetched at build time without an account, and its quirks are few enough to correct in code and disclose in the payload. The trade-off is that the file begins on **2017-11-09**, more than two years after mainnet genesis, so the chronology between genesis and the first candle has to be drawn as an unpriced interval rather than as price. That boundary is described in [data-decisions.md](./data-decisions.md).

Two source anomalies are handled explicitly:

- For the first 111 rows (2017-11-09 through 2018-02-27) the two volume columns are reversed: the field labelled ETH volume behaves like USD notional and vice versa. `lib/market-data.mjs` swaps them back for exactly that date range.
- One date, **2026-05-22**, is missing. It is listed in the payload's `source.gaps` and is never forward-filled.

The file's epoch and printed dates sit on 00:00 UTC, while the provider's website says its date field is converted to New York time. The code treats the observed UTC day boundary as the truth and the payload says so in `source.timezone`.

CryptoDataDownload's terms describe the free data as unverified, as-is, and for non-commercial use. This is a non-commercial portfolio project; a commercial use would need different rights or a different source.

## The stronger alternative: Kraken

Kraken spot ETH/USD would be the better series for reach. The first trade returned by Kraken's public Trades endpoint when queried from genesis is at Unix `1438956205.775445`, **2015-08-07 14:03:25.775 UTC**, at USD 3.00, so a Kraken series would miss only the eight days from 2015-07-30 through 2015-08-06. Kraken publishes downloadable OHLCVT files from the beginning of each market and defines its candles as first/highest/lowest/final trade, total traded volume, and trade count.

Adopting it would mean:

- Price shape would be the path of trades in Kraken ETH/USD spot, bounded into UTC calendar days.
- Volume weight would be ETH units traded on that market if the OHLCVT `volume` field were used. It is not exchange-wide or global volume and must not be labelled USD volume; exact USD turnover would require summing `price × quantity` over Kraken trades rather than multiplying a daily close by base volume.
- The 2015 ring would begin on 2015-08-07; genesis would remain a separately labelled origin on 2015-07-30, and the eight-day gap would stay visibly unpriced.
- Kraken's REST OHLC endpoint returns at most 720 recent candles and its last entry is the current, uncommitted day. Full history comes from the complete archive, currently linked as an all-pairs ZIP through Google Drive, which is workable for a checksummed one-time seed but not something a build should download every day. A build would combine a pinned historical seed with one REST request for the recent window.
- Kraken's public API needs no account, but public availability is not an open-data licence. Kraken's regional terms assert ownership of pricing data and, in at least the EEA terms, direct other uses to `marketdata@kraken.com`. Redistributing a cached history would need permission; serving derived annual and monthly geometry rather than raw candles reduces the exposure but is not legal clearance by itself.

The archive would also need a one-time audit before it became canonical: schema and pair check, epoch UTC timestamps with no duplicates or out-of-order rows, a recorded SHA-256, byte size, row count and first/last candle, reconciliation of the first daily candle with the observed first trade, an enumeration of every missing UTC day (Kraken omits intervals with no trades, so a gap is meaningful), sanity checks that `low <= open, close <= high` with finite positive prices and non-negative volume, and a field-for-field comparison of overlapping archive and REST candles so any revision policy is documented rather than absorbed silently.

None of that can be settled from repository evidence alone, which is why the site ships Bitstamp today and keeps Kraken as the documented upgrade path.

## Comparison

| Source | Earliest directly observed / documented history | One consistent market? | Daily OHLC + volume | Gaps, candle boundary, and retrieval | Terms / operational fit | Verdict |
|---|---|---|---|---|---|---|
| **CryptoDataDownload Bitstamp ETH/USD daily** (in use) | File begins **2017-11-09 00:00:00** (`1510185600`); the last row is the current partial day. | Yes in market identity (Bitstamp ETH/USD), though CDD is a secondary republisher. | Yes, nominally ETH and USD volume. The two volume columns are reversed for the first 111 rows (2017-11-09 through 2018-02-27). | 3,207 data rows on 2026-08-21; no duplicates; one missing date, 2026-05-22. Epoch and printed dates are 00:00 UTC while the website claims New York conversion. One small CSV is easy to fetch at build time. | No published rate limit or SLA for the direct CSV. Free data is unverified, as-is, and non-commercial only; a paid warehouse API exists separately. | In use, with the 2015–2017 absence drawn as unpriced, the volume columns repaired, and the gap disclosed. |
| **Kraken ETH/USD spot** (official) | First returned trade **2015-08-07 14:03:25.775 UTC**; official complete files claim coverage from each market's beginning. | Yes: Kraken ETH/USD throughout. | Yes. Download has 1,440-minute OHLCVT; REST has OHLC, VWAP, base volume and trade count. | Unix timestamps; verify the UTC-day convention on ingestion. Kraken omits intervals with no trades. Full ZIP plus quarterly updates; REST is only 720 recent entries and its last entry is provisional. | Public REST needs no key; about one request per second is documented as safe. Full archive is an all-pairs Google Drive ZIP. No explicit redistribution licence found. | Best reach; the documented upgrade path once the archive audit and licence question are settled. |
| **Bitfinex `tETHUSD` spot candles** (official) | A direct `1D` request returned **2016-03-09 UTC** through 2026-08-21 (3,811 rows). | Yes. | Yes; the official schema defines O/C/H/L and base quantity. | Up to 10,000 candles per request; the direct range showed seven absent UTC dates that would need auditing as no-trade versus provider gaps. 30 requests per minute documented. | Easy unauthenticated fetch, but starts more than seven months after Kraken and terms would still need review. | Credible second place. |
| **Coinbase Exchange `ETH-USD` spot candles** (official) | A daily range request first returned **2016-05-18 UTC**. | Yes. | Yes; base volume. | Maximum 300 candles per request; Coinbase warns historical rates may be incomplete and omits no-tick buckets, so full history needs paginated ranges and gap checks. | Public and cacheable, but materially later than Kraken and many more requests. | Credible alternative, not chosen. |
| **Gemini `ethusd` spot candles** (official) | The daily endpoint exposed only a rolling **364-candle** window (2025-08-22 through 2026-08-20 when checked). | Yes. | Yes. | The documented candle endpoint has no start/end parameters and returned newest first. | Simple public endpoint but cannot bootstrap history on its own. | Unsuitable for full history. |
| **Coin Metrics ETH-USD pair candles / reference rates** | Potentially long history; the entitled start would have to be checked against the paid catalogue. | **No venue identity:** pair candles derive from reference rates across a changing set of constituent markets. | Pair candles provide OHLC but **no volume**; they are computed from one-second reference rates, not from all pair trades. Market candles have venue OHLCV but reduce to one venue again. | UTC beginning-of-interval convention; engineered gapless candles forward-fill OHLC and set volume to zero. Full history is professional/paid; community data is recent-only. | Strong methodology for a licensed composite, but it changes both what the rings mean and what they cost. | Not a drop-in substitute. |

## Why a composite would change the artifact

The rings say a concrete pair on a concrete venue. A composite reference rate answers a different question: an engineered, outlier-resistant estimate of ETH/USD across a changing set of markets, and Coin Metrics' pair candles carry no volume because their underlying observations contain price, not trade quantity. Pairing composite OHLC with global or separately summed volume would make the contour and the weight describe different populations.

That could be a legitimate future direction, but it is not a data upgrade. It would mean renaming the specimen, disclosing the index and constituent methodology, choosing an independently defensible volume universe, handling constituent changes, and revisiting whether historical shapes stay comparable. For the same reason the site never stitches Kraken, Bitfinex, Coinbase, Gemini, Bitstamp, or an index together invisibly.

## Evidence

Primary and official documentation:

- [Kraken downloadable historical OHLCVT](https://support.kraken.com/articles/360047124832-downloadable-historical-ohlcvt-open-high-low-close-volume-trades-data) — candle definitions, intervals, market-beginning coverage, missing-candle semantics, complete and quarterly downloads.
- [Kraken downloadable time and sales](https://support.kraken.com/articles/360047543791-downloadable-historical-market-data-time-and-sales-) — full trade-history availability and fields.
- [Kraken REST OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data) — 720-entry ceiling and provisional final entry.
- [Kraken public API access](https://support.kraken.com/articles/360000919986-public-endpoint-examples-you-can-try-them-directly-in-a-web-browser-) and [rate limits](https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-) — no-account HTTP access and safe polling guidance.
- [Kraken legal terms selector](https://www.kraken.com/legal) and [current EEA terms](https://www.kraken.com/legal/eea-terms) — jurisdiction-dependent terms and the pricing-data permission boundary.
- [Bitfinex candles](https://docs.bitfinex.com/reference/rest-public-candles) — schema, 10,000-row maximum, and 30 requests per minute.
- [Coinbase Exchange product candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) — candle schema, missing-tick warning, and 300-candle maximum.
- [Gemini market-data REST documentation](https://docs.gemini.com/rest-api/#list-candles) — candle endpoint and supported daily interval.
- [Coin Metrics candles methodology](https://docs.coinmetrics.io/market-data-timeseries/market-candles) and [market-data FAQ](https://docs.coinmetrics.io/resources/faqs) — market/pair candle construction, gap filling, interval convention, reference-rate composition, and the absence of pair-candle volume.

Documentation for the source in use:

- [CryptoDataDownload Bitstamp page](https://www.cryptodatadownload.com/data/bitstamp/) — declared columns, source, update behaviour, and the stated New York timestamp conversion.
- [CryptoDataDownload terms](https://www.cryptodatadownload.com/terms-of-use/) — unverified/as-is disclaimer and non-commercial restriction.

Direct checks, 2026-08-21:

```text
GET https://api.kraken.com/0/public/Trades?pair=ETHUSD&since=1438300800000000000
  first row timestamp = 1438956205.775445 (2015-08-07T14:03:25.775Z)

GET https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv
  HTTP 200; Content-Length 322343; Last-Modified Fri, 21 Aug 2026 00:08:58 GMT
  3,207 rows; first 2017-11-09; last 2026-08-21; 0 duplicate dates
  missing date 2026-05-22; first 111 rows have volume columns reversed

GET https://api-pub.bitfinex.com/v2/candles/trade:1D:tETHUSD/hist?limit=10000&sort=1
  3,811 rows; first 2016-03-09T00:00:00Z; last 2026-08-21T00:00:00Z

GET https://api.exchange.coinbase.com/products/ETH-USD/candles
  with daily bounded ranges: first observed 2016-05-18T00:00:00Z

GET https://api.gemini.com/v2/candles/ethusd/1day
  364 rows; retrieved window 2025-08-22 through 2026-08-20
```

These are observations on one day, not guarantees of permanent availability. The build fails loudly if the CSV changes shape, which is the cheapest way to notice.
