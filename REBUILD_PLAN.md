# Ethereum Annual Rings Rebuild Plan

## Objective

Rebuild the application progressively on a new, unrelated `main` history and deploy it on Vercel's free Hobby plan. Preserve the existing proof of concept and the completed annual-rings implementation as read-only references, but do not copy their structure or replay their commits.

The rebuild should favor explicit boundaries, composition, small modules, meaningful tests, and small Conventional Commits. The page and the annual-rings graph must remain separate concerns.

## Repository state

The repository currently has three unrelated histories:

- `origin/main`: the original proof of concept, consisting of 11 commits and `index.html`.
- local `main`: an earlier annual-rings implementation.
- `codex/complete-annual-rings-safety`: the completed reference implementation.

The completed reference currently passes linting, TypeScript checks, the production build, and all 63 tests. Its behavior and visual output are the acceptance reference, not its module structure.

## Branch transition

No history should be deleted during the transition.

1. Rename the remote `main` branch to `poc` through the repository host.
2. Verify that `poc` still contains all 11 commits and only the original POC file tree.
3. Preserve the unrelated local `main` tip as `reference/annual-rings-baseline`.
4. Keep `codex/complete-annual-rings-safety` unchanged as the completed product reference.
5. Create a new orphan `main` branch with no parent commit.
6. Make the repository-foundation commit and push the new `main` normally.
7. Set the repository's default branch back to `main` and verify branch protection and CI settings.

Using a host-side rename before publishing the new branch avoids force-pushing over the POC history. Before execution, record the commit IDs at the tips of `poc`, `reference/annual-rings-baseline`, and `codex/complete-annual-rings-safety` in the transition issue or pull request.

## Engineering rules

### Commits

- Follow Conventional Commits and enforce them with Commitlint.
- Use a scope when it improves navigation, such as `geometry`, `rendering`, `market`, `graph`, `page`, or `ci`.
- Keep each commit limited to one behavior, boundary, or mechanical change.
- Keep the repository buildable and testable after every commit.
- Do not combine formatting, refactoring, and behavior changes.
- Do not use catch-all commits such as `initial implementation`, `misc changes`, or `cleanup`.
- Add documentation in the same commit as the non-obvious architectural or mathematical decision it explains.

### Code

- Prefer composition over inheritance and large configurable abstractions.
- Keep domain calculations pure and independent of React, Canvas, storage, and network APIs.
- Validate data at external boundaries; keep trusted internal types simple.
- Separate types, behavior, and presentation when they change for different reasons.
- Use comments only for non-obvious constraints, formulas, browser behavior, or deliberate tradeoffs.
- Delete dead code, obsolete assets, speculative abstractions, and narration-style comments.
- Prefer descriptive names and early returns over explanatory comments.
- Treat 150 lines as a review signal, not an automatic failure. Split by responsibility rather than line count alone.
- Avoid barrel files unless they define a deliberate public module boundary.

### Quality gates

Local and CI checks should cover:

- formatting;
- ESLint;
- Stylelint;
- strict TypeScript;
- unit and integration tests;
- end-to-end accessibility and keyboard tests;
- production build;
- dead-code and unused-dependency detection;
- dependency audit;
- Conventional Commit validation.

Pre-commit hooks should check only staged files. CI remains the authoritative full verification step.

## Vercel Hobby deployment

The application should use standard Next.js App Router behavior on Vercel. It must not depend on Cloudflare Workers, Wrangler, R2, or a compatibility build layer.

The free Hobby plan currently allows native Vercel Cron Jobs only once per day, so an hourly Vercel cron expression would fail deployment. Use GitHub Actions only as the external hourly scheduler while keeping the application, refresh Function, and storage on Vercel:

1. A scheduled GitHub Actions workflow calls `/api/refresh/market-data` approximately once per hour.
2. The refresh route authenticates the request before reading cache state or contacting the provider.
3. If the cached payload is already fresh for the current refresh window, the route exits successfully without calling the provider.
4. An accepted refresh makes at most one request to the market-data provider.
5. It parses and validates the complete candidate payload before writing anything.
6. A successful refresh overwrites one private Vercel Blob containing the last-known-good JSON payload.
7. Any provider, parsing, validation, or Blob write failure leaves the prior payload usable.
8. `/api/market-data` reads only the private Blob and never contacts the provider.
9. The same-origin API response uses appropriate CDN cache headers so ordinary visitors do not cause repeated Blob reads or Function work.

The refresh route must verify `Authorization: Bearer $MARKET_REFRESH_SECRET` using a timing-safe comparison. Store the same secret as an encrypted GitHub Actions secret and a Vercel environment variable. The Blob store uses the project-provided `BLOB_READ_WRITE_TOKEN`; neither secret is exposed to the browser.

The workflow should run at a non-zero minute to reduce common top-of-hour scheduling delays. It should also support `workflow_dispatch` for recovery and use a concurrency group that prevents overlapping refresh jobs. GitHub schedules are best-effort, so “hourly” means approximately hourly rather than an exact wall-clock guarantee.

The refresh endpoint must be idempotent. A repeated invocation after a successful refresh observes the fresh Blob timestamp and becomes a no-op. A conditional Blob write using the prior ETag prevents overlapping executions from replacing a newer value.

Approximately 720 refresh Function calls and Blob writes per month fit comfortably within the published Vercel Hobby allowances. Standard GitHub-hosted Actions runners are free for public repositories; private repositories consume their included monthly minutes. The API payload must expose its last successful refresh timestamp so freshness remains observable.

Relevant platform documentation:

- [Vercel Cron usage and Hobby limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Vercel Blob SDK and conditional writes](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [GitHub Actions billing and public-repository usage](https://docs.github.com/en/actions/concepts/billing-and-usage)

## Target architecture

```text
app/
  api/
    refresh/market-data/       Authenticated idempotent refresh adapter
    market-data/               Cache-only visitor adapter
  layout.tsx                   Document metadata and global shell
  page.tsx                     Page composition only

features/
  annual-rings/
    components/                Explorer, canvas, controls, readouts
    domain/                    Types, invariants, selectors
    geometry/                  Pure ring and event calculations
    hooks/                     Loading, selection, and canvas lifecycle
    rendering/                 Small composable Canvas drawing layers
  narrative/
    components/                Introduction and information dialog
    hooks/                     Session and focus behavior

server/
  events/                      Canonical sourced event records
  market-data/                 Provider parsing and validation
  market-cache/                Private Vercel Blob boundary

styles/
  tokens.css                   Shared visual tokens
  globals.css                  Resets and document-level rules

tests/
  unit/                        Pure domain and geometry behavior
  integration/                 Cache, API, and component boundaries
  e2e/                         User flows, accessibility, screenshots

.github/
  workflows/
    refresh-market-data.yml    External hourly scheduler
```

Dependency direction should remain one-way:

```text
page composition -> feature components -> hooks/selectors -> domain
                                      \-> canvas adapter -> rendering -> geometry
API/refresh adapters -> server boundaries -> domain contracts
```

Domain, geometry, and server modules must not import React components or page styles.

## Delivery phases

### Phase 0: Preserve histories and establish the new main

Deliverables:

- remote POC available as `poc`;
- earlier local implementation preserved as `reference/annual-rings-baseline`;
- completed branch preserved unchanged;
- orphan `main` created and protected.

Exit gate: all three reference tips are reachable and the new `main` has no parent relationship with them.

### Phase 1: Repository foundation

Add only the application skeleton and engineering standards:

- package metadata and locked runtime versions;
- standard Next.js scripts supported directly by Vercel;
- `.editorconfig`, Prettier, ESLint, and Stylelint;
- strict TypeScript configuration;
- Commitlint with the conventional configuration;
- commit-message and staged-file hooks;
- dead-code checking;
- CI workflow and documented scripts;
- minimal route that proves development and production builds work.

Suggested commits:

```text
chore(repo): initialize the application workspace
chore(format): configure repository formatting
chore(lint): configure code and style checks
chore(commits): enforce conventional commit messages
ci(quality): verify every repository quality gate
feat(page): render the application shell
```

### Phase 2: Acceptance contracts

Translate observable reference behavior into tests before rebuilding it:

- chronology and market-data coverage;
- price and volume normalization;
- event validation and ordering;
- cache-only visitor behavior;
- last-known-good refresh behavior;
- refresh authentication, idempotency, and hourly workflow scheduling;
- ring geometry invariants;
- keyboard and focus behavior;
- representative desktop and mobile visual baselines.

Tests should assert outcomes rather than search source files for implementation strings.

Exit gate: tests fail for missing behavior for an understandable reason, without importing code from a reference branch.

### Phase 3: Domain and data contracts

Build the smallest trusted core:

- market, year, month, chronology, event, and selection types;
- runtime schemas for provider and cache inputs;
- pure normalization and aggregation functions;
- sourced milestone and scar records;
- selectors connecting dates, market periods, and events.

Keep formulas beside focused tests. Explain only the decisions that cannot be inferred from the code, including logarithmic scaling, caps, and partial-year treatment.

### Phase 4: Server data boundary

Rebuild the backend independently of the page:

- provider response parser;
- aggregate validation;
- private Vercel Blob last-known-good storage;
- cache-only market-data route;
- authenticated and idempotent refresh route;
- hourly GitHub Actions workflow with overlap prevention;
- empty-cache and failure responses.

The storage adapter should use one stable private Blob pathname, validate before overwrite, and use the existing Blob ETag for a conditional write when a prior value exists. A documented seed command must initialize a new environment without making the public visitor route capable of fetching upstream data.

Exit gate: visitor requests perform zero provider calls, one accepted hourly refresh performs at most one provider call, duplicate or overlapping refreshes become no-ops, unauthorized requests do nothing, and every refresh failure preserves the prior payload.

### Phase 5: Graph geometry

Implement pure geometry in reviewable slices:

- calendar angles and sampling;
- annual ring baselines;
- price relief;
- volume modulation;
- incomplete and unobserved periods;
- milestone knots;
- magnitude-scaled scars;
- collision resolution;
- hit regions and keyboard ordering.

Each geometry module should accept data and return values. It should not draw, read CSS, or access the DOM.

### Phase 6: Canvas rendering

Build rendering as composed layers:

- viewport and device-pixel-ratio setup;
- paper and grain;
- ghost growth;
- data-bearing contours;
- bark and unfinished edge;
- knots and scars;
- month and event selection;
- static-layer caching.

Expose one narrow renderer interface to React. Drawing layers may share a small rendering context, but should not receive component state setters or DOM events.

### Phase 7: Graph interaction and accessibility

Compose the graph feature from:

- market-data loading states;
- selection state and selectors;
- Canvas lifecycle hook;
- pointer and touch mapping;
- keyboard navigation;
- semantic period and event controls;
- selected-period and selected-event readouts;
- polite announcements and text alternatives.

Exit gate: every Canvas interaction has a semantic keyboard-accessible equivalent.

### Phase 8: Page and narrative

Build the webpage around the independent graph feature:

- specimen header and provenance;
- responsive graph placement;
- navigation and source information;
- reusable accessible dialog primitive;
- session-scoped introduction;
- focus restoration and reduced-motion behavior;
- metadata, favicon, and social preview.

Use CSS Modules for feature styles and global CSS only for tokens, resets, and document-level behavior.

### Phase 9: Verification and removal

- Run unit, integration, end-to-end, accessibility, and visual checks.
- Compare representative outputs with the completed reference.
- Test narrow, short, touch, high-DPI, zoomed, and reduced-motion environments.
- Review module boundaries and dependency direction.
- Remove superseded experiments, unused assets, dead exports, and obsolete documentation.
- Verify production deployment and externally scheduled refresh behavior.
- Confirm the project remains within the Vercel Hobby allowances and document how to inspect Function, Blob, and GitHub Actions usage.

Exit gate: all quality checks pass together and no production behavior depends on a reference branch.

## Review checklist for every commit

- Does the commit have one clear reason to exist?
- Does its message pass Commitlint and describe the outcome?
- Is new behavior tested at the lowest useful level?
- Are types defined at the boundary that owns them?
- Did UI code remain free of domain formulas?
- Did domain code remain free of React and browser dependencies?
- Is a new abstraction used by more than one real caller, or does it define a necessary boundary?
- Can any comment be replaced with a clearer name or smaller function?
- Is any dead or superseded code removed in the same concern-specific commit?
- Do formatting, linting, types, tests, and the build still pass?

## Definition of done

The rebuild is complete when:

- `poc` and both annual-rings reference histories remain available;
- the new `main` has a clean, reviewable Conventional Commit history;
- the page and graph are independently understandable and testable;
- domain formulas and Canvas rendering are separated;
- external data is validated and visitor traffic cannot call the provider;
- the approximately hourly external refresh, private Blob cache, and deployment work on Vercel Hobby without Cloudflare-specific infrastructure;
- keyboard, touch, pointer, screen-reader, zoom, and reduced-motion behavior are verified;
- CI enforces formatting, linting, types, tests, build, dead-code checks, dependency checks, and commit messages;
- no dead code, fluffy comments, obsolete assets, or source-string implementation tests remain.
