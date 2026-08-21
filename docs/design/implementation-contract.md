# Gate 2 — integrated implementation contract

Accepted **2026-08-21** after reconciling `specimen-system.md`, `event-geometry.md`, and `narrative-flow.md`.

## One reading path

The usable page is a warm archival specimen plate with a narrow utility rail, identity and truthful live metadata at the edges, one dominant annual-ring canvas, a persistent four-item encoding key, and a restrained instrument panel. Desktop uses an 8/4 specimen-to-panel split; tablet centers the specimen and places controls/readout below; mobile is one column with no overlay panel.

The first-session introduction is the same full-viewport modal used by **Read introduction**. Once real market data is ready, the actual specimen may remain faintly visible behind it; before data is ready there is only reserved paper space and truthful status text. There are no decorative loading rings.

## Tokens and motion

Use the visual-system paper/ink palette, `--copper-text` for editorial selection, and `--ethereum` for focus/active interaction. Raw copper is not small text. The release uses a compact `180–240ms` opacity transition for the introduction and `<= 50ms` with reduced motion; the longer 650ms exploratory token is rejected. No transform, growth replay, typewriter effect, or looping ornament is used.

## Chronology and market geometry

The center is `ORIGIN · 2015-07-30`. A quiet, explicitly labelled **unpriced interval** occupies 2015-07-30 through 2017-11-08. It is not a price contour and is not selectable as a market year. Neutral chronology bands may host exact-date 2016 protocol/security marks without implying market observations.

The first priced contour is a partial 2017 ring beginning at its true 2017-11-09 day-of-year angle. Every subsequent year is a market ring. The outer/current ring ends at the actual cutoff and is labelled `OPEN · STILL GROWING`.

## Events

Milestones and scars use the canonical records from Gate 1. Exact UTC day centers determine their true angle. Collision layout may offset a display mark by at most 6 degrees with a truthful leader; canonical date/text never changes.

Knots are equal-rank asymmetric forms centered on the host grain, with bounded deterministic swelling. Scars begin at the incident band and extend only outward. Fixed gross-USD logarithmic magnitude controls reach strongly and width modestly; `healed`, `closed`, and `open` remain distinct without relying on color. Event hit testing precedes month hit testing.

The optional canvas `E` shortcut is omitted. The visible chronological DOM event index is the discoverable keyboard/touch surface, using roving arrow navigation and 44px targets. Canvas arrow keys retain month/year navigation.

## Narrative and focus

Use the 46-word copy in `narrative-flow.md`. A deterministic `checking-session` client shell avoids hydration mismatch. The versioned marker is stored only in `sessionStorage`; storage failure falls back to memory. The explorer remains mounted so reopening cannot reset selection or refetch.

The modal is labelled, traps focus, makes the background inert, supports Escape and explicit close, and restores focus. First entry focuses the current explorer target; reopened close restores the persistent **Read introduction** button. Reduced motion never gates focus or state on an animation callback.

## Persistent legend and language

Use the TODO-locked visible phrases exactly:

- `Ring shape — price`
- `Weight — volume`
- `Knots — milestones`
- `Scar size — hack magnitude`

The event index and inspector add the necessary precision: knots are protocol milestones; scar magnitude is contemporaneous reported gross incident value; no accepted scar compromised Ethereum consensus or execution.

The instruction is `Trace the grain · Hover or tap to read a month.` The latest partial year is labelled `Still growing`.

## Truthful states

Metadata derives from the cached payload: source market/distributor, data start/cutoff, cache update time, gap count, schema version, and current/open state. A failed refresh leaves the last-good specimen visible with honest freshness. Empty cache returns and renders a clear 503 state. No-event state retains market exploration and explains that no event chronology is available.

## Implementation ownership boundary

- Orchestrator: shared TypeScript model, page composition, market/event selection state, CSS integration, metadata/copy, and cross-module review.
- Renderer owner: pure event geometry, canvas rendering/hit testing, and geometry tests.
- Narrative owner: entrance/reopen components and focused behavior tests/styles confined to its modules.
- Dataset owner: canonical shipped milestone/scar data, validation, source retention, and data tests.
- Cache owner: Worker schedule, one-object R2 adapter, visitor API interception, refresh validation, configuration, and failure tests.

No owner may refactor outside its file family without orchestrator coordination.
