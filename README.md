# Ethereum Annual Rings

Ethereum Annual Rings is an interactive botanical specimen plate for Ethereum's market history. Each annual contour maps one Bitstamp ETH/USD year: price shapes the ring, trading volume changes its weight, protocol milestones appear as embedded knots, and sourced ecosystem security incidents appear as magnitude-scaled scars.

The chronology begins at Ethereum genesis on 30 July 2015. Because the chosen single-market series starts on 9 November 2017, the specimen truthfully renders the earlier interval as unpriced growth rather than silently stitching exchanges. The current year remains visibly open.

## Reading the specimen

- **Angle** is calendar time, beginning at twelve o'clock and moving clockwise.
- **Ring shape** is four close-price samples per observed month, log-transformed within each year.
- **Weight** is average daily USD volume, normalized across the visible period.
- **Knots** are selected Ethereum protocol milestones; Frontier is the chronology origin.
- **Scars** are selected Ethereum-ecosystem incidents. Their fixed log scale represents a documented USD estimate from $1 million to a capped $1.5 billion, with recovery caveats retained in the readout.

The artwork communicates rhythm and chronology, not directly comparable absolute prices. Selecting any observed month or event reveals exact values and sourced context.

## Architecture

Visitors make one same-origin request to `/api/market-data`. That endpoint only reads the shared `MARKET_CACHE` R2 object; it never calls the provider. A Cloudflare hourly scheduled handler fetches the CryptoDataDownload Bitstamp CSV once, validates and aggregates it, and atomically replaces the single last-known-good payload. Provider failures preserve the existing cache, while an uninitialized cache returns a clear `503`.

The browser renders a high-DPI Canvas specimen with deterministic event geometry and semantic HTML controls/readouts alongside it. A session-scoped introduction manages focus, escape dismissal, and reduced motion. Event records and their source metadata live separately from the market series.

## Run locally

Requires Node.js 22.13 or newer.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

In another terminal, seed the local R2 cache through the scheduled handler:

```bash
curl "http://localhost:3000/cdn-cgi/handler/scheduled?format=json"
```

Then open `http://localhost:3000`. Local R2 state is stored by Wrangler outside the committed application data.

Run every repository check with:

```bash
pnpm run test:all
```

## Project structure

```text
app/
  api/market-data/route.ts       Cache-only application endpoint
  components/EthRings.tsx       Explorer state, controls, and readout
  components/NarrativeShell.tsx Session entrance and focus management
  components/eth-rings/         Model, event geometry, and Canvas renderer
lib/
  event-data.mjs                Sourced milestone and scar records
  market-data.mjs               Provider parsing, validation, and aggregation
  market-cache.mjs              Last-known-good R2 cache boundary
worker/index.ts                  Visitor routing and hourly scheduled refresh
docs/research/                  Source investigations and decision record
docs/design/                    Approved visual and interaction contracts
docs/qa/                        Baseline, final screenshots, and audits
tests/                           Data, cache, geometry, narrative, and SSR tests
```

## Data boundaries and limitations

- Market source: CryptoDataDownload's Bitstamp ETH/USD daily file. Its terms govern the market data independently of this repository's MIT-licensed code.
- Coverage begins 9 November 2017; 30 July 2015–8 November 2017 is deliberately marked unpriced.
- The 2017 ring is partial, and the current year is partial until complete.
- The upstream file currently omits 22 May 2026; the API discloses this in `source.gaps` instead of interpolating it.
- Protocol milestones and security scars are editorially selected, sourced context—not claims that an event caused market movement and not a comprehensive incident database.
- Reported exploit values use differing contemporary valuation bases. The UI discloses recoveries and caveats, and the visual scale is intentionally capped.

See [the research decision gate](docs/research/decision-gate.md) and [the cache note](docs/engineering/hourly-cache.md) for the full rationale.

## Accessibility and performance

The Canvas supports pointer, touch, and keyboard input. Left/right selects observed months, up/down changes year, and Home/End jumps within a year. Equivalent semantic event buttons, a fixed readout, a concise text alternative, visible focus, skip behavior, and reduced-motion styling keep the visualization usable without precision pointing or animation.

The renderer caps device-pixel ratio, caches the static artwork, and redraws only the interaction layer during selection. Visitor traffic cannot increase upstream request volume.

## Sources and license

Source code is available under the [MIT License](LICENSE). Every visible milestone and scar retains its source URL, source type, checked date, and confidence note in `lib/event-data.mjs`; market data remains subject to the provider's terms.
