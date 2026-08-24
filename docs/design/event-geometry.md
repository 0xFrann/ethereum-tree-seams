# Event geometry contract

Status: Wave 2 specification, based on the accepted research gate dated 2026-08-21.

This contract adds two event vocabularies to the existing radial canvas without changing what the rings mean:

- a **knot** is a protocol milestone embedded in the grain of its year;
- a **scar** is an ecosystem security incident whose point begins on its incident year and whose wound extends only into newer growth;
- the broad month treatment remains a **selection**, not an event mark.

The DAO exploit scar and DAO fork knot are separate records, positions, controls, and readouts even though their histories are related. Frontier genesis remains the origin marker and is not rendered as a knot. No accepted scar represents a compromise of Ethereum consensus or execution.

## 1. Coordinate system and current-renderer fit

The current renderer uses a square canvas, `center = size / 2`, twelve o'clock as the beginning of the year, clockwise time, and 360 sampled radii per ring. Keep those conventions. Replace event-specific integer sample lookup with continuous interpolation; the underlying price/grain contours may remain sampled at 360 points.

```text
                         Jan 1 / θ = -π/2
                                  ↑
                     older        │        newer
                  growth inward   │   growth outward
                            ┌──────●──────┐
                         Oct│      │      │Apr
                            └──────┼──────┘
                                  ↓
                                 Jul

Clockwise time within a year. Radial time moves from older rings to newer rings.
```

`Geometry.rings[]` currently contains only priced market years. Integration must provide an addressable `YearBandGeometry` for every chronology year from 2015 through the current year, including the unpriced 2015-07-30–2017-11-08 interval. An unpriced year band may be a quiet archival/grain guide, but event geometry must not invent prices for it. This is why event APIs accept year bands rather than assuming `data.years[yearIndex]` is a complete market ring.

Suggested geometry type:

```ts
type Point = Readonly<{ x: number; y: number }>;

type YearBandGeometry = Readonly<{
  year: number;
  radii: readonly number[];       // existing 360-sample contour
  widths: readonly number[];
  activeFraction: number;         // 0..1, derived from lastDate for current year
  innerBoundary: readonly number[];
  outerBoundary: readonly number[];
}>;

type EventAnchor = Readonly<{
  eventId: string;
  year: number;
  trueFraction: number;
  trueAngle: number;
  displayAngle: number;
  ringRadius: number;
  point: Point;
  leader: readonly Point[] | null;
}>;
```

All sizes in this document are CSS pixels. Device-pixel ratio affects canvas backing resolution only; it must not alter layout, collision decisions, or hit targets.

## 2. Exact date placement

Parse the canonical ISO date manually as UTC. Do not use local-time constructors and do not infer position from `month`.

```text
Y, M, D = integers from YYYY-MM-DD
start   = Date.UTC(Y, 0, 1)
next    = Date.UTC(Y + 1, 0, 1)
day0    = (Date.UTC(Y, M - 1, D) - start) / 86_400_000
days    = (next - start) / 86_400_000            // 365 or 366
f       = (day0 + 0.5) / days                     // center of the UTC date
θtrue   = -π/2 + τf
```

Using the center of the UTC day avoids placing January 1 exactly on the seam shared with the preceding year. `f` is still an exact, leap-year-aware day-of-year placement; the source date remains unchanged in data and text.

For a ring sampled into `N = 360` radii:

```text
p       = fN
i0      = floor(p) mod N
i1      = (i0 + 1) mod N
t       = p - floor(p)
r(f)    = lerp(radii[i0], radii[i1], t)
```

For an incomplete current ring, an event is drawable only when its date is not later than the canonical `lastDate`. Do not compare `round(f * 360)` with `activeSamples`: rounding near the cutoff can expose a future event. Historical events in the explicitly unpriced interval remain drawable on chronology bands, but those bands must not imply market observations.

Validation rules:

1. reject malformed or impossible ISO dates;
2. require the date year to equal the addressed year band;
3. require `0 < f < 1`;
4. use the canonical event date for accessible text even when collision layout changes `displayAngle`;
5. never mutate the stored date or derive a replacement month.

## 3. Protocol knots

### 3.1 Silhouette

A knot is centered on the exact interpolated ring path. The current renderer offsets event ellipses inward by `gap * 0.42`; remove that behavior. A knot belongs in the year grain, not in the inter-ring void.

At canonical sizes, derive dimensions from local year gap `g`:

```text
majorRadius = clamp(0.20g, 3.5, 7.0)
minorRadius = clamp(0.105g, 2.0, 4.2)
rotation    = θdisplay + π/2 + hashSigned(eventId) * 0.20 rad
offset      = normal(θdisplay) * hashSigned(eventId + ":offset") * min(0.055g, 1.25)
```

`hashSigned` is a stable pure hash mapped to `[-1, 1]`; it creates restrained asymmetry without random redraws. The long axis follows the tangent, with the stable perturbation preventing a clean UI-pill appearance. The event's logical anchor remains the unshifted ring point.

Use a hand-built six- or eight-point closed Bézier/point path rather than `ellipse()` if the renderer can do so without excess complexity. Apply fixed per-ID multipliers in the range `0.88..1.12` to alternating control radii. Do not encode importance with knot size: every accepted protocol milestone has equal semantic rank.

### 3.2 Embedded grain deformation

Locally swell the host ring and at most the two adjacent grain filaments. Let `δ` be the shortest signed angle from the knot display angle and `a = clamp(10 / r, 0.025, 0.065)` radians:

```text
q             = clamp(abs(δ) / a, 0, 1)
envelope(q)   = (1 - q²)²
radialShift   = 0.075g * envelope(q) * (1 + 0.22 * δ/a)
```

Apply full shift to the host contour, 45% to its immediately inner grain, and 65% to its immediately outer grain. The asymmetric factor is deterministic and small. Do not deform older/newer year boundaries far enough to invert their radial order; clamp every result to at least `0.045g` from a neighboring contour, matching the renderer's existing grain constraint.

```text
inner growth ───────╮  ╭──────── outer growth direction
host ring  ─────────(●)─────────  knot centered in the grain
adjacent    ───────╯  ╰─────────  local swelling, not a badge
```

### 3.3 Selected knot

The base knot remains near-black/ink. Selection adds a 1.5 px oxidized-copper perimeter and a 2 px clear halo outside the silhouette; it does not replace the fill with the month-selection color. A selected knot may draw a short leader to the exact anchor if collision-offset. No text is drawn on the canvas.

## 4. Security scars

### 4.1 Meaning and direction

The exact event point is the scar apex on the incident-year ring. Every wound point must satisfy `r >= anchorRadius - epsilon`; no scar geometry may enter older growth. Newer contours flow around or bridge the wound according to `healingState`.

```text
older growth                     newer growth / bark
     │                                  │
─────●╲                                 │   open
───────╲_________                       ├───┐
────────╲________╲______________________│   │

─────●╲        ╱────────────────────────│   healed/closed
───────╲______/─────────────────────────│
```

The scar is a dark/erased fissure with irregular edges, not a clean filled sector. The month selection is a broad, low-opacity 30-degree radial wash; a scar is narrow, opaque, tapered, and anchored to an exact day.

### 4.2 Accepted magnitude mapping

Do not re-normalize from the visible subset. Use the stored score or recompute it only from the accepted fixed formula:

```text
score = round(100 * log10(clamp(usd, 1M, 1.5B) / 1M)
                  / log10(1.5B / 1M))
s     = score / 100
```

At the anchor, let `g` be local year gap, `rA` the anchor radius, and `rB(θ)` the bark radius. Define maximum half-width in CSS pixels and potential radial reach:

```text
wMax       = clamp(g * (0.12 + 0.30s), 2.25, 8.0)
reachBands = 0.70 + 2.60s
rPotential = rA + g * reachBands
rBeforeBark = rB(θdisplay) - max(0.22g, 3)
```

Magnitude controls reach strongly and width modestly. It must not control opacity, color, hit-target size, or z-order.

Healing determines the actual end radius:

```text
healed: rEnd = min(rPotential, rBeforeBark)
closed: rEnd = min(rA + 1.18 * (rPotential - rA), rBeforeBark)
open:   rEnd = rB(θdisplay) + min(0.10g, 2)
```

If fewer pixels of newer growth exist than the formula requests, clamp at bark; never compensate by extending inward or increasing width. An event whose anchor is within 3 px of the bark and is `healed` or `closed` gets a minimum visible outward reach of 3 px plus its tapered seam, clipped inside the bark.

### 4.3 Taper profiles

Let `t = (r - rA) / (rEnd - rA)` and `jL`, `jR` be deterministic, low-frequency edge perturbations from the event ID, bounded to `±0.10wMax`. The half-width profiles are:

```text
healed: w(t) = wMax * sin(πt)^0.72
closed: w(t) = wMax * sin(πt)^0.58 * (0.92 - 0.16t)
open:   w(t) = wMax * sin(π * min(t, 0.68) / 1.36)^0.72
                  for t < 0.68
        w(t) = lerp(previous, 0.52wMax, (t - 0.68) / 0.32)
                  for t >= 0.68
```

Both `healed` and `closed` close before bark. `healed` receives two or three low-opacity bridging grain strokes across the final 35% of the wound, expressing material restoration. `closed` retains one charcoal center seam after the sides meet, expressing a historical loss or lock that no longer reads as actively opening. `open` reaches bark with a visible mouth at least `max(2, 0.9wMax)` wide. These treatments are redundant with color.

Build left and right edges from polar points at `r` and angular offsets `±(w(t) + j(t)) / max(r, 1)`. Sample at least 12 radial positions and at most 32; `ceil((rEnd-rA)/3)` clamped to that range is sufficient. Use the same stable hash at every redraw. The apex is one shared point, not a flat cut through the incident ring.

### 4.4 Grain response

Only contours whose local radius is newer than the anchor may deform. For a contour point `(r, θ)` inside the scar's radial span:

```text
δ       = shortestSignedAngle(θ, θdisplay)
h       = (w(t) + clearance) / r
inside  = abs(δ) < 1.55h
push    = signNonZero(δ, eventId) * (1.55h - abs(δ)) * smoothstep(0, .22, t)
θ'      = θ + push
```

`signNonZero` uses the event hash only at exactly zero so points never oscillate sides. Subsequent grain therefore bends around the wound. For `healed`, grain may bridge across after `t >= 0.65` using the original angle with reduced alpha; for `closed`, bridge only after `t >= 0.82`; for `open`, never bridge across the bark mouth.

When several scar fields affect one point, sum angular pushes and clamp the absolute displacement to `min(0.035 rad, 0.55g/r)`. This prevents a radial starburst and preserves year ordering.

### 4.5 Selected scar

Keep the charcoal/erased interior. Selection adds:

- a 1.5 px copper trace on the two wound edges;
- a 3 px copper apex dot with a paper-colored 2 px halo;
- a leader only when `displayAngle !== trueAngle`.

Do not fill the scar with the selection accent and do not expand it to the month boundaries.

## 5. Deterministic collisions

Collision layout operates within an event year after true anchors are known. It changes only `displayAngle`; `trueAngle`, date, year band, source, accessible name, and month selection remain canonical.

### 5.1 Ordering and candidates

Sort events by `(date ascending, typeOrder, id ascending)`, where `scar` precedes `knot` only as a stable tie-break for same-date records. Place in that order. Candidate angular offsets are tested in this exact sequence:

```text
0, +δ, -δ, +2δ, -2δ, +3δ, -3δ
δ = clamp(4 / anchorRadius, 0.01745, 0.03491) // 1°..2°
maximum absolute offset = 6°
```

Choose the first candidate for which visual envelopes have at least 3 CSS px separation and hit centers have at least 6 CSS px separation after overlap-aware hit-target reduction described below. Do not reorder events around the ring and do not cross a month boundary unless no same-month solution exists. If all candidates fail, retain the smallest-overlap candidate and assign a deterministic radial interaction lane; never hide or merge records.

A displaced mark draws a hairline leader from the exact anchor to the display apex. The leader is ink at 55% opacity, at least 1 CSS px, and no longer than the 6° limit. A no-offset event has no leader.

### 5.2 The 2022 case

Process the accepted records in this order:

1. Wormhole — 2022-02-02;
2. Ronin — 2022-03-23;
3. Nomad — 2022-08-01.

At a 720 px canvas their exact marks should normally fit with `[0°, 0°, 0°]`; retain exact angles. At smaller/zoomed layouts, run the same candidate sequence rather than hard-coding names. If the Wormhole and Ronin interactive envelopes overlap, Wormhole retains `0°` because it sorts first and Ronin takes the first valid positive offset, normally `+1°..+2°`; Nomad remains `0°` unless its independently computed envelope collides. A fixture test must assert these results at the chosen canonical desktop and 320 px geometries. This makes the difficult year reproducible without baking editorial IDs into production logic.

Collision decisions must not change merely because an item becomes selected or hovered. Use maximum unselected visual envelopes plus fixed selection-halo allowance during layout.

## 6. Hit areas and interaction priority

Visual marks may be small; interaction geometry is separate.

```ts
type EventHitRegion = Readonly<{
  eventId: string;
  kind: "knot" | "scar";
  centerline: readonly Point[];
  radiusCssPx: number;
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;
```

- Fine pointer: minimum effective diameter 28 CSS px.
- Coarse pointer/touch: minimum effective diameter 44 CSS px.
- Semantic event controls outside the canvas: minimum 44 by 44 CSS px on all layouts.
- Knot region: distance to knot silhouette/anchor, expanded to the required diameter.
- Scar region: distance to the wound centerline or inside its polygon, expanded by enough padding to meet the required diameter.

When expanded regions overlap, do not let one event steal the whole region. Resolve a point by this stable tuple:

```text
1. point is inside visible path (true before false)
2. normalized distance to visible path (ascending)
3. distance to exact anchor (ascending)
4. date (ascending)
5. id (ascending)
```

Pointer dispatch order is:

1. `hitTestEvents`;
2. if no event, existing ring/month `hitTest`;
3. if neither, no action.

Hover updates visual/readout preview silently for assistive technology. Pointer down/click commits event selection, synchronizes the market selection to the event's true calendar month when that month has market data, and announces the event. A pre-series event can be selected without manufacturing a market month readout; show an “unpriced chronology interval” market state instead.

## 7. Keyboard and semantic contract

Canvas pixels are not the sole accessible representation. Render a DOM event index adjacent to the explorer/readout, in chronological order, with one button or link per event. Its accessible name begins with the type:

```text
“Milestone: The Merge, 15 September 2022”
“Scar: Bybit exchange custody compromise, 21 February 2025”
```

The event index uses roving focus:

- `ArrowRight` / `ArrowDown`: next event chronologically;
- `ArrowLeft` / `ArrowUp`: previous event;
- `Home` / `End`: first / last event;
- `Enter` or `Space`: commit selection and populate full readout;
- focus itself may preview but must not cause an `aria-live` announcement until selection is committed.

Do not overload the existing focused canvas arrow keys: they remain month/year navigation. Add a documented shortcut from the canvas, `E`, to focus the currently selected month's first event, or the next chronological event when the month contains none. `Shift+E` moves to the previous event. If this shortcut is judged too discoverability-heavy during integration, the event index in normal tab order remains mandatory and sufficient.

On committed event selection, the readout announces exactly once and includes event type, canonical date, name, affected layer/category, uncapped reported impact or milestone summary, healing/recovery caveat for scars, confidence, and source link. It must say that accepted scars did not compromise Ethereum itself where confusion is plausible, especially Bybit, Wormhole, Ronin, and KelpDAO.

The selected visual mark uses `aria-current="true"` or `aria-pressed="true"` on its DOM equivalent. Do not put each canvas event into an invisible absolute-positioned tab stop; zoom/reflow and collision offsets make that brittle.

## 8. Visual separation from month selection

| Property | Month selection | Knot | Scar |
|---|---|---|---|
| Angular span | Full calendar month, about 28°–31° | Local oval, typically under 3° | Narrow wound derived from px width, never month-wide |
| Radial span | Broad wash from inner ring toward bark | Host ring plus local grain swelling | Incident ring outward only |
| Base tone | Low-opacity interaction accent | Solid ink | Charcoal void/erasure |
| Selected treatment | Existing ring stroke and month label | Copper perimeter + halo | Copper edges + apex dot |
| Meaning without color | Broad sector | Compact asymmetric closed form | Tapered/open fissure |

Render order:

1. paper/background;
2. base grain and year contours;
3. scar-driven grain deformation and erased wound interiors;
4. knot fills;
5. bark/index;
6. month selection wash and selected ring emphasis at low alpha;
7. selected event edge/halo and collision leaders;
8. month labels.

The selection wash may pass behind an event, but event ink and silhouette remain unchanged. This guarantees that a scar cannot become a selected-month wedge.

## 9. Mobile and 200% zoom

Geometry is recomputed from CSS canvas size; never bitmap-scale desktop event paths.

At canvas widths below 420 CSS px:

- use the same exact angles and magnitude score;
- clamp knot visual radii to at least `3.25 × 2` px and scar `wMax` to at least 2.25 px;
- reduce knot grain deformation to 75% if adjacent year gaps would invert;
- keep scar reach semantics, clipping at bark rather than widening;
- omit all on-canvas event text and nonessential leaders; collision leaders remain when needed;
- use 44 px coarse hit regions and the full DOM event index;
- allow the canvas to shrink to the container, but keep DOM controls and readout in a single column with no horizontal scrolling.

At 200% browser zoom in a 1280 × 720 CSS viewport, assume the responsive/mobile composition. CSS-pixel targets remain 44 px; backing-store DPR does not double them. The full event name, date, source, and caveat live in reflowing HTML, not canvas labels. Canvas crop, horizontal document scroll, overlapping event-index controls, or reliance on hover are failures.

If a canvas becomes narrower than 280 CSS px, keep the visual as an overview and make the DOM event index the primary selection surface. Do not enlarge scars beyond the accepted magnitude formula simply to meet touch size.

Reduced motion requires no geometry change because layout is deterministic and static. If selection transitions are later animated, reduced motion renders the final state in one frame.

## 10. Pure exported geometry API

Move calculations into a side-effect-free module such as `event-geometry.ts`. It must not import React, access `window`, read CSS, mutate input arrays, create a canvas context, or call `Date` in local time. Drawing functions consume its output.

```ts
export function parseIsoDateUtc(date: string): {
  year: number; dayIndex: number; daysInYear: 365 | 366; fraction: number;
};

export function dateToAngle(date: string): number;

export function interpolateRingAtFraction(
  radii: readonly number[], fraction: number,
): number;

export function normalizeScarMagnitude(grossUsdAtIncident: number): number;

export function buildEventAnchors(
  events: readonly CanonicalEvent[],
  yearBands: readonly YearBandGeometry[],
  options: Readonly<{ center: number; size: number; gap: number; lastDate: string }>,
): readonly EventAnchor[];

export function resolveEventCollisions(
  anchors: readonly EventAnchor[],
  metrics: Readonly<{ pointer: "fine" | "coarse"; selectionHaloPx: number }>,
): readonly EventAnchor[];

export function buildKnotGeometry(
  event: Milestone, anchor: EventAnchor, localGap: number,
): KnotGeometry;

export function buildScarGeometry(
  event: Scar, anchor: EventAnchor,
  context: Readonly<{ localGap: number; barkRadii: readonly number[] }>,
): ScarGeometry;

export function deformGrainPoint(
  point: PolarPoint,
  scars: readonly ScarGeometry[],
  knots: readonly KnotGeometry[],
): PolarPoint;

export function buildEventHitRegions(
  knots: readonly KnotGeometry[],
  scars: readonly ScarGeometry[],
  pointer: "fine" | "coarse",
): readonly EventHitRegion[];

export function hitTestEvents(
  regions: readonly EventHitRegion[], point: Point,
): string | null;

export function nextEventId(
  events: readonly CanonicalEvent[], currentId: string | null,
  direction: -1 | 1 | "first" | "last",
): string | null;
```

Return readonly numeric paths and metadata, not `Path2D`, so Node tests can inspect them without a browser. A thin canvas adapter may convert paths to `Path2D` during drawing.

## 11. Required tests

Use numeric tolerances rather than snapshots for pure geometry. Canvas screenshot tests supplement, not replace, these cases.

### Date and interpolation

1. `2019-01-01` returns `dayIndex=0`, `daysInYear=365`, `fraction=0.5/365`.
2. `2020-02-29` returns `dayIndex=59`, `daysInYear=366`, `fraction=59.5/366`.
3. `2021-12-31` returns `fraction=364.5/365`; its angle remains before the January seam.
4. Same ISO date produces identical angle under at least two process time zones.
5. `2022-02-29`, malformed strings, and year-zero/overflow dates throw.
6. Interpolation over radii `[0..359]` at `f=10.25/360` returns `10.25`; wrap interpolation near one uses samples 359 and 0.
7. An event one day after `lastDate` is absent even if both dates round to the same 360 sample.
8. Homestead and the DAO records resolve on neutral chronology bands despite lacking price observations; no market values are synthesized.

### Knot geometry

9. A knot center is within 0.01 px of the interpolated host ring before deterministic asymmetry offset and is never shifted by the old `-0.42g` rule.
10. Repeated construction with the same ID is byte-for-byte equal.
11. Two different IDs produce bounded asymmetry but dimensions remain within contract clamps.
12. Knot deformation affects only the host and two adjacent grain filaments and cannot invert radial ordering.
13. The DAO fork knot and DAO exploit scar return distinct IDs, hit regions, and semantic labels.

### Scar magnitude and shape

14. `$1M → 0`, `$1.5B → 100`, values below/above clamp to those endpoints, and every accepted stored score matches recomputation.
15. For equal geometry, larger score never produces shorter `rPotential` or smaller `wMax`.
16. Every healed, closed, and open polygon point has `r >= rA - 0.01`.
17. Healed and closed profiles have one shared apex and converge before bark; open has a bark mouth at least the required width.
18. Healed includes bridge strokes only after `t=0.65`; closed only after `t=0.82`; open has none.
19. With the anchor near bark, reach clips outward and never grows inward or widens as compensation.
20. KelpDAO uses score 78 and Bybit score 100, but neither exceeds the 8 px maximum half-width.
21. A 0-score scar remains visible at the minimum reach/width.
22. Grain deformation returns points older than the anchor unchanged and caps combined angular push.

### Collision behavior

23. Input permutation does not change resolved anchors because internal sorting is canonical.
24. Events with non-overlapping envelopes retain `displayAngle === trueAngle` and no leader.
25. Two same-day synthetic events receive deterministic opposite/next offsets, remain within 6°, and keep canonical dates.
26. A collision near a month boundary first chooses a same-month solution; if impossible, the date/text still retain the original month.
27. At canonical 720 px geometry, 2022 Wormhole, Ronin, and Nomad retain the expected zero offsets if envelopes clear.
28. At 320 px/coarse geometry, assert the actual deterministic vector; if Wormhole/Ronin overlap, Wormhole is zero and Ronin takes the first positive valid candidate while Nomad remains independently resolved.
29. Selection/hover does not change any event's resolved display angle.

### Hit testing and semantics

30. Fine and coarse hit regions meet 28 px and 44 px minimum effective diameters without enlarging visual paths.
31. A point inside both an expanded knot region and a visible scar polygon chooses the visible-path hit according to the priority tuple.
32. Event hit testing runs before month/ring hit testing; clicking a scar apex selects the scar, not merely its month.
33. Points outside all event regions fall through unchanged to existing month selection.
34. An exact-anchor click still selects a collision-offset event through its leader/combined region.
35. Keyboard navigation is chronological, wraps only if the UI explicitly documents wrapping, and `Home`/`End` are stable.
36. Hover preview does not toggle the live region; Enter/Space produces one announcement.
37. Every canvas event has one visible/focusable DOM equivalent with type, canonical date, source, and 44 px target.

### Responsive and visual regression

38. At 720, 420, 320, and 280 CSS px, all coordinates are finite, paths stay within the canvas plus the allowed 2 px open-scar bark extension, and year contours remain ordered.
39. At DPR 1 and DPR 2 with identical CSS size, pure geometry outputs are equal.
40. At simulated 200% zoom, the page has no horizontal scroll and the event index/readout do not overlap the canvas or each other.
41. Screenshot comparison shows the month wash behind unchanged knot/scar ink; selected events use perimeter/edge treatments, not filled wedges.
42. With no events, geometry returns empty arrays and existing ring/month exploration remains operational.

## 12. Integration decisions and unresolved issues

Decisions fixed by this specification:

- exact dates use UTC day centers and continuous ring interpolation;
- knots are equal-rank, asymmetric, embedded host-ring forms;
- scars always begin at the incident ring and extend only outward;
- magnitude uses the research gate's fixed gross-USD logarithmic scale;
- `healed`, `closed`, and `open` have distinct closure and grain behavior;
- collision layout is stable, bounded, and preserves canonical dates;
- events win pointer hit testing over the month layer and have DOM semantic equivalents;
- mobile and zoom increase hit regions, not the encoded visual magnitude;
- geometry remains pure and independently testable.

Unresolved for the orchestrator/design gate:

1. The visual-system specification must choose exact ink/copper/charcoal tokens and verify contrast; this contract defines roles, not final colors.
2. The integration model must define how neutral 2015–2017 chronology bands coexist with the first partial priced ring without implying missing prices are zero.
3. The optional `E`/`Shift+E` canvas shortcut may be omitted if normal tab order to the mandatory event index is clearer in usability testing.
4. After canonical year-band dimensions exist, lock the 320 px 2022 collision fixture to concrete degree offsets rather than a conditional expected result.
