# Ethereum Annual Rings

An artistic visualization of seven years of the Ethereum market, recast as the
growth rings of a tree. Price shapes each annual contour, trading volume changes
the brush weight, and selected market shocks appear as knots in the grain.

## How to read it

- **Angle** is calendar time. January begins at twelve o'clock and the year moves clockwise.
- **Ring** is one calendar year, from 2019 at the center to 2025 at the outer edge.
- **Radial shape** is four close-price samples per month, log-transformed and normalized within each year.
- **Stroke weight** is average daily USD volume for that month, log10-transformed and normalized across 2019–2025.
- **Knots** mark a small, sourced set of market shocks. They add context; they are not a complete incident dataset or a claim of causation.

Because every year is normalized to its own observed price range, the artwork
shows rhythm rather than comparable absolute magnitude. The fixed readout keeps
the precise monthly and annual values visible while the selection changes.

## What makes the project interesting

The visualization is deliberately both expressive and inspectable:

- a high-DPI Canvas renderer builds 360-point organic contours from 48 annual samples;
- static grain is cached separately from the interactive highlight layer;
- pointer, touch, keyboard, and direct controls expose the same year/month selection;
- a fixed semantic readout mirrors the selected graph segment without a popover;
- the checked-in dataset is generated deterministically from a daily Bitstamp snapshot;
- automated tests cover parsing, calendar completeness, known aggregates, normalized domains, and server-rendered output.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server.

To run every repository check:

```bash
npm run test:all
```

## Data workflow

The application consumes [`data/eth-market.json`](data/eth-market.json), a
small derived artifact that is safe to keep in the repository. To reproduce it:

1. Download the Bitstamp ETH/USD daily CSV from [CryptoDataDownload](https://www.cryptodatadownload.com/data/bitstamp/).
2. Save it as `work/bitstamp_ethusd_daily.csv`.
3. Run `npm run data:generate`.
4. Run `npm run data:check`.

The raw CSV is ignored to avoid redistributing a third-party dataset without
its license. The generator rejects incomplete calendar years. See
[`data/README.md`](data/README.md) for the full encoding and provenance notes.

## Project structure

```text
app/
  components/EthRings.tsx   React state, events, controls, and readout
  components/eth-rings/     Typed model, formatting, and Canvas renderer
  page.tsx                  Single visualization-first page
data/
  eth-market.json           Checked-in derived dataset
lib/
  market-data.mjs           CSV parsing and deterministic aggregation
scripts/
  generate-market-data.mjs  Rebuild/check command
tests/                       Data and rendered-page tests
```

## Stack

React 19, TypeScript, Next.js-compatible App Router via vinext, Vite, and a
Cloudflare Worker deployment target. The visualization itself has no charting
library or runtime data dependency.

## Accessibility

The canvas is keyboard-focusable: left/right selects a month and up/down selects
a year. Equivalent year and month buttons are available below it, and changes
are reflected in a fixed semantic readout announced through a polite live
region. Motion is reduced when requested by the operating system.

## License

Source code is available under the [MIT License](LICENSE). Market data remains
subject to the source provider's terms.
