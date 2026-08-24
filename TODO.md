# Ethereum Annual Rings — Visual Completion TODO

## Agreed visual language

- **Rings** represent market years.
- **Ring shape** represents ETH/USD price.
- **Weight** represents trading volume.
- **Knots** represent Ethereum milestones, upgrades, and forks.
- **Scars** represent hacks, exploits, crashes, and other destructive shocks.
- **The outer edge** represents the unfinished present.

## Locked decisions

- **Scar magnitude:** visual scar size encodes the reported magnitude of the hack or exploit.
- **Milestone scope:** knots are reserved for Ethereum protocol milestones.
- **Fork treatment:** forks do not split the ring; they use the same restrained knot vocabulary.
- **Narrative frequency:** show the entrance once per browser session.
- **Narrative format:** the entrance is a full-screen composition containing a very short introduction.
- **Return path:** a small persistent info button reopens the narrative.
- **Legend:** the compact data-encoding key remains visible in the visualization.
- **Price wording:** use “Ring shape,” not “Contour.”
- **Timeline goal:** begin with Ethereum genesis rather than an arbitrary hardcoded year.
- **Backend scope:** one scheduled upstream refresh per hour, one shared last-known-good cache value, and no provider request in the visitor request path.
- **Failure behavior:** a failed refresh preserves and serves the last successful value.
- **Backend restraint:** no database, queue, retry pipeline, Durable Object, or multi-layer cache unless the deployment platform proves a shared hourly cache impossible without it.

## Codex orchestration contract

This plan is intended to be executed by a lead Codex agent acting as an orchestrator. The lead agent must delegate bounded research, design, implementation, and verification work to sub-agents while retaining ownership of architecture, editorial judgment, integration, and final QA.

### Lead-agent responsibilities

- Read this entire plan, inspect the current implementation, and check the worktree before delegating.
- Create a live execution plan with one integration gate per wave.
- Use sub-agents for deep tasks that can be completed independently, especially protocol research, security-incident research, historical market-data research, visual-system specification, and focused QA.
- Give every sub-agent a concrete scope, expected artifact, source standard, and explicit non-goals.
- Limit concurrent work to non-overlapping files or read-only research; never assign two agents to edit the same file family at once.
- Review every agent result against primary sources and this document before accepting it.
- Resolve conflicts centrally. Sub-agent recommendations are inputs, not final product decisions.
- Integrate changes in small phases and run focused checks after each phase.
- Prefer the smallest deployment-native cache that can be read by all frontend requests and written by one hourly scheduled task.
- Preserve unrelated user changes in the worktree.
- Do not declare the project complete until the final visual, interaction, accessibility, data, and test gates pass together.

### Sub-agent working rules

- Research agents should write structured reports rather than editing production code.
- Implementation agents should receive explicit file ownership and must not refactor unrelated code.
- Every factual dataset entry needs a source URL, source type, date checked, and confidence note.
- Prefer Ethereum Foundation announcements, ethereum.org, EIPs, postmortems, court/regulator records, and project-authored incident reports. Use reputable secondary reporting only when primary evidence is insufficient.
- Separate confirmed facts from inference. Never imply that a protocol milestone or hack caused a market movement.
- Report blockers, disputed values, and missing evidence instead of silently choosing convenient data.
- Return a concise handoff containing: files changed, decisions made, unresolved questions, and checks run.

## High-level execution map

### Wave 0 — Orchestrator baseline

- [x] Inspect the current page, renderer, data model, API route, tests, README, and worktree state.
- [x] Capture baseline desktop and mobile screenshots.
- [x] Record current performance, accessibility behavior, and complete test status.
- [x] Confirm the deployment target's minimal shared key-value/cache binding and hourly scheduler support.
- [x] Create the research/design output directories if they do not exist.
- [x] Freeze shared schemas only after Wave 1 research is reviewed.

### Wave 1 — Parallel research

Run up to three research agents in parallel, then stop for an orchestrator decision gate.

- [x] **Agent A — Protocol chronology:** determine the essential Ethereum protocol milestones from genesis to today.
- [x] **Agent B — Security chronology:** determine the important hacks/exploits and defensible loss magnitudes.
- [x] **Agent C — Market-data history:** evaluate consistent ETH/USD sources back toward genesis.
- [x] Orchestrator reviews all three reports, resolves scope, and approves the canonical data model.

### Wave 2 — Parallel design specifications

Start only after the Wave 1 decision gate.

- [x] **Agent D — Specimen visual system:** translate the reference image into original tokens, layout rules, and component states.
- [x] **Agent E — Knot and scar geometry:** specify rendering, magnitude scaling, hit areas, and testable geometry behavior.
- [x] **Agent F — Narrative and accessible flow:** specify the full-screen entrance, session behavior, reopen interaction, responsive composition, focus management, and reduced motion.
- [x] Orchestrator combines the three specifications, removes contradictions, and approves one implementation contract.

### Wave 3 — Implementation

Delegate only non-overlapping modules. The orchestrator owns cross-file state and schema integration.

- [x] Orchestrator implements or approves the canonical milestone/scar schemas and data-source boundary.
- [x] Assign one agent exclusive ownership of renderer geometry and renderer tests.
- [x] Assign one agent exclusive ownership of narrative/interaction components and related styles.
- [x] Assign one agent exclusive ownership of sourced datasets, validation, and data tests.
- [x] **Agent G — Minimal hourly cache:** take exclusive ownership of the hourly refresh, last-known-good cache adapter, API read path, and focused failure tests.
- [x] Orchestrator integrates page composition, shared types, copy, and responsive behavior.
- [x] Run focused tests after each agent handoff before beginning cross-module integration.

### Wave 4 — Parallel verification and final integration

- [x] **Agent H — Data audit:** verify every displayed date, label, source, and magnitude against the approved reports.
- [x] **Agent I — Accessibility audit:** verify keyboard, screen reader semantics, contrast, zoom, reduced motion, and focus restoration.
- [x] **Agent J — Visual QA:** inspect desktop, tablet, and mobile screenshots for hierarchy, density, collisions, and reference fidelity without imitation.
- [x] Orchestrator fixes integration issues, runs the full suite, reviews the final page, and updates documentation.

## Required sub-agent briefs

### Agent A — Ethereum protocol milestones

**Question:** What are the few protocol events that materially changed Ethereum from genesis to the current date?

**Deliverable:** `docs/research/protocol-milestones.md` plus a machine-readable candidate table suitable for later conversion to project data.

For every candidate include:

- canonical name and aliases;
- exact activation date and, when relevant, block or epoch;
- category: genesis, upgrade, consensus, fee market, scaling, withdrawals, or other;
- two-sentence factual explanation;
- primary source URL and backup source;
- why it deserves or does not deserve a visible knot;
- confidence and any disputed naming/date detail.

**Selection rubric:** protocol impact, historical importance, visual spacing, recognizability, and narrative value. Do not include ecosystem news, token-price events, conferences, company announcements, or every routine hard fork.

**Expected starting candidates:** Frontier genesis, Homestead, DAO fork only if treated as a protocol intervention rather than a hack marker, Byzantium/Constantinople, Beacon Chain genesis, London/EIP-1559, The Merge, Shapella, Dencun, Pectra, Fusaka, and any later activated upgrade confirmed at execution time.

### Agent B — Important hacks and exploits

**Question:** Which Ethereum-related security events are important enough to become visible scars, and what magnitude can be represented honestly?

**Deliverable:** `docs/research/security-scars.md` plus a normalized candidate table.

For every candidate include:

- incident name, protocol/project, exact date, and affected layer;
- exploit category and a neutral two-sentence summary;
- loss in native units when known;
- reported USD value, valuation basis/date, recovered amount, and net-loss caveat;
- whether Ethereum itself, a smart contract, a bridge, an exchange, or another ecosystem component was compromised;
- primary postmortem or disclosure and at least one corroborating source;
- confidence range when reports disagree;
- inclusion recommendation and reason.

**Magnitude rule:** do not compare incompatible headline numbers without normalization. Preserve original units, store a documented USD estimate for visual scaling, cap rendered size, and disclose recoveries separately. Do not describe an application exploit as an Ethereum protocol hack.

### Agent C — Historical ETH/USD data

**Question:** What single defensible market series can take the annual rings closest to Ethereum genesis without silently stitching incompatible markets?

**Deliverable:** `docs/research/market-data-sources.md` with a comparison table and recommendation.

Evaluate:

- earliest reliable timestamp;
- market/pair and venue consistency;
- OHLC and volume availability;
- gaps, timezone, candle methodology, licensing, rate limits, and reproducibility;
- compatibility with server-side fetching and caching;
- implications for the partial 2015 ring and 2015–2017 interval;
- whether a composite index would change the meaning of the existing artifact.

The report must explicitly compare the current Bitstamp series, whose downloaded file begins 9 November 2017, with credible alternatives. Do not recommend invisible exchange stitching.

### Agent D — Computational dendrochronology visual system

**Question:** How can the reference's botanical-specimen and technical-instrument qualities become an original interface for this project?

**Deliverable:** `docs/design/specimen-system.md` covering tokens, responsive layout, density, typography, states, and do/don't examples.

The specification must preserve the annual-ring visualization as the hero. It must not introduce a literal full tree, arbitrary ASCII noise, copied error strings, fake measurements, faux scientific metadata, or illegible vintage effects.

### Agent E — Knot and scar geometry

**Question:** What rendering model makes protocol knots feel embedded in growth and hack scars communicate magnitude without overwhelming the tree?

**Deliverable:** `docs/design/event-geometry.md` with diagrams, formulas, scaling recommendation, collision rules, interaction hit areas, and test cases.

### Agent F — Narrative and accessible entrance

**Question:** How should a very short full-screen specimen introduction reveal the interactive visualization once per session and remain recoverable?

**Deliverable:** `docs/design/narrative-flow.md` with desktop/mobile wireframes, state diagram, focus behavior, session-storage behavior, reduced-motion behavior, and final introduction copy capped at roughly 45–60 words.

### Agent G — Minimal hourly cache

**Question:** What is the smallest deployment-native implementation that guarantees visitor traffic never calls the provider, refreshes at most once per hour, and preserves the last successful value?

**File ownership:** worker scheduling/configuration, the cache adapter, `/api/market-data`, and their focused tests. Do not change renderer, visual, narrative, or event-data files.

**Deliverable:** the working cache implementation, tests, and a short `docs/engineering/hourly-cache.md` note describing setup and failure behavior.

Required proof:

- scheduled refresh performs at most one upstream request;
- visitor API performs zero upstream requests;
- successful refresh atomically replaces the single cached payload;
- timeout, bad status, parse failure, or validation failure preserves the old payload;
- empty cache returns a clear `503`;
- no database, queue, retry framework, or unnecessary abstraction was introduced.

## Art direction — computational dendrochronology

The target is a **botanical specimen plate for a digital organism**: scientific, archival, organic, slightly imperfect, and computational. Borrow the reference's principles, not its specific composition or decorative content.

### Visual principles

- [x] Shift from a conventional dark crypto dashboard toward a warm laboratory-paper field with near-black ink.
- [x] Preserve strong negative space around the central annual-ring specimen.
- [x] Combine restrained monospaced system metadata with a brief literary introduction.
- [x] Use registration marks, scales, coordinates, rules, and leader lines only when they communicate real structure or state.
- [x] Use subtle paper grain, fading, and printing irregularity without reducing canvas or text clarity.
- [x] Reserve an oxidized-copper accent for human interpretation, selected annotations, or editorial notes.
- [x] Use Ethereum color sparingly, primarily for active interaction if it survives contrast testing.
- [x] Keep annotations sparse; labels should appear through selection or deliberate emphasis rather than surrounding every event.

### Starting palette for exploration

- Paper: `#EEE9D9`
- Ink: `#171A17`
- Secondary ink: `#66685F`
- Oxidized copper: `#97694E`
- Deep botanical green: `#263A30`
- Ethereum accent: derive from the existing asset, then validate contrast in context.

These are exploration values, not locked production tokens. Agent D must test them against the artwork, text, focus states, and accessibility requirements.

### Truthful specimen metadata

- [x] Prototype a specimen header using real values only:

  ```text
  COMPUTATIONAL DENDROCHRONOLOGY
  Ethereum Annual Rings
  LIVE MARKET SPECIMEN · ETH/USD

  SPEC_ID: ETH_TREE_001
  ORIGIN: 2015-07-30
  ```

- [x] Prototype live state metadata populated from application data:

  ```text
  STATE: GROWING
  CURRENT_RING: 2026 / OPEN
  SERIES: ETH·USD / DAILY
  SOURCE: BITSTAMP
  DATA_THROUGH: 2026-08-21
  ```

- [x] Replace illustrative dates, source names, and current-ring values dynamically.
- [x] Avoid fake terminal errors, arbitrary scan counts, decorative code fragments, and invented scientific measurements.

### Full-screen specimen composition

- [x] Place identity/specimen information at the upper left.
- [x] Place live series metadata at the upper or right edge.
- [x] Keep the annual rings large and central, with quiet space around them.
- [x] Keep the short introduction as one readable block of roughly 40–50 characters per line.
- [x] Place the encoding key as a compact scientific-plate key, separate from the poetic narrative.
- [x] Use thin leader lines for selected knots and scars.
- [x] Let the introduction transition into the usable explorer rather than cutting to an unrelated layout.
- [x] After entry, move supporting metadata toward the edges, reveal controls, retain the compact legend, and expose the **Read introduction** button.

### Explicit non-goals

- Do not add a literal tree, branches, or roots; the transverse section remains the unique central form.
- Do not reproduce the reference's title, fake species, phrases, errors, palette labels, handwriting, or exact layout.
- Do not scatter random ASCII or code over the rings.
- Do not make every milestone and scar label permanently visible.
- Do not let texture, annotations, or framing marks compete with the market data.
- Do not trade accessibility or interaction clarity for an archival appearance.

## Minimal hourly data backend

The provider must never sit directly in the frontend request path. Visitor traffic should not change upstream request volume.

### Required flow

```text
hourly scheduler
      ↓
fetch provider once
      ↓
validate + aggregate
      ↓
replace shared cached JSON only on success

frontend → /api/market-data → read shared cached JSON
```

### Implementation contract

- [x] Use one deployment-native hourly scheduled handler to refresh market data.
- [x] Store exactly one last-known-good aggregated response plus minimal metadata: `updatedAt`, source cutoff, and schema version.
- [x] Make `/api/market-data` read the shared cached response; it must not fetch the provider during normal visitor requests.
- [x] Replace the cached value only after the upstream response has been fetched, parsed, validated, and aggregated successfully.
- [x] If the provider times out, rejects, returns a bad status, or sends invalid data, log one concise refresh error and leave the cached value untouched.
- [x] Serve the cached value regardless of age when refresh fails, and expose its real `updatedAt`/cutoff so the frontend can disclose freshness honestly.
- [x] Add ordinary browser/CDN response caching if convenient, but treat it as an optimization rather than the source of truth.
- [x] Use a short upstream timeout and no automatic retry loop; the next hourly schedule is the retry.
- [x] Keep frontend behavior unchanged except for showing cached-data freshness.

### Cold-start behavior

- [x] Choose one minimal bootstrap path supported by the deployment platform:
  - seed the shared cache once during setup/deploy; or
  - allow an explicit maintainer-only refresh command.
- [x] If no cached value exists, return a clear `503` response; do not silently fall back to fabricated or partially parsed data.

### Explicit non-goals

- No per-visitor upstream fetch.
- No stale-while-revalidate logic that can trigger one provider request per edge location.
- No relational database or data warehouse.
- No queue, background job framework, exponential retry system, or cache hierarchy.
- No historical candle storage beyond the single aggregated payload needed by the frontend.
- No attempt to guarantee sub-second freshness; hourly freshness is sufficient.

### Backend acceptance criteria

- [x] One hour of arbitrary frontend traffic causes zero provider requests.
- [x] One scheduled hourly refresh causes at most one provider request.
- [x] Concurrent frontend requests all receive the shared cached payload.
- [x] A provider outage leaves the previous payload available.
- [x] A malformed provider response cannot replace good cached data.
- [x] Cache age and source cutoff remain visible and testable.
- [x] Focused tests cover successful refresh, failed refresh with existing cache, invalid response, and empty-cache `503`.

## 1. Resolve the timeline and data source

- [x] Remove the hardcoded `START_YEAR = 2019` assumption from data aggregation, tests, page copy, and documentation.
- [x] Use Ethereum mainnet genesis — **30 July 2015** — as the conceptual beginning of the tree.
- [x] Audit price sources that can provide a defensible ETH/USD history close to genesis.
- [x] Document that the current Bitstamp ETH/USD file begins on **9 November 2017**.
- [x] Decide between:
  - switching to a consistent price source with earlier history; or
  - representing 2015–2017 as a distinct pre-Bitstamp growth interval without inventing price rings.
- [x] Derive the displayed period from the chosen dataset instead of maintaining it separately in interface copy.
- [x] If partial 2015 data is used, support a partial innermost ring that begins at the exact launch date.
- [x] Add a genesis label or pith marker so the beginning is meaningful, not merely the first available candle.

### Acceptance criteria

- [x] The visualization never implies that Bitstamp market data existed before its source begins.
- [x] Ethereum genesis is visibly acknowledged as the origin of the chronology.
- [x] The start year and period cannot drift between the data, hero, center label, README, and tests.

## 2. Separate milestones from shocks

- [x] Replace the current shared event model with distinct `milestones` and `scars` collections.
- [x] Define a milestone record: date, name, summary, source URL, and optional category.
- [x] Define a scar record: date, name, loss or severity, summary, source URL, and healing state.
- [x] Research and source a small, intentional set of Ethereum **protocol** milestones.
- [x] Review the existing hack list and normalize reported losses into a defensible magnitude scale.
- [x] Define a capped scar-size scale so one extreme event cannot overwhelm the whole tree.
- [x] Keep all event descriptions factual and avoid implying that an event caused a price movement.

### Candidate milestones

- [x] London / EIP-1559
- [x] The Merge
- [x] Shanghai / Shapella
- [x] Dencun
- [x] Pectra
- [x] Fusaka

## 3. Draw knots on the grain

- [x] Move knots onto their exact year-and-month ring position; do not offset them toward the center.
- [x] Render knots as small asymmetric ovals embedded in the path.
- [x] Add a subtle local swelling or grain distortion around each knot.
- [x] Ensure knots remain distinguishable from the selected-month highlight.
- [x] On selection, show milestone name, date, summary, and source.
- [x] Keep fork milestones within the knot vocabulary; do not split or duplicate the ring.

### Acceptance criteria

- [x] A knot reads as part of the tree's growth rather than an annotation floating above it.
- [x] Its position resolves to the correct year and month.
- [x] It remains legible at mobile sizes and at 200% zoom.

## 4. Design and render scars

- [x] Prototype an irregular tapered wound anchored at the affected month and year.
- [x] Make the event point the scar's apex.
- [x] Extend the wound outward through newer growth; never cut backward into older rings.
- [x] Bend or interrupt subsequent grain around the wound so it feels healed into the tree.
- [x] Use a dark, erased, or charcoal-like treatment rather than a clean geometric fill.
- [x] Support a healed scar that closes before the bark.
- [x] Support a recent or unresolved scar that remains open at the bark.
- [x] Encode reported hack magnitude in scar size using the capped scale defined in the data model.
- [x] Add hit-testing and keyboard navigation for scars.
- [x] On selection, show event name, date, context, reported impact, and source.

### Experiments

- [x] Compare three scar silhouettes: tapered wedge, narrow fissure, and almond-shaped healed wound.
- [x] Test a subtle warm/danger accent against a fully monochrome scar.
- [x] Test whether later annual paths should visibly bridge the wound or flow around its edges.

### Acceptance criteria

- [x] A scar cannot be mistaken for a month-selection wedge.
- [x] The direction of the scar communicates that damage affects later growth, not the past.
- [x] Multiple scars do not turn the composition into a radial starburst.
- [x] The visualization remains readable without color alone.

## 5. Add the full-screen narrative entrance

- [x] Add a full-viewport narrative state before the visualization on the first visit of each browser session.
- [x] Decide whether the visualization is hidden, softly visible, or gradually revealed behind the narrative.
- [x] Present a very short introduction with generous negative space and a single entry action.
- [x] Use a compact closing invitation:

  > **A living market archive**  
  > Each year grows around the last.  
  > **Enter the rings →**

- [x] On activation, transition from the full-screen narrative to the complete visualization.
- [x] Respect `prefers-reduced-motion`; use an immediate state change or minimal dissolve.
- [x] Do not dismiss the narrative from incidental pointer movement.
- [x] Store dismissal in `sessionStorage`, not persistent local storage.
- [x] Add a small persistent icon button with the accessible name **Read introduction**.
- [x] Make the icon button reopen the full-screen narrative without resetting the selected month.
- [x] Ensure Escape and an explicit close control return the visitor to the visualization.

## 6. Write and compose the short introduction

- [x] Treat the introduction as a full-screen opening composition, not a long reading experience or side-panel state.
- [x] Communicate only the essential metaphor: growth, encoding, and the unfinished present.
- [x] Keep the final introduction near 45–60 words and no more than three short paragraphs.
- [x] Keep line lengths comfortable on desktop and mobile.
- [x] Keep the encoding key visually separate; do not repeat the complete legend inside the introduction.
- [x] Keep the compact encoding key visible after entering the visualization.

### Draft introduction

> Trees keep a record of what they endure. This experiment imagines the ETH market the same way: price shapes each ring, volume gives it weight, protocol milestones form knots, and hacks leave scars.
>
> The outer ring is unfinished. Tomorrow will change its shape.

- [x] Tighten the draft once the final milestone and scar behavior is visible in the artifact.
- [x] Add a short methodology note separating poetic metaphor from literal data encoding.

## 7. Update interface language

- [x] Change the encoding key to:
  - `Ring shape — price`
  - `Weight — volume`
  - `Knots — milestones`
  - `Scar size — hack magnitude`
- [x] Replace “Hover or tap a ring” with “Trace the grain · Hover or tap to read a month.”
- [x] Add `Still growing` to the latest incomplete year.
- [x] Review whether the subtitle should use “growth, grain, and scars” instead of “growth, texture, and scars.”

## 8. Interaction and accessibility

- [x] Define focus order across the entrance, canvas, year controls, month controls, events, and About state.
- [x] Provide semantic equivalents for every knot and scar outside the canvas.
- [x] Announce event type explicitly: “Milestone” or “Scar.”
- [x] Keep hover exploration silent for assistive technology; announce committed selections only.
- [x] Verify touch targets and event selection on small screens.
- [x] Verify that the entrance never traps keyboard or screen-reader users.
- [x] Give the reopen icon a visible tooltip as well as the accessible name **Read introduction**.
- [x] Restore focus to the reopen icon after closing the narrative.
- [x] Provide a non-animated path when reduced motion is enabled.

## 9. Verification

- [x] Add unit tests for event-to-year/month placement.
- [x] Add geometry tests for healed and open scars.
- [x] Add hit-test coverage for knots and scars.
- [x] Update rendered-page tests for the new legend and narrative controls.
- [x] Test loading, ready, data-error, and empty-event states.
- [x] Visually inspect desktop, tablet, and mobile layouts.
- [x] Run lint, typecheck, build, and the full test suite.

## Open decisions

- [x] Which price source can carry the rings closest to Ethereum genesis without stitching incompatible markets?
- [x] How should the 2015–2017 interval appear if Bitstamp remains the source?
- [x] Which protocol events are important enough to qualify as knots?
- [x] Should the tree be faintly visible behind the full-screen narrative or revealed only after entry?
- [x] Which neutral info symbol best matches the visual system without competing with the graph?

## Orchestrator integration gates

### Gate 1 — Research accepted

- [x] Protocol, security, and market-data reports exist in their required locations.
- [x] Every proposed milestone and scar has adequate sourcing and a confidence assessment.
- [x] The orchestrator has approved inclusion rubrics, the market-series boundary, and the magnitude-normalization method.
- [x] Disputed or excluded events remain documented rather than silently deleted.

### Gate 2 — Design contract accepted

- [x] Visual-system, event-geometry, and narrative-flow specifications exist and agree on terminology and state.
- [x] Desktop and mobile compositions preserve one obvious reading path.
- [x] Scar scaling, collision behavior, and maximum visual dominance are numerically defined.
- [x] The entrance, reopen button, compact legend, selection state, and readout have distinct roles.
- [x] Accessibility requirements are part of the implementation contract, not deferred polish.

### Gate 3 — Integrated implementation accepted

- [x] The application uses one canonical milestone/scar model across API data, renderer, interaction, and semantic readout.
- [x] The period and source metadata are derived from real data.
- [x] The visitor-facing API reads only the shared last-known-good payload and cannot call the provider.
- [x] The hourly scheduled refresh is the only normal path that calls the provider.
- [x] A failed or invalid refresh preserves the previously cached payload.
- [x] Knots, scars, selections, grain, bark, and labels remain visually separable.
- [x] Session entry and reopening work without losing explorer state.
- [x] All agent-owned changes have been reviewed by the orchestrator for overlap and unintended behavior.

### Gate 4 — Release candidate accepted

- [x] Data audit finds no unsupported date, magnitude, label, or causal claim.
- [x] Accessibility audit passes keyboard, semantic, zoom, contrast, focus, and reduced-motion checks.
- [x] Visual QA passes at desktop, tablet, and mobile sizes with no text or annotation collisions.
- [x] Loading, ready, error, current-partial-year, and no-event states are verified.
- [x] Lint, typecheck, build, unit tests, rendered-page tests, and focused geometry tests pass.
- [x] README and methodology documentation match the shipped behavior.

## Definition of done

The work is complete only when a visitor can understand the piece at two depths:

1. **High level:** it immediately reads as a living, archival cross-section of Ethereum market history.
2. **Deep level:** every ring, weight, knot, scar, label, source, interaction, and caveat can be inspected and defended.

The final artifact must feel authored rather than decorated, technically truthful rather than pseudo-scientific, and usable rather than merely poster-like.
