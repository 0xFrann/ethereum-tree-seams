# Accessibility audit — remediated release candidate

Re-audited **2026-08-21** against the remediated React/CSS source, focused automated checks, and browser QA evidence supplied by the release owner. This audit changed no production code.

## Result

**PASS — no release-blocking accessibility finding remains in the audited scope.**

All seven findings from the initial audit are resolved. The browser evidence confirms the highest-risk runtime behaviors: 320 CSS px reflow without horizontal overflow, canvas arrow-key selection, dialog focus entry/Escape/restoration, and exactly one event-chronology tab stop. Assistive-technology smoke testing remains prudent release QA, particularly for the custom interactive-chart announcement, but is not a blocker based on the implementation and evidence reviewed.

## Remediation verification

| Prior finding | Final status | Evidence |
|---|---|---|
| A11Y-01 — async focus loss | **Pass** | The loading target records focus intent through `pendingEntryFocus`; once loading settles, the effect transfers focus to the ready canvas or the retry button. Retry explicitly sets the same intent before replacing its focused button. The first-session dialog still hands focus to `#rings-explorer-entry`, so closing during loading participates in this transfer (`EthRings.tsx`). |
| A11Y-02 — chronology tab sequence | **Pass** | Event buttons now use a true roving tabindex: only `eventFocusIndex` receives `tabIndex=0`; focus updates that index; Arrow/Home/End update it before moving focus. Supplied browser QA observed one event tab stop and working arrow navigation. |
| A11Y-03 — canvas role/fallback | **Pass** | The keyboard-operated canvas is now a labelled `role="group"` with `aria-roledescription="interactive chart"`, concise key instructions, a current selection in its accessible name, and a textual canvas fallback that directs users to equivalent year/month/event controls. The prior static-image role mismatch is gone. Browser QA confirmed arrow-key selection. |
| A11Y-04 — oversized live region | **Pass** | Live semantics were removed from the full inspector. A separate visually hidden, permanently mounted polite status emits only a concise market or event selection sentence. Pointer hover sets announcement intent off; committed keyboard/pointer selections turn it on. |
| A11Y-05 — narrow viewport overflow | **Pass** | Canvas sizing is guarded by `100%` at desktop and tablet widths, and the mobile rule is `min(100%, 440px)`. Supplied browser QA at 320 CSS px found no horizontal document overflow. |
| A11Y-06 — checking-session silence | **Pass** | The exposed checking overlay now has `role="status"`, `aria-busy="true"`, and the screen-reader message “Preparing introduction.” |
| A11Y-07 — runtime evidence gap | **Pass for release gate** | Existing Node tests remain mostly contract/geometry tests, but the release owner supplied direct browser evidence for reflow, modal focus/dismissal/restoration, canvas keyboard selection, and the one-tab-stop chronology. See residual recommendations below for durable automation. |

## Final behavior matrix

| Area | Status | Notes |
|---|---|---|
| Dialog semantics | **Pass** | `role="dialog"`, `aria-modal`, visible label and description, and an explicit labelled close button are present. |
| Dialog focus management | **Pass** | Focus enters the heading, Tab/Shift+Tab are contained, Escape closes, first close targets the explorer, and reopen close restores the opener when connected. Browser QA confirmed focus, Escape, and restoration. |
| Background isolation | **Pass** | The background uses both `inert` and `aria-hidden` while session state is checking or the modal is open. |
| Async focus transfer | **Pass** | Loading-to-ready, loading-to-error, and retry-to-settled paths retain an explicit focus intent and select a connected destination. |
| Session-check status | **Pass** | A concise busy status remains exposed while the primary subtree is isolated. |
| Skip behavior | **Pass** | The visible-on-focus skip link targets the focusable explorer entry in loading, error, and ready states; async focus intent preserves the handoff when the target is replaced. |
| Canvas semantics | **Pass** | The interactive group has instructions, current selection, fallback text, keyboard support, visible focus, and complete semantic controls following it. |
| Market controls | **Pass** | Native buttons provide 44 px targets, availability/disabled state, `aria-pressed`, and visible focus. |
| Event chronology | **Pass** | Native buttons expose type, name, exact date, and pressed state; roving tabindex provides one Tab entry, with Arrow/Home/End navigation and native activation. |
| Live announcements | **Pass** | A dedicated concise polite status reports committed market/event selections; the verbose readout is ordinary readable content and hover preview is silent. |
| Reduced motion | **Pass** | Global motion duration is reduced to `.01ms`, modal duration is bounded to 40 ms, smooth scrolling is disabled, and no behavior depends on animation completion. |
| Responsive/zoom risk | **Pass for tested scope** | The layout collapses, canvas width is container-bounded, modal scrolls within `100dvh`, and 320 px browser QA showed no horizontal overflow. |
| Color-independent state | **Pass** | Numeric signs, pressed semantics, underline/inset/outline treatments, and distinct knot/scar geometry avoid color-only meaning. |
| Focus indication | **Pass** | Canvas and semantic controls use visible high-contrast outlines; the programmatically focused modal heading also receives a visible outline. |
| Forced colors | **Pass with semantic fallback** | Selected DOM controls receive `CanvasText` outlines. The canvas preserves its rendering, while equivalent DOM controls expose the same selectable information. |

## Contrast and token check

The palette remains above the applicable WCAG thresholds against paper `#EEE9D9`:

| Token | Contrast | Result |
|---|---:|---|
| Ink `#171A17` | 14.45:1 | Pass |
| Secondary ink `#55574F` | 6.04:1 | Pass |
| Faint ink `#66685F` | 4.66:1 | Pass |
| Copper text `#704A37` | 6.35:1 | Pass |
| Ethereum focus `#455A96` | 5.48:1 | Pass for text and 3:1 focus indicator requirement |
| Success `#285C46` | 6.38:1 | Pass |
| Danger `#8A352E` | 6.58:1 | Pass |
| Canvas grain `#74736A` | 3.93:1 | Pass for non-text graphics |

The prior token mismatch is resolved: the declaration and all reviewed uses consistently reference `--secondary-ink`. No `--ink-secondary` references remain in the audited styles.

## Browser evidence reviewed

The release owner reported the following direct browser checks on the remediated build:

- 320 CSS px viewport: no horizontal overflow;
- canvas keyboard operation: arrow keys change the selected market period;
- dialog: focus entry, Escape dismissal, and focus restoration work;
- event chronology: exactly one event button is in the Tab sequence, with arrow navigation available inside the group.

These checks close the runtime risks that source-only inspection could not settle in the first audit.

## Checks rerun

- `node --test tests/narrative-contract.test.mjs tests/event-geometry.test.mjs` — **20/20 passed**.
- `npm run typecheck` — **passed**.
- Manual source re-inspection of `EthRings.tsx`, `NarrativeShell.tsx`, `NarrativeShell.module.css`, `globals.css`, and the focused tests — **passed for the remediated scope**.
- `git diff --check -- docs/qa/accessibility-audit.md` — run after report update.

## Non-blocking follow-up

Convert the supplied browser QA scenarios into durable Playwright tests and add an automated axe scan for the closed page, open dialog, loading/error states, and selected-event state. A brief VoiceOver and NVDA smoke test should confirm how each announces the custom `interactive chart` role description and the concise live status. These are regression-hardening recommendations, not open release failures.
