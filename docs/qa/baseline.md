# Wave 0 baseline — 2026-08-21

## Repository state

- No `AGENTS.md` file is present in the repository.
- The worktree was already modified before this execution; all existing changes are treated as user-owned and preserved.
- The current application is a Vinext/React site targeting a Cloudflare Worker through OpenAI Sites.
- `.openai/hosting.json` currently declares no D1 or R2 binding.

## Current behavior

- The visitor-facing `/api/market-data` route directly fetches the upstream Bitstamp CSV on every uncached execution.
- Market aggregation hardcodes `START_YEAR = 2019`.
- Protocol milestones and security incidents are not separated; a single `events` collection is rendered as knots.
- The introduction, session behavior, reopen control, semantic event controls, and scar renderer do not exist yet.
- Keyboard year/month navigation and a semantic month/year control surface already exist.

## Visual baseline

- Desktop: `docs/qa/baseline-desktop.png` (1440 × 1000 viewport).
- Mobile: `docs/qa/baseline-mobile.png` (390 × 844 viewport).
- The current mobile composition is coherent, but the 1440-pixel capture collapses the experience into a narrow left column with large unused space. This is a release-blocking responsive defect.
- The visual direction is a conventional dark crypto dashboard rather than the required archival specimen plate.

## Test baseline

`npm run test:all` passed before implementation:

- ESLint: pass
- TypeScript: pass
- Vinext production build: pass
- Node tests: 7 passed, 0 failed

The baseline suite does not cover cache failure paths, event geometry, entrance focus/session behavior, semantic scars, or responsive rendering.

## Platform capability decision

Cloudflare Workers supports an hourly Cron Trigger through an exported `scheduled()` handler, and R2 supplies a deployment-native shared object store. The minimal target architecture is therefore one R2 object containing the validated last-known-good aggregate, written only by the scheduled handler and read by the visitor API. No database, queue, retry system, or cache hierarchy is required.
