# Computational dendrochronology specimen system

Terminology: rings are market years; ring shape is price; weight is volume; knots are protocol milestones; the outer edge is the unfinished present.

## Design thesis

The page reads as a **botanical specimen plate for a digital organism**: warm paper, nearly black ink, a large transverse-section visualization, and a small amount of exact technical notation. The annual rings are the unmistakable hero. Archival atmosphere comes from material colour, typographic cadence, fine rules, and restrained registration marks, not from a literal tree, ornamental pseudo-data, distressed legibility, or copied scientific ephemera.

The interface has three visual voices:

1. **Specimen** — the annual rings, origin, unfinished edge, and knots.
2. **Instrument** — real series metadata, controls, key, selection, and source and freshness state.
3. **Editorial** — the short explanations that translate the encoding.

At rest, the specimen dominates. Instrument text stays quiet until selected. Editorial copy has room to breathe and never overlaps the visualization.

## The data boundary

The chronology begins at Ethereum genesis on **2015-07-30**, but the Bitstamp ETH/USD series begins on **2017-11-09**. The pre-series interval at the centre is labelled as unpriced chronology; it is never shaped like price data, interpolated, or backfilled. The first market ring is a partial 2017 ring beginning at its true day-of-year angle.

The visual treatment that follows:

- The genesis mark sits at the centre with `ORIGIN · 2015-07-30`.
- A quiet, unfilled radial interval separates the pith from the first priced ring, with one short leader label: `UNPRICED INTERVAL · 2015-07-30—2017-11-08`.
- The 2017 grain begins at the exact 2017-11-09 angle; its earlier arc is absent, not faintly completed.
- 2015 and 2016 are never called market years and never receive price contours.
- The current year ends at the real data cutoff and stays visibly open at the bark.

## Design tokens

Token names map to CSS custom properties. Values are the starting point; any adjustment must preserve the semantic roles and re-run the contrast checks.

### Colour

| Token | Value | Use |
|---|---:|---|
| `--paper` | `#EEE9D9` | Page and canvas field |
| `--paper-deep` | `#E7E0CD` | Subtle inset or state field; never a card stack |
| `--paper-shadow` | `#BEB8A8` | Printed-edge tint, disabled rules, texture only |
| `--ink` | `#171A17` | Primary text, primary grain, active controls |
| `--ink-secondary` | `#55574F` | Secondary copy and metadata; safe on both paper tones |
| `--ink-faint` | `#66685F` | Nonessential large or technical labels on `--paper` only |
| `--line` | `rgba(23, 26, 23, 0.22)` | Dividers and registration rules |
| `--line-strong` | `rgba(23, 26, 23, 0.48)` | Active rule, current edge, selected geometry |
| `--copper` | `#97694E` | Non-text editorial mark and leader accent |
| `--copper-text` | `#704A37` | Copper-family text, links, selected annotation |
| `--botanical` | `#263A30` | Deep field, structural emphasis, inverse state |
| `--ethereum` | `#455A96` | Active Ethereum-specific interaction and focus ring |
| `--success` | `#285C46` | Positive return or status text, never the sole indicator |
| `--danger` | `#8A352E` | Negative return or error text, never the sole indicator |

Contrast on `--paper`: `--ink` 14.45:1, `--ink-secondary` 6.04:1, `--ink-faint` 4.66:1, `--copper-text` 6.35:1, `--botanical` 9.99:1, `--ethereum` 5.48:1, `--success` 6.38:1, and `--danger` 6.58:1. Raw `--copper` is only 3.89:1 against the paper, so it is never body text or a thin focus indicator. On `--paper-deep`, use `--ink`, `--ink-secondary`, `--copper-text`, `--botanical`, `--ethereum`, `--success`, or `--danger`; `--ink-faint` is not for small text there.

The page declares `color-scheme: light`. Browser controls, selection, and canvas fallback backgrounds must not inherit a dark scheme.

### Typography

No network font is required. System-capable stacks keep the composition stable offline:

```css
--font-editorial: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
--font-interface: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "SFMono-Regular", "Roboto Mono", Consolas, "Liberation Mono", monospace;
```

| Role | Family | Size / line height | Other rules |
|---|---|---|---|
| Display title | editorial | `clamp(2.25rem, 5vw, 5.25rem)` / `0.92` | weight 400; tracking `-0.035em`; broken across lines only on purpose |
| Readout value | editorial | `clamp(2.5rem, 4vw, 4.75rem)` / `0.95` | tabular numerals |
| Body and editorial note | interface | `0.9375rem` / `1.6` | max `60ch` |
| Control | interface | `0.8125rem` / `1.2` | minimum 44px target; sentence or concise title case |
| Metadata | mono | `0.6875rem` / `1.45` | uppercase labels, tracking `0.08em`; values may retain case |
| Micro label | mono | `0.625rem` / `1.35` | minimum rendered size; never lower than 10px |

`font-variant-numeric: tabular-nums lining-nums` applies to dates, prices, returns, blocks, epochs, and timestamps. Typewriter defects — random rotation, baseline shifts, missing characters, blur — are not imitated. The serif voice carries the poetic premise; the mono voice is reserved for actual machine-readable values.

### Spacing and geometry

A 4px base step:

```text
--space-1  4px      --space-5  20px      --space-9  64px
--space-2  8px      --space-6  24px      --space-10 80px
--space-3  12px     --space-7  32px      --space-11 112px
--space-4  16px     --space-8  48px      --space-12 144px
```

- Page maximum inline size: `1440px`.
- Content gutter: `clamp(20px, 4vw, 64px)`.
- Main specimen diameter: `clamp(360px, min(62vw, 76svh), 760px)` desktop; `min(86vw, 680px)` tablet; `min(92vw, 440px)` mobile.
- Instrument panel: `280–336px` desktop; full width below the specimen at smaller breakpoints.
- Hairline: 1 CSS px; subpixel borders are never the sole state cue.
- Interactive target: minimum `44 × 44px`; knot hit areas may be larger than their drawn marks.
- Corners: `0` for plate rules and panels, `2px` for compact controls. No generic rounded cards.

### Material and texture

The paper is a field, not a photograph. It is built from the flat `--paper` colour plus at most two static CSS gradients at 1–3% opacity: one broad warm/cool drift and one fine deterministic grain. Texture never animates, never crosses text glyphs at high contrast, and is never baked into the canvas data layer. At 200% zoom it recedes rather than resembling compression noise.

Printing irregularity lives only in the specimen strokes: slight deterministic opacity and width variation derived from data geometry or a fixed seed. Knot positions, dates, scales, hit targets, leader endpoints, and text are never jittered.

### Motion

| Token | Value | Use |
|---|---:|---|
| `--duration-fast` | `120ms` | hover and focus colour and rule |
| `--duration-state` | `240ms` | readout content and selection emphasis |
| `--duration-intro` | `650ms` | the one entrance reveal |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | state entry |

Nothing loops except a restrained loading indication. No parallax, breathing specimen, orbiting labels, simulated scan, or cursor-following decoration. Under `prefers-reduced-motion: reduce`, a direct state swap or an opacity change of at most 80ms replaces drawing and reveal motion, and focus placement is preserved.

## Composition

### Shared page frame

The header is a narrow utility rail, not a dashboard masthead: the product name and external links, separated from the plate by a 1px rule.

The explorer has four zones:

1. **Identity** — title and the specimen's truthful identity.
2. **Live metadata** — current state, series, source, cutoff.
3. **Specimen** — the rings, sparse marks, origin, and the selected leader and readout.
4. **Instrument panel** — controls, selection details, milestone notes, methodology and source links.

The compact encoding key is persistent in the ready state and uses the locked wording:

```text
Ring shape — price
Weight — volume
Knots — protocol milestones
```

Key marks reuse the renderer's own vocabulary: an irregular line, a weighted line, and a knot grown by the same geometry that grows the knots on the plate. A generic dot does not stand in for a knot.

### Desktop: 1180px and wider

A 12-column plate with a quiet top band and an 8/4 specimen-to-instrument split.

```text
┌────────────────────────────────────────────────────────────────────┐
│ identity: cols 1–5                 live metadata: cols 9–12       │
│                                                                    │
│      specimen: cols 1–8                 instrument: cols 10–12    │
│      620–760px, centered                 controls + selected data   │
│                                                                    │
│ key: cols 1–8                     source / methodology: 10–12      │
└────────────────────────────────────────────────────────────────────┘
```

- At least 48px between the specimen bounds and the instrument divider.
- The specimen receives at least 60% of usable width and is vertically centred in the first viewport where height permits.
- Identity sits upper-left: a small mono discipline label, then the editorial title. The title is never stacked into a narrow sidebar.
- Live metadata is right-aligned by label and value columns, not justified letter by letter.
- The panel uses one vertical rule; it is not boxed or elevated.
- Controls and selected details can sit beside the specimen, but the key stays aligned with the specimen rather than squeezed into the panel.
- At short desktop heights, vertical gaps shrink before the specimen diameter does; the panel never overlaps or compresses the rings into illegibility.

### Upright and narrow: portrait up to 1023px, or any width under 720px

A sheet narrower than it is tall has no corners to write in, so it is set as one column in reading order. Five rows, no columns:

```text
label       — Specimen, ETH_TREE_01, the byline
reading     — month and year, and the price range
plate       — out to the corner marks, and the height the square comes to
note        — the selected segment's date, name and summary
links       — How to read, All marks, Data & source, Method, in a line
```

- The plate is the biggest thing on the sheet: it runs past the writing margin to the corner marks, and its height follows from its square. Nothing holds it to the height of the screen.
- The sheet is as tall as what is written on it and scrolls when that is taller than the screen. The corner marks sit at the corners of the sheet, not of the screen.
- The blocks stand two items apart, as the entries of a list do; the gaps inside a block are the sheet's two gaps at their desktop stops, not the compact sheet's, because the type is at the desktop's size and the ratio of gap to type is what the eye reads.
- The sheet's dates — origin, first market data, updated — and the two figures under the price range are details the narrow sheet does without.
- The writing is set larger than the compact corners set it, never smaller: a narrow sheet is read at arm's length, and it is a long sheet, not a cramped one. The title and the month grow with the width so each stays one line on the narrowest phone.
- The note's box is still reserved at the worst case, so the links never move when the reading changes.

### Short: under 500px tall

A phone on its side keeps the corners and gives writing up to do so: the two readings, the note's label and two of the four links go, and the plate is held to the height left between the corners.

## Density and annotation

### Persistent

- Genesis label.
- Current year and `STILL GROWING` / `OPEN` state.
- The compact three-item encoding key.
- True data source and cutoff.
- One interaction instruction. Exact day-of-year knot placement does not change the month granularity of the market selector.

### On the specimen, unselected

- Every knot may be visible, but only the current-year label and the genesis label are textual.
- Up to four truthful axis or registration ticks may appear. Month labels may remain if they do not collide at the tested diameter.
- No permanent ring-by-ring year labels around the circumference; year identity belongs in the controls and the committed selection.

### On hover, focus, or selection

- One knot leader and one compact label are revealed at a time.
- A leader label carries the short name and date; the summary and source live in the note.
- A hover preview never reflows the page. A committed selection may update the instrument panel.
- Collision handling drops the leader label into the panel before it moves the true mark.

### Never

- More than one expanded annotation over the specimen.
- A decorative coordinate, sample count, scan status, specimen measurement, Latin species name, terminal error, or checksum not produced by the application.
- A radial starburst of leaders.
- Labels placed by eye when they imply an exact date or value.

## Truthful specimen metadata

Every metadata row is either constant product identity or derived from the loaded payload and the current date:

```text
COMPUTATIONAL DENDROCHRONOLOGY       constant discipline label
Ethereum Annual Rings               constant product title
MARKET SPECIMEN · ETH/USD           series identity

ORIGIN: 2015-07-30                   canonical Ethereum genesis
STATE: GROWING                       derived: the current ring is incomplete
CURRENT_RING: 2026 / OPEN            derived from payload and current date
SERIES: ETH/USD / DAILY              payload cadence and pair
SOURCE: BITSTAMP · VIA CDD           real market plus distribution source
DATA_FROM: 2017-11-09                first accepted candle
DATA_THROUGH: 2026-08-21             payload cutoff, not wall-clock today
UPDATED: 2026-08-21 06:20 UTC        payload build time, with timezone
```

Rules:

- A field is not rendered until its value exists and passes validation.
- `UPDATED` is the moment the payload was built, and `DATA_THROUGH` is the last candle in it. Together they make freshness honest; the specimen is rebuilt daily, not streamed.
- `SOURCE` never says only `BITSTAMP`, because the file is distributed by CryptoDataDownload; `BITSTAMP · VIA CDD` is concise and accurate.
- Methodology exposes the observed UTC day boundary. No local-market timezone is invented.
- The known missing 2026-05-22 candle appears in methodology, or as a real `GAPS: 1` field, only because the count is computed from payload metadata.
- Block, epoch, price, and volume values never look like physical dimensions.

## Component language

### Identity block

- Mono eyebrow: `COMPUTATIONAL DENDROCHRONOLOGY`.
- Editorial H1: `Ethereum Annual Rings`.
- One concise sentence may sit below it.
- The Ethereum diamond is a small identity stamp, not a repeated decorative watermark.

### Specimen canvas

- Transparent canvas over `--paper`; never a dark square or card.
- Primary rings use `--ink`; quiet grain uses ink at reduced alpha, not an imported grey.
- The current bark is a dark, interrupted open edge, plus text; incompleteness never depends on opacity alone.
- Selection uses `--ethereum` plus increased width or outline. Hover uses `--copper-text` or a local leader without replacing the focus treatment.
- Knots are asymmetrical embedded ovals with local grain swelling; see [knot geometry](./event-geometry.md).
- The centre is quiet enough for the origin; no logo, period, and stacked labels on top of one another.

### Instrument controls

- Text buttons with a bottom rule or a small bracketed index; the selected state has text, rule, and `aria-pressed`, not colour alone.
- Hover changes ink and rule in 120ms. Focus uses a 2px `--ethereum` outline with 3px offset.
- Disabled future months keep readable text at 45% opacity and `cursor: not-allowed`; they never disappear.
- A compact year grid or horizontal list that wraps cleanly. Digits are never compressed until labels overlap.

### Selected readout

- Leads with the selected date or year and the market value appropriate to the control, not a decorative "specimen reading."
- Positive and negative return use `--success` and `--danger` plus a `+` or `−` sign and a text label.
- A milestone note begins with `Milestone`, then the name and exact date, a factual summary, the activation reference, confidence, and a source link.
- Source links use underline plus the darker copper text; an external-arrow glyph is supplementary.

### Compact key

- A real mark sample 20–28px wide beside the exact encoding phrase.
- Text is 11px mono or 12px interface, not 8px.
- Visible in the ready state; on mobile it belongs in normal flow, not a floating overlay.

## State matrix

| State | Specimen | Metadata and copy | Controls | Motion |
|---|---|---|---|---|
| Loading | Reserve the final specimen diameter; three non-data concentric guide rings or a simple rule pulse | `LOADING MARKET SPECIMEN…`; no dates, prices, or cutoff until received | Disabled or withheld | One low-contrast indeterminate pulse; no simulated growth |
| Ready | Full specimen and current open edge | Truthful metadata, cutoff, build time | Enabled | Selection transitions only |
| Hover preview | Local mark and grain emphasis; no persistent page reflow | Optional compact visual label; the semantic live region stays silent | Existing committed state retained | 120ms colour and width |
| Committed selection | One selected ring or knot plus leader; all other marks quiet | Note updates and announces once | `aria-pressed` updated | ≤240ms; direct under reduced motion |
| Current year, partial | The outer ring ends at the actual cutoff and the bark stays open | `CURRENT_RING: YYYY / OPEN` and `STILL GROWING`; `DATA_THROUGH` shown | Future months disabled | No looping growth animation |
| Pre-series interval | Empty, quiet chronological core; partial 2017 starts at its true angle | `UNPRICED INTERVAL` with exact dates | No fabricated 2015–2016 market controls | None |
| No milestone on selection | No placeholder knot; the selected grain remains | `No milestone on this date.` The market readout stays intact | Enabled | None |
| Data unavailable | No data-shaped specimen; the plate frame and identity remain | `Market specimen unavailable.` with a `Try again` action; no stale example values | Retry and project links only | None except focus |
| Invalid payload | Same as unavailable | `Market data could not be validated.` | Retry if meaningful | None |

Loading guide rings are explicitly not annual rings: equal circles, no year labels, no price-like contour, and `aria-hidden`. The loading status text carries the meaning. If layout stability can be achieved with an empty reserved field, that beats animation.

Because the payload is a static file built with the site, "unavailable" is a fetch or parse failure on the visitor's side, not a stale cache. The deployed data is always the last build that passed validation.

## Responsive content priority

When space is constrained, reduce in this order:

1. Omit nonessential registration ticks.
2. Move full metadata below the readout while keeping state and cutoff near the top.
3. Replace circumferential month labels with cardinal labels; keep the complete semantic controls.
4. Shorten the on-canvas knot label to name and date and move the summary to the note.
5. Reduce the title size within its token range.
6. Reduce the specimen diameter only after all of the above.

Source and freshness, current and open state, origin, the encoding key, focus indication, and the semantic readout are never removed to save space.

## Do and don't

| Do | Don't |
|---|---|
| Use `ORIGIN: 2015-07-30` and label the pre-series interval. | Draw plausible-looking 2015–2017 price rings. |
| Show `SOURCE: BITSTAMP · VIA CDD` and real cutoff and build values. | Add `SCAN 033`, fake coordinates, invented sample IDs, or decorative checksums. |
| Use one large transverse section with generous paper around it. | Add a trunk, branches, roots, leaves, a bark photograph, or a literal tree silhouette. |
| Let deterministic grain variation make the specimen organic. | Randomly rotate text, knot positions, or leader lines to look handmade. |
| Use exact knot geometry and reveal one label at a time. | Surround every knot with permanent annotations. |
| Use copper sparingly for editorial interpretation and selected leaders. | Apply copper to all headings, all links, or body copy at its low-contrast raw value. |
| Use Ethereum blue for active and focus states that meet contrast. | Flood the specimen with brand gradients or rely on blue alone for state. |
| Keep the compact encoding key persistent. | Repeat the full key in the narrative and hide it after entry. |

## What the page is held to

At 1440×900, 1024×768, 768×1024, 390×844, and 320×568 the specimen is the largest single element and nothing overlaps. There is no horizontal scroll at 320 CSS px and the page stays usable at 200% zoom. The 2015–2017 interval is visibly unpriced, and neither the partial 2017 ring nor the current year is closed or backfilled. Every visible metadata value is either constant or derived from validated data. The three key phrases match the locked wording exactly. Default, hover, focus-visible, selected, disabled, loading, no-milestone, unavailable, and current/open states are distinct without colour alone. Text and interactive indicators meet WCAG AA on both paper tones, and raw copper is not used for small text. Touch targets are at least 44×44px and the specimen has a semantic equivalent outside the canvas. Reduced motion removes drawing and reveal motion while preserving state and focus. Texture stays subordinate at 100% and 200% zoom and under forced colours; nothing essential depends on it. Screenshots contain no literal tree, no random code, no fake terminal output, no invented measurements, and no decorative pseudo-science.
