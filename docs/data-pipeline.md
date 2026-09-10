# Data pipeline

The site is a Next.js static export. There is no server and no API: the market history is fetched once, before each build, and written into the export as a plain JSON file that the page loads like any other static asset.

## Source

`scripts/fetch-market-data.mjs` downloads the CryptoDataDownload copy of Bitstamp ETH/USD daily candles from `https://www.cryptodatadownload.com/cdd/Bitstamp_ETHUSD_d.csv`, with a 20-second timeout. Why that file, and what the alternatives were, is in [market-data-sources.md](./market-data-sources.md).

## Fetch, validate, aggregate

`lib/market-data.mjs` does the work and is pure, so the tests run it against fixture CSVs with an injected fetch and clock.

1. **Parse.** The CSV is located by its exact header (`unix,date,symbol,open,high,low,close,Volume ETH,Volume USD`). Every row must have nine columns and finite numbers. For the rows from 2017-11-09 through 2018-02-27 the two volume columns, which the source has reversed, are swapped back.
2. **Select and validate.** Rows are kept only for `ETH/USD` on or after 2017-11-09 and sorted by date. Duplicate dates, a first row that is not 2017-11-09, a `unix` value that does not match its date, non-positive prices, a low above or a high below the open/close, and negative volume all throw.
3. **Aggregate.** For each year from the first to the last observed: per-month open, close, average close, low, high, and USD volume; a `priceShape` of four close samples per observed month, log-transformed and scaled to that year's range (−1 to 1); a `volumeShape` and per-month `volumeWeight` of sampled USD volume, log10-transformed and scaled across the whole period; and `startProgress`/`progress`, the fraction of the year the observations cover.
4. **Disclose.** Missing dates between the first and last row are listed as `source.gaps`. The milestone records from `lib/event-data.mjs` are validated and embedded.

Any failure throws, the script exits non-zero, and nothing is written.

## The JSON

`public/market-data.json` has a `chronology` block (genesis origin, first market date, the unpriced interval label), a `source` block (provider, market, URL, cutoff date, timezone note, gaps, observed row count), a `cache` block (schema version and the build timestamp), a `methodology` block of plain-language notes, the `years` array described above, and the `milestones` array. `app/layout.tsx` preloads the file and `EthRings.tsx` fetches it on mount.

## Schedule and failure

`.github/workflows/deploy.yml` runs on every push to `main`, on a manual dispatch, and on a daily schedule. Each run installs with pnpm, runs `pnpm run data`, builds, and publishes the `out/` directory to GitHub Pages. A failed fetch or a validation error fails the build, and the previously published site, with its last good data, stays in place.

## Locally

`pnpm dev` and `pnpm build` fetch the file only if `public/market-data.json` is absent, so work stays offline after the first run. `pnpm run data` refreshes it on demand.
