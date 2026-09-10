# ETH/USD market-data sources

Last reviewed: 2026-08-21

The rings need one daily OHLC and volume series for ETH/USD that reaches as close to Ethereum genesis as possible without quietly joining different markets. This note records what the site uses, why, and what the better-reaching alternative would involve.

## What the site uses

The **CryptoDataDownload copy of Bitstamp ETH/USD daily candles**, one small CSV fetched at build time without an account. It is one market throughout, and its quirks are few enough to correct in code and disclose in the payload. The trade-off is that the file begins on **2017-11-09**, more than two years after genesis, so the interval before it is drawn as unpriced chronology rather than as price. The rules that follow are in [data-decisions.md](./data-decisions.md).

Two anomalies are handled explicitly and tested:

- For the first 111 rows, 2017-11-09 through 2018-02-27, the two volume columns are reversed. `lib/market-data.mjs` swaps them back for exactly that range.
- One date, **2026-05-22**, is missing. It is listed in `source.gaps` and never forward-filled.

The file's epoch and printed dates sit on 00:00 UTC, while the provider's site says its date field is converted to New York time. The code treats the observed UTC day boundary as the truth and says so in `source.timezone`.

CryptoDataDownload's terms describe the free data as unverified, as-is and for non-commercial use. This is a non-commercial project; a commercial use would need different rights or a different source.

## The stronger alternative: Kraken

Kraken spot ETH/USD reaches back to its first trade at **2015-08-07 14:03:25 UTC**, eight days after genesis, and Kraken publishes downloadable OHLCVT files from each market's beginning. It is the documented upgrade path, and nothing in the data model prevents adopting it: the first market ring would move to 2015, and genesis would stay a separately labelled origin with an eight-day unpriced gap.

It is not adopted yet because two things cannot be settled from repository evidence:

- **Rights.** Public API access is not an open-data licence. Kraken's regional terms assert ownership of pricing data and direct other uses to `marketdata@kraken.com`. Redistributing a cached history would need permission; shipping derived annual geometry rather than raw candles reduces the exposure but is not clearance.
- **The archive.** Full history is an all-pairs ZIP distributed through Google Drive, workable as a checksummed one-time seed but not something a build should download daily. A build would combine a pinned seed with one REST request for the recent window (the REST OHLC endpoint returns at most 720 candles and its last entry is the uncommitted day). The seed needs a one-time audit first: schema and pair check, epoch timestamps with no duplicates or out-of-order rows, a recorded hash, size and row count, an enumeration of every missing UTC day (Kraken omits intervals with no trades), price sanity checks, and a field-for-field comparison of overlapping archive and REST candles.

Two semantics would also change. Price would be the path of Kraken trades bounded into UTC days. Volume from the OHLCVT `volume` field is ETH units on that venue, not USD, and must not be labelled as USD; exact USD turnover would need `price × quantity` summed over trades.

## Comparison

| Source | Earliest observed | Notes | Verdict |
|---|---|---|---|
| **CryptoDataDownload, Bitstamp ETH/USD daily** | 2017-11-09 | One market; volume columns reversed for the first 111 rows; one missing date; non-commercial terms. | In use. |
| **Kraken ETH/USD spot** | 2015-08-07 | Best reach; full archive is a Google Drive ZIP plus a 720-candle REST window; no explicit redistribution licence. | The upgrade path. |
| **Bitfinex `tETHUSD`** | 2016-03-09 | Easy unauthenticated fetch, 10,000 candles a request; seven absent UTC dates to audit; terms unreviewed. | Credible second. |
| **Coinbase Exchange `ETH-USD`** | 2016-05-18 | 300 candles a request; omits no-tick buckets, so full history is many paginated requests with gap checks. | Alternative, not chosen. |
| **Gemini `ethusd`** | rolling 364 days only | The daily endpoint has no range parameters. | Unsuitable. |
| **Coin Metrics pair candles** | paid catalogue | A composite reference rate across changing venues, with no volume in pair candles. | Not a drop-in: it changes what the rings mean. |

A composite would answer a different question, an engineered estimate of ETH/USD across markets, and pairing its OHLC with a separately summed volume would make the contour and the weight describe different populations. It could be a future direction, but it is a different specimen, not a data upgrade. For the same reason the site never stitches venues together invisibly.

## Evidence

- Kraken: [downloadable OHLCVT](https://support.kraken.com/articles/360047124832-downloadable-historical-ohlcvt-open-high-low-close-volume-trades-data), [time and sales](https://support.kraken.com/articles/360047543791-downloadable-historical-market-data-time-and-sales-), [REST OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data), [public endpoints](https://support.kraken.com/articles/360000919986-public-endpoint-examples-you-can-try-them-directly-in-a-web-browser-), [rate limits](https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-), [legal terms](https://www.kraken.com/legal) and [EEA terms](https://www.kraken.com/legal/eea-terms).
- [Bitfinex candles](https://docs.bitfinex.com/reference/rest-public-candles), [Coinbase Exchange candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles), [Gemini candles](https://docs.gemini.com/rest-api/#list-candles), [Coin Metrics candles methodology](https://docs.coinmetrics.io/market-data-timeseries/market-candles) and [FAQ](https://docs.coinmetrics.io/resources/faqs).
- CryptoDataDownload: [Bitstamp page](https://www.cryptodatadownload.com/data/bitstamp/) and [terms](https://www.cryptodatadownload.com/terms-of-use/).

Direct checks on the review date:

```text
Kraken   Trades?pair=ETHUSD&since=genesis  → first trade 1438956205.775 (2015-08-07T14:03:25Z)
CDD      Bitstamp_ETHUSD_d.csv             → 3,207 rows, 2017-11-09 … 2026-08-21, 0 duplicates,
                                             1 missing date (2026-05-22), first 111 rows reversed
Bitfinex candles/trade:1D:tETHUSD/hist     → 3,811 rows, first 2016-03-09
Coinbase products/ETH-USD/candles          → first 2016-05-18
Gemini   candles/ethusd/1day               → 364 rows, 2025-08-22 … 2026-08-20
```

These are observations on one day, not guarantees. The build fails loudly if the CSV changes shape, which is the cheapest way to notice.
