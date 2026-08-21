# Computational dendrochronology specimen system

Status: **Wave 2 implementation specification**

Inputs: `TODO.md`, `docs/research/decision-gate.md`, and the current desktop/mobile baseline

Terminology: rings = market years; ring shape = price; weight = volume; knots = protocol milestones; scars = security incidents; outer edge = unfinished present

## Design thesis

The finished page should read as a **botanical specimen plate for a digital organism**: warm paper, nearly black ink, a large transverse-section visualization, and a small amount of exact technical notation. The annual rings remain the unmistakable hero. Archival atmosphere comes from material color, typographic cadence, fine rules, and restrained registration marks—not from a literal tree, ornamental pseudo-data, distressed legibility, or copied scientific ephemera.

The interface has three visual voices:

1. **Specimen** — the annual rings, origin, unfinished edge, knots, and scars.
2. **Instrument** — real series metadata, controls, legend, selection, and source/freshness state.
3. **Editorial** — the short introduction and concise explanations that translate the encoding.

At rest, the specimen dominates. Instrument text stays quiet until selected. Editorial copy has room to breathe and never overlaps the visualization.

## Non-negotiable data boundary

The chronology begins at Ethereum genesis on **2015-07-30**, but the accepted Bitstamp ETH/USD series begins on **2017-11-09**. The central pre-series interval must be labeled as unpriced chronology; it must not be shaped like price data, interpolated, or backfilled. The first market ring is a partial 2017 ring beginning at its true day-of-year angle.

Recommended visual treatment:

- Put the genesis/pith mark at the center with `ORIGIN · 2015-07-30`.
- Use a quiet, unfilled radial interval between the pith and first priced ring, with one short leader label: `UNPRICED INTERVAL · 2015-07-30—2017-11-08`.
- Begin the 2017 grain at the exact 2017-11-09 angle; leave its earlier arc absent, not faintly completed.
- Do not call 2015 or 2016 market years and do not assign them price contours.
- The current year ends at the real data cutoff and remains visibly open at the bark.

## Design tokens

Token names below are intended to map directly to CSS custom properties. Values are the implementation starting point; any adjustment must preserve semantic roles and re-run contrast checks.

### Color

| Token | Value | Use |
|---|---:|---|
| `--paper` | `#EEE9D9` | Page and canvas field |
| `--paper-deep` | `#E7E0CD` | Subtle inset/state field; never a card stack |
| `--paper-shadow` | `#BEB8A8` | Printed-edge tint, disabled rules, texture only |
| `--ink` | `#171A17` | Primary text, primary grain, active controls |
| `--ink-secondary` | `#55574F` | Secondary copy and metadata; safe on both paper tones |
| `--ink-faint` | `#66685F` | Nonessential large/technical labels on `--paper` only |
| `--line` | `rgba(23, 26, 23, 0.22)` | Dividers and registration rules |
| `--line-strong` | `rgba(23, 26, 23, 0.48)` | Active rule, current edge, selected geometry |
| `--copper` | `#97694E` | Non-text editorial mark, leader accent, healed trace |
| `--copper-text` | `#704A37` | Copper-family text, links, selected annotation |
| `--botanical` | `#263A30` | Deep field, scar/structure emphasis, inverse state |
| `--ethereum` | `#455A96` | Active Ethereum-specific interaction and focus ring |
| `--success` | `#285C46` | Positive return/status text, never sole indicator |
| `--danger` | `#8A352E` | Negative return/error text, never sole indicator |
| `--scar` | `#252422` | Scar interior; distinguish with silhouette as well as tone |

Contrast on `--paper`: `--ink` 14.45:1, `--ink-secondary` 6.04:1, `--ink-faint` 4.66:1, `--copper-text` 6.35:1, `--botanical` 9.99:1, `--ethereum` 5.48:1, `--success` 6.38:1, and `--danger` 6.58:1. Raw `--copper` is only 3.89:1 against the paper, so it is not body text or a thin focus indicator. On `--paper-deep`, use `--ink`, `--ink-secondary`, `--copper-text`, `--botanical`, `--ethereum`, `--success`, or `--danger`; do not use `--ink-faint` for small text there.

The page declares `color-scheme: light`. Browser controls, selection, and canvas fallback backgrounds must not inherit the old dark scheme.

### Typography

No network font is required for release. Use system-capable stacks so the composition remains stable offline:

```css
--font-editorial: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
--font-interface: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "SFMono-Regular", "Roboto Mono", Consolas, "Liberation Mono", monospace;
```

| Role | Family | Size / line height | Other rules |
|---|---|---|---|
| Display title | editorial | `clamp(2.25rem, 5vw, 5.25rem)` / `0.92` | weight 400; tracking `-0.035em`; max 12 characters per line only when intentionally broken |
| Entrance copy | editorial | `clamp(1.25rem, 2.2vw, 2rem)` / `1.35` | max `32ch`; no all caps |
| Readout value | editorial | `clamp(2.5rem, 4vw, 4.75rem)` / `0.95` | tabular numerals |
| Body/editorial note | interface | `0.9375rem` / `1.6` | max `60ch` |
| Control | interface | `0.8125rem` / `1.2` | minimum 44px target; sentence or concise title case |
| Metadata | mono | `0.6875rem` / `1.45` | uppercase labels, tracking `0.08em`; values may retain case |
| Micro label | mono | `0.625rem` / `1.35` | minimum rendered size; never lower than 10px |

Use `font-variant-numeric: tabular-nums lining-nums` on dates, prices, returns, blocks, epochs, and timestamps. Do not imitate typewriter defects with random rotation, baseline shifts, missing characters, or blur. The serif voice carries the poetic premise; the mono voice is reserved for actual machine-readable values.

### Spacing and geometry

Use a 4px base step:

```text
--space-1  4px      --space-5  20px      --space-9  64px
--space-2  8px      --space-6  24px      --space-10 80px
--space-3  12px     --space-7  32px      --space-11 112px
--space-4  16px     --space-8  48px      --space-12 144px
```

- Page maximum inline size: `1440px`.
- Content gutter: `clamp(20px, 4vw, 64px)`.
- Main specimen diameter: `clamp(360px, min(62vw, 76svh), 760px)` desktop; `min(86vw, 680px)` tablet; `min(92vw, 440px)` mobile.
- Instrument panel: `280–336px` desktop; full width below specimen at smaller breakpoints.
- Hairline: 1 CSS px; never use subpixel borders as the sole state cue.
- Interactive target: minimum `44 × 44px`; event hit areas may be larger than their drawn marks.
- Corners: `0` for plate rules and panels, `2px` for compact controls, `999px` only for circular marks/pills whose shape has meaning. Avoid generic rounded cards.

### Material and texture

The paper is a field, not a photograph. Build it from the flat `--paper` color plus at most two static CSS gradients at 1–3% opacity: one broad warm/cool drift and one fine deterministic grain. Texture must not animate, cross text glyphs at high contrast, or be baked into the canvas data layer. At 200% zoom it should recede rather than resemble compression noise.

Use printing irregularity only in the specimen strokes: slight deterministic opacity/width variation derived from data geometry or a fixed seed. Never jitter event positions, dates, scales, hit targets, leader endpoints, or text.

### Motion

| Token | Value | Use |
|---|---:|---|
| `--duration-fast` | `120ms` | hover/focus color and rule |
| `--duration-state` | `240ms` | inspector content and selection emphasis |
| `--duration-intro` | `650ms` | one entrance-to-explorer reveal |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | state entry |

Nothing loops except a restrained loading indication. No parallax, breathing specimen, orbiting labels, simulated scan, or cursor-following decoration. Under `prefers-reduced-motion: reduce`, use a direct state swap or opacity change of at most 80ms, disable drawing/reveal motion, and preserve focus placement.

## Composition

### Shared page frame

The header is a narrow utility rail, not a dashboard masthead. It contains the product name, a compact `Read introduction` icon button with visible tooltip, and external links. A 1px rule separates it from the plate; the header may become visually transparent during the first-session entrance but its required controls remain reachable according to the narrative-flow specification.

The usable explorer has four zones:

1. **Identity** — title and truthful specimen identity.
2. **Live metadata** — current state, series, source, update/cutoff.
3. **Specimen** — the rings, sparse marks, origin, and selected leader/readout.
4. **Instrument panel** — controls, selection details, event semantics, methodology/source links.

The compact encoding key is persistent in the ready state. It is visually separate from the introduction and uses the locked wording:

```text
Ring shape — price
Weight — volume
Knots — milestones
Scar size — hack magnitude
```

Legend marks must reuse the actual renderer vocabulary: irregular line, weighted line, asymmetric knot, tapered scar. A generic dot must not stand in for both knots and scars.

### Desktop: 1180px and wider

Use a 12-column plate with a quiet top band and an 8/4 specimen-to-instrument split.

```text
┌────────────────────────────────────────────────────────────────────┐
│ identity: cols 1–5                 live metadata: cols 9–12       │
│                                                                    │
│      specimen: cols 1–8                 instrument: cols 10–12    │
│      620–760px, centered                 controls + selected data   │
│                                                                    │
│ legend: cols 1–8                  source / methodology: 10–12      │
└────────────────────────────────────────────────────────────────────┘
```

- Keep at least 48px between specimen bounds and the instrument divider.
- The specimen receives at least 60% of usable width and is vertically centered in the first viewport where height permits.
- Identity sits upper-left: small mono discipline label, then the editorial title. Do not stack the title into a narrow sidebar.
- Live metadata is right-aligned by label/value columns, not justified letter-by-letter.
- The panel uses one vertical rule; it is not boxed or elevated.
- Controls and selected details can remain beside the specimen, but the key stays aligned with the specimen rather than squeezed into the panel.
- At short desktop heights, reduce vertical gaps before reducing specimen diameter; never allow the panel to overlap or compress the rings into illegibility.

### Tablet: 720–1179px

Use an 8-column layout.

- Identity occupies columns 1–5 and live metadata 6–8 on the top band.
- Center the specimen across columns 1–8 at `min(86vw, 680px)`.
- Put the legend immediately below the specimen, wrapping as two pairs if necessary.
- Put year/month controls and selected details below in a two-column row: controls left, readout right. Collapse to one column below roughly 820px if either side falls below 300px.
- Preserve at least 48px of paper between title/metadata and specimen.
- Registration marks may sit at the specimen's four cardinal bounds only when they align to true month axes; omit them before shrinking the visualization.

### Mobile: below 720px

Use one column and a vertical reading order:

```text
header
identity + one-line state
specimen
interaction instruction
encoding key (2 × 2)
year control
month control
selected readout / event detail
source + freshness + methodology
```

- Gutter: 20px through 359px viewport width; 24px above that.
- Specimen width: `min(92vw, 440px)` with no horizontal scroll.
- Keep `Ethereum Annual Rings` on one or two intentional lines; never force the three-line narrow-rail treatment seen in the desktop baseline.
- Reduce peripheral labels before reducing ring contrast. Keep only cardinal month labels at the smallest width; controls retain all months.
- Render year/month choices as 44px minimum targets. Six month columns are acceptable at 360px and wider; use four columns below 360px if label/target width would fail.
- The legend is a 2 × 2 grid with 12px row gap and may not become a single tiny line.
- Live metadata initially shows `STATE`, `CURRENT_RING`, and `DATA_THROUGH`; disclose full series/source/update details directly below the readout. This is reordering, not deletion.
- Never pin the panel over the specimen. Sticky behavior is limited to the small header if testing shows it does not consume more than 56px.

## Density and annotation rules

### Persistent

- Genesis/pith label.
- Current year and `STILL GROWING`/`OPEN` state.
- Compact four-item encoding key.
- True data source and cutoff/freshness.
- One interaction instruction using the locked wording: `Trace the grain · Hover or tap to read a month.` Exact day-of-year event placement does not change the market selector's monthly granularity.

### On specimen, unselected

- All knot and scar shapes may be visible, but only the current-year label and genesis label are textual.
- Up to four truthful axis/registration ticks may appear. Month labels may remain if they do not collide at the tested diameter.
- No permanent ring-by-ring year labels around the circumference; year identity belongs in controls and committed selection.

### On hover/focus/selection

- Reveal one event leader and one compact label at a time.
- Leader labels contain event type, short name, and date; detailed summary and source remain in the semantic inspector.
- If a date has both the DAO exploit scar and DAO fork knot, the selected mark and label must state `Scar` or `Milestone` explicitly.
- A hover preview must not reflow the page. Committed selection may update the instrument panel.
- Collision handling drops the leader label into the panel before it moves the true event mark.

### Never

- More than one expanded event annotation over the specimen.
- A decorative coordinate, sample count, scan status, specimen measurement, Latin species name, terminal error, or checksum not produced by the application.
- A radial starburst of leaders.
- Labels placed by eye when they imply an exact date or value.

## Truthful specimen metadata

Every metadata row is either constant product identity or derived from the loaded payload/current date. Suggested field mapping:

```text
COMPUTATIONAL DENDROCHRONOLOGY       constant discipline label
Ethereum Annual Rings               constant product title
LIVE MARKET SPECIMEN · ETH/USD      series identity

SPEC_ID: ETH_TREE_001                constant artifact identifier
ORIGIN: 2015-07-30                   canonical Ethereum genesis
STATE: GROWING                       derived: current ring is incomplete
CURRENT_RING: 2026 / OPEN            derived from payload and current date
SERIES: ETH/USD / DAILY              payload cadence and pair
SOURCE: BITSTAMP · VIA CDD           real market plus distribution source
DATA_FROM: 2017-11-09                first accepted candle
DATA_THROUGH: 2026-08-21             payload cutoff, not wall-clock today
UPDATED: 2026-08-21 14:00 UTC        cache updatedAt, with timezone
```

Rules:

- Do not render a field until its value exists and passes validation.
- `LIVE` describes the maintained specimen, not tick-level streaming. Pair it with `UPDATED` and `DATA_THROUGH` so freshness is honest.
- If serving last-known-good data after refresh failure, replace `LIVE MARKET SPECIMEN` with `CACHED MARKET SPECIMEN` in status metadata while leaving the visualization usable.
- `SOURCE` must not say only `BITSTAMP` if the shipped file/API is distributed by CryptoDataDownload; `BITSTAMP · VIA CDD` is concise and accurate.
- Expose the observed UTC day boundary in methodology. Do not invent a local-market timezone.
- Show the known missing 2026-05-22 candle in methodology or a real `GAPS: 1` field only if gap count is computed from payload metadata.
- Do not make block, epoch, price, volume, or loss values look like physical dimensions.

## Component language

### Identity block

- Mono eyebrow: `COMPUTATIONAL DENDROCHRONOLOGY`.
- Editorial H1: `Ethereum Annual Rings`.
- One concise sentence may sit below on the explorer; the poetic 45–60 word version belongs to the entrance.
- The Ethereum diamond is a small identity stamp, not a repeated decorative watermark.

### Specimen canvas

- Transparent canvas over `--paper`; never a dark square or card.
- Primary rings use `--ink`; quiet grain uses ink at reduced alpha, not grey imported from the old dark palette.
- The current bark uses a dark, interrupted open edge, plus text; incompleteness cannot depend on opacity alone.
- Selection uses `--ethereum` plus increased width/outline. Hover uses `--copper-text` or a local leader without replacing the focus treatment.
- Knots are asymmetrical embedded ovals with local grain swelling. Scars are charcoal-like tapered wounds whose geometry conveys type without color.
- The center is quiet enough for genesis/origin; do not put a logo, period, and multiple labels on top of one another.

### Instrument controls

- Use text buttons with a bottom rule or small bracketed index; selected state has text, rule, and `aria-pressed`, not color alone.
- Hover changes ink and rule in 120ms. Focus uses a 2px `--ethereum` outline with 3px offset.
- Disabled future months retain readable text at 45% opacity and `cursor: not-allowed`; do not make them disappear.
- Use a compact year grid or horizontal list that wraps cleanly. Never compress digits until labels overlap.

### Selected readout

- Lead with selected date/year and the market value appropriate to the control, not a decorative “specimen reading.”
- Positive/negative return uses `--success`/`--danger` plus a `+`/`−` sign and text label.
- Event detail begins with `Milestone` or `Scar`, then name and exact date, factual summary, reported impact where applicable, recovery/healing state, confidence, and a source link.
- For Bybit, say `exchange custody compromise`; for every accepted scar, avoid `Ethereum protocol hack` because the protocol itself was not compromised.
- Source links use underline plus the darker copper text; external-arrow glyphs are supplementary.

### Compact legend

- Use a real mark sample 20–28px wide and the exact encoding phrase.
- Text is 11px mono or 12px interface, not 8px.
- `Scar size — hack magnitude` requires a small/large silhouette pair or tapered sample so magnitude is visually legible.
- Keep it visible in the ready state; on mobile it belongs in normal flow, not a floating overlay.

### Read introduction button

- Use a neutral lowercase `i` within a thin 24px visual circle but provide a 44px hit area.
- Accessible name and tooltip: `Read introduction`.
- Default is `--ink-secondary`; hover/focus becomes `--ink` with the standard focus outline.
- Do not use a flask, leaf, tree, terminal prompt, or Ethereum logo as the info symbol.

## State matrix

| State | Specimen | Metadata / copy | Controls | Motion |
|---|---|---|---|---|
| First-session entrance | May be faintly present only if narrative-flow spec selects that route; no interactive selection behind modal state | Identity plus 45–60 word editorial introduction and entry action | Inert while entrance is active | One reveal, reduced-motion direct swap |
| Loading | Reserve final specimen diameter; show three non-data concentric guide rings or a simple rule pulse | `LOADING MARKET SPECIMEN…`; no dates/prices/source cutoff until received | Disabled or withheld | One low-contrast indeterminate pulse; no simulated growth |
| Ready | Full specimen and current open edge | Truthful metadata, cutoff, updated time | Enabled | Selection transitions only |
| Hover preview | Local mark/grain emphasis; no persistent page reflow | Optional compact visual label; semantic live region stays silent | Existing committed state retained | 120ms color/width |
| Committed selection | One selected ring/event plus leader; all other marks quiet | Inspector updates and announces once | `aria-pressed` updated | ≤240ms; direct under reduced motion |
| Current year / partial | Outer ring ends at actual cutoff and bark remains open | `CURRENT_RING: YYYY / OPEN` and `STILL GROWING`; show `DATA_THROUGH` | Future months disabled | No looping growth animation |
| Pre-series interval | Empty/quiet chronological core; partial 2017 starts at true angle | `UNPRICED INTERVAL` with exact dates | No fabricated 2015–2016 market controls | None |
| No event on selection | No placeholder knot/scar; selected grain remains | `No displayed milestone or scar on this date.` Keep market readout intact | Enabled | None |
| No events dataset | Render market rings normally with no event marks | `Event chronology unavailable.` Do not imply “nothing happened” | Market controls enabled; event list absent | None |
| Cached after refresh failure | Render last-known-good specimen unchanged | Quiet but persistent `CACHED · UPDATED … · DATA THROUGH …`; methodology explains last-known-good behavior | Enabled | None |
| Empty cache / 503 | No data-shaped specimen; retain plate frame and identity | `Market specimen unavailable — no cached dataset exists.` Offer `Try again`; do not show stale example values | Retry and project/method links only | None except focus |
| Invalid/parse error | Same as empty cache | `Market data could not be validated. The last good specimen was not replaced.` If no last good payload, use empty-cache state | Retry if meaningful | None |

Loading guide rings are explicitly not annual rings: equal circles, no year labels, no price-like contour, and `aria-hidden`. Loading status text carries the meaning. If layout stability can be achieved with an empty reserved field, prefer that over animation.

## Responsive content priority

When space is constrained, reduce in this order:

1. Omit nonessential registration ticks.
2. Move full metadata below the readout while retaining state and cutoff near the top.
3. Replace circumferential month labels with cardinal labels; retain complete semantic controls.
4. Shorten on-canvas event label to type/name/date and move summary to inspector.
5. Reduce title size within its token range.
6. Reduce specimen diameter only after the above.

Never remove source/freshness, current/open state, origin, encoding legend, focus indication, event type, or semantic readout to save space.

## Do / don't examples

| Do | Don't |
|---|---|
| Use `ORIGIN: 2015-07-30` and label the pre-series interval. | Draw plausible-looking 2015–2017 price rings. |
| Show `SOURCE: BITSTAMP · VIA CDD` and real cutoff/update values. | Add `SCAN 033`, fake coordinates, invented sample IDs, or decorative checksums. |
| Use one large transverse section with generous paper around it. | Add a trunk, branches, roots, leaves, bark photograph, or literal tree silhouette. |
| Let deterministic grain variation make the specimen organic. | Randomly rotate text, event positions, or leader lines to look handmade. |
| Use exact event geometry and reveal one label at a time. | Surround every knot and scar with permanent annotations. |
| Use copper sparingly for editorial interpretation and selected leaders. | Apply copper to all headings, all links, or body copy at its low-contrast raw value. |
| Use Ethereum blue for active/focus states that meet contrast. | Flood the specimen with brand gradients or rely on blue alone for state. |
| Keep cached data visible with honest freshness. | Replace a valid cached specimen with an error screen after refresh failure. |
| Describe incidents by affected layer and researched impact. | Call a contract, bridge, wallet, or exchange compromise an Ethereum protocol hack. |
| Keep the compact encoding key persistent. | Repeat the full key in the narrative and hide it after entry. |

## Acceptance checks for implementation

- At 1440×900, 1024×768, 768×1024, 390×844, and 320×568, the specimen is the largest single element and no label/control overlaps.
- The page has no horizontal scroll at 320 CSS px and remains usable at 200% zoom.
- The 2015–2017 interval is visibly unpriced; the partial 2017 and current-year endpoints are not closed or backfilled.
- Every visible metadata value is constant truth or derived from validated application data.
- Four legend phrases exactly match the locked terminology.
- Default, hover, focus-visible, selected, disabled, loading, no-event, cached, error, and current/open states are visually distinct without color alone.
- Standard text and interactive indicators meet WCAG AA contrast on both paper tones; raw copper is not used for small text.
- Touch targets are at least 44×44px and the specimen has a semantic equivalent outside canvas.
- Reduced motion removes drawing/reveal motion and preserves state/focus behavior.
- Texture remains subordinate at 100%, 200% zoom, and high-contrast/forced-colors testing; essential meaning does not depend on texture.
- Screenshots contain no literal tree, copied reference phrasing/layout, random code, fake terminal output, invented measurements, or decorative pseudo-science.

## Open integration questions

1. The narrative-flow owner must choose whether the specimen is absent or faintly visible behind the first-session introduction. This system supports either, but recommends faint visibility only if contrast and modal focus isolation remain clear.
2. Event-geometry testing may require the desktop specimen maximum to settle between 720px and 760px. Preserve the diameter token range until collision tests select the smallest reliable event-hit geometry.
3. If the final selector stays month-based while events use exact day-of-year geometry, the interaction instruction must say `month`, and event selection needs its own semantic control/list; copy must not promise day-level market selection.
4. The cache payload must expose enough validated metadata to distinguish `ready`, `cached after refresh failure`, and `empty cache`. Do not infer outage state from data age alone.
