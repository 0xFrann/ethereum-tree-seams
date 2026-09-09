# Knot geometry

A knot is a protocol milestone embedded in the grain of its year. This note describes how a milestone's date becomes a point on the plate, how the knot is shaped around that point, what happens when two knots in one year would touch, and how a knot is hit-tested. Everything here is implemented in `app/components/eth-rings/event-geometry.ts`, which is a pure module — no React, no `window`, no CSS, no canvas context, no local-time `Date` calls — so `tests/event-geometry.test.mjs` can exercise it in Node with numeric tolerances.

Frontier genesis is the origin at the pith and is not a knot. Every milestone has equal rank, and nothing about a knot's size encodes importance.

## Coordinate system

The canvas is square, `center = size / 2`. Twelve o'clock is the beginning of the year, time runs clockwise within a year, and radial time runs from older rings inward to newer rings outward. Each ring's contour is sampled at 360 radii; knots are placed by continuous interpolation between those samples rather than by nearest-sample lookup.

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
```

All sizes are CSS pixels. Device-pixel ratio affects only the canvas backing resolution; it never alters placement, collision decisions, or hit targets.

The renderer exposes a `YearBandGeometry` for every chronology year from 2015 through the current year, not just the priced ones. The unpriced 2015–2017 interval gets quiet interpolated bands so that Homestead, the DAO fork, and Byzantium can be anchored at their true dates without inventing prices; those bands carry `marketYearIndex: null`. Each band has a `startFraction` and an `activeFraction`: the 2015 band starts at genesis, and the current year's band ends at the data cutoff.

## Date to angle

The canonical ISO date is parsed by hand as UTC. Local-time constructors are never used, and position is never inferred from the month alone.

```text
Y, M, D = integers from YYYY-MM-DD
start   = Date.UTC(Y, 0, 1)
next    = Date.UTC(Y + 1, 0, 1)
day0    = (Date.UTC(Y, M - 1, D) - start) / 86_400_000
days    = (next - start) / 86_400_000            // 365 or 366
f       = (day0 + 0.5) / days                     // centre of the UTC date
θ       = -π/2 + τf
```

Using the centre of the day keeps January 1 off the seam shared with the previous year while remaining an exact, leap-year-aware placement. Malformed and impossible dates (`2022-02-29`, month 13, day 0) throw.

The ring radius at that fraction is a linear interpolation between the two neighbouring samples, wrapping from sample 359 back to sample 0:

```text
p       = f · 360
i0      = floor(p) mod 360
i1      = (i0 + 1) mod 360
r(f)    = lerp(radii[i0], radii[i1], p - floor(p))
```

## Anchoring

`buildEventAnchors` turns each milestone into an `EventAnchor`: its true fraction and angle, the interpolated ring radius, and the point those describe. A milestone is dropped, not drawn, when its date is later than the payload cutoff, or when its fraction falls outside its year band's `[startFraction, activeFraction]` window. That comparison is done on dates and fractions, never on rounded sample indices, so an event one day past the cutoff cannot slip onto the plate.

The anchor keeps both `truePoint` and `point`. They are identical until collision resolution moves the displayed point; the stored date, the year, and every piece of text always come from the true position.

## The knot

`buildKnotGeometry` grows the knot from the anchor and the local year gap `g`:

```text
majorRadius = clamp(0.42g, 7, 12)
minorRadius = clamp(0.25g, 4.5, 7.5)
rotation    = θdisplay + π/2 + hashSigned(id) · 0.20 rad
offset      = hashSigned(id + ":offset") · min(0.055g, 1.25)
centre      = point at (ringRadius + offset, θdisplay)
```

`hashSigned` is a stable FNV-style hash mapped to `[-1, 1]`, so a knot's asymmetry is fixed by its id and identical on every redraw. The long axis runs along the tangent, tilted by up to ±0.2 rad; the small radial offset keeps the knot from sitting dead-centre on the contour, but the anchor itself is never moved. There is no inward offset into the inter-ring void: a knot belongs in the grain of its year.

The outline is eight control points on that ellipse, each pushed in or out by its own share of the seed:

```text
for i in 0..7:
  φ  = i/8 · τ
  k  = 1 + hashSigned(id + ":" + i) · 0.10
  x' = cos φ · majorRadius · k
  y' = sin φ · minorRadius / k
  rotate (x', y') by rotation, translate to centre
```

The renderer runs a smooth closed loop through those eight points rather than joining them with straight segments, because a knot in wood has no corners. The key beside "Knots — protocol milestones" is drawn by the same function, so the mark in the legend is built the way the marks on the plate are.

### Grain swelling

The host ring and its neighbours swell locally around the knot. For a contour point at angle `θ` and radius `r`, with `δ` the shortest signed angle to the knot's display angle:

```text
aperture     = clamp(10 / ringRadius, 0.025, 0.065) rad
q            = |δ| / aperture                      (only when |δ| < aperture)
envelope     = (1 − q²)²
radialShift  = 0.25 · majorRadius · envelope · (1 + 0.22 · δ / aperture)
```

The shift applies only to contour points within `2 · majorRadius` radially of the knot's ring, so a knot bulges its own grain and the filament or two beside it without reaching older or newer years. The `0.22 · δ / aperture` term is a small, deterministic lean so the swelling is not perfectly symmetrical.

### Drawing

Knots are drawn in ink at the same weight as the primary grain. During the entrance animation each knot emerges as the growth front reaches its ring: it begins swelling once the front is `0.6g` past the knot's mean radius, reaches full size `1.9g` later, and is never drawn smaller than a quarter of its final scale. A selected month restores the knots inside it to full ink contrast; the selected month's accent remains the only coloured element on the plate, and a knot never gets a separate accent, halo, or fill of its own.

## Collision resolution

`resolveEventCollisions` runs once per layout, after true anchors are known, and changes only the display angle. Milestones are sorted by `(date, id)` and placed in that order. For each one, candidate offsets from the true angle are tried in this exact sequence:

```text
0, +δ, −δ, +2δ, −2δ, +3δ, −3δ
δ = clamp(4 / ringRadius, 1°, 2°)
maximum absolute offset: 6°
```

A candidate clears when its centre is at least `2 × (14 + halo) + 3` px from every already-placed knot in the same year, where 14 px is a knot's visual radius and `halo` is the 3 px selection allowance. Knots in other years are not considered. If no candidate clears, the one with the least total overlap is kept; records are never hidden or merged.

A displaced knot gets a hairline leader from its true anchor to its displayed centre, drawn at reduced alpha; an undisplaced knot has no leader. Because layout uses the maximum unselected envelope plus the fixed halo allowance, hovering or selecting a knot never changes where anything sits. The result is also independent of input order, since the sort is canonical.

The eleven shipped milestones fall in different years except for Homestead and the DAO fork in 2016, and those are four months apart, so at every tested size every knot sits at its true angle with no leader. The mechanism exists so that adding a milestone later cannot silently overlap an existing one.

## Hit regions

Visual marks are small; interaction geometry is separate. `buildEventHitRegions` gives each knot a region made of its outline polygon, a centreline from the true anchor to the knot centre (the leader, when there is one), and a padding radius:

```text
fine pointer:    14 px
coarse pointer:  22 px
```

The renderer builds both sets and picks one at event time from the pointer type, so a touch reaches a 44 px effective diameter without any change to the drawn knot. Each region also carries a bounding box padded by that radius, which is checked first.

`hitTestEvents` finds every region whose polygon contains the point or whose centreline is within the padding radius, then sorts the hits by:

1. inside the visible outline (true before false);
2. distance to the centreline as a fraction of the padding radius (ascending);
3. distance to the true anchor (ascending);
4. date (ascending);
5. id (ascending).

That keeps a click on a knot's actual outline from being stolen by a neighbour's padding. Because the centreline includes the leader, clicking the true anchor of a displaced knot still selects it.

Pointer dispatch runs knot hit-testing before month hit-testing, so a knot on the boundary of a month still wins; a point outside every knot region falls through to the ring and month layer unchanged. Selecting a knot synchronises the market selection to the knot's true calendar month, and a knot in the unpriced interval is selectable without manufacturing a market reading.

## Semantics off the canvas

Canvas pixels are not the only representation. The canvas is not a tab stop and shows no focus ring; the arrow keys, read from the document, move the reading by month and year, and a selected knot's note — `Milestone`, name, exact date, summary, activation reference, confidence, source link — lives in reflowing HTML beside the plate. The polite live region announces a committed selection once, naming the milestone when the selected month contains one. Every mark has one visible DOM equivalent with a 44 px target.

## Mobile and zoom

Geometry is recomputed from the CSS canvas size; desktop paths are never bitmap-scaled. Below 420 CSS px the same exact angles apply, knot radii bottom out at their clamps, on-canvas text is omitted, and the coarse hit regions and the DOM note carry the interaction. At 200% zoom in a 1280×720 viewport the page takes the mobile composition, targets stay 44 CSS px, and the note reflows rather than the canvas cropping. Reduced motion needs no geometry change because layout is deterministic and static; the entrance renders its final state in one frame.

## Exported API

```ts
export function parseIsoDateUtc(date: string): {
  year: number; dayIndex: number; daysInYear: 365 | 366; fraction: number;
};
export function dateToAngle(date: string): number;
export function interpolateRingAtFraction(radii: readonly number[], fraction: number): number;
export function knotOutline(seed: string, center: Point, majorRadius: number, minorRadius: number, rotation: number): Point[];
export function buildEventAnchors(events, yearBands, { center, size, gap, lastDate }): readonly EventAnchor[];
export function resolveEventCollisions(anchors, { pointer, selectionHaloPx }): readonly EventAnchor[];
export function buildKnotGeometry(event: Milestone, anchor: EventAnchor, localGap: number): KnotGeometry;
export function buildEventHitRegions(knots, pointer: "fine" | "coarse"): readonly EventHitRegion[];
export function hitTestEvents(regions, point: Point): EventSelection;
export function nextEventId(events, currentId: string | null, direction: -1 | 1 | "first" | "last"): string | null;
```

Every function returns plain readonly numbers and points rather than `Path2D`, so the tests can inspect them without a browser; the renderer converts paths to canvas calls at draw time.
