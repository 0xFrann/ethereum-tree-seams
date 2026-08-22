import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../app/components/NarrativeShell.tsx", import.meta.url);
const stylesUrl = new URL("../app/components/NarrativeShell.module.css", import.meta.url);
const component = await readFile(componentUrl, "utf8");
const styles = await readFile(stylesUrl, "utf8");
const explorer = await readFile(new URL("../app/components/EthRings.tsx", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("uses a deterministic session-only entrance state", () => {
  assert.match(component, /useState<NarrativeMode>\("checking-session"\)/);
  assert.match(component, /ethereum-rings:introduction:v1/);
  assert.match(component, /window\.sessionStorage\.getItem/);
  assert.match(component, /window\.sessionStorage\.setItem/);
  assert.doesNotMatch(component, /localStorage|document\.cookie/);
  assert.match(component, /catch \{[\s\S]*memory-only/);
});

test("keeps the explorer subtree mounted exactly once", () => {
  assert.equal(component.match(/\{children\}/g)?.length, 1);
  assert.match(component, /inert=\{blocked\}/);
  assert.match(component, /aria-hidden=\{blocked \? true : undefined\}/);
  assert.match(component, /id\(EXPLORER_ENTRY_ID\)|getElementById\(EXPLORER_ENTRY_ID\)/);
});

test("ships the accepted 46-word introduction", () => {
  const paragraphs = [...component.matchAll(/^\s+"(Trees keep[^\n]+|The outer ring[^\n]+)",$/gm)].map(
    (match) => match[1],
  );
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs.join(" ").trim().split(/\s+/).length, 46);
  assert.match(component, /A living market archive/);
  assert.match(component, /Enter the rings →/);
  assert.match(component, /Return to the rings/);
});

test("implements labelled modal, explicit close, Escape, and focus restoration", () => {
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-labelledby=\{headingId\}/);
  assert.match(component, /aria-describedby=\{descriptionId\}/);
  assert.match(component, /aria-label="Close introduction"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key !== "Tab"/);
  assert.match(component, /pendingFocusRef/);
  assert.match(component, /rings-explorer-entry/);
});

test("provides a persistent labelled reopen control and visible tooltip", () => {
  assert.match(component, /aria-label="About this experiment"/);
  assert.match(component, /role="tooltip"/);
  assert.match(component, /aria-describedby=\{controls\.tooltipId\}/);
  assert.match(styles, /\.reopenControl:hover \.tooltip,[\s\S]*\.reopenControl:focus-within \.tooltip/);
  assert.doesNotMatch(component, /title="About this experiment"/);
  assert.match(styles, /\.reopenButton\s*\{[\s\S]*width:\s*30px;[\s\S]*height:\s*30px;/);
  assert.match(styles, /\.reopenButton::before\s*\{[\s\S]*inset:\s*-7px;/);
  assert.doesNotMatch(styles, /\.reopenButton > span \{[^}]*border:/);
});

test("locks scrolling without making animation a behavior gate", () => {
  assert.match(component, /body\.style\.overflow = "hidden"/);
  assert.match(component, /scrollbarWidth = window\.innerWidth - document\.documentElement\.clientWidth/);
  assert.match(component, /body\.style\.paddingRight = `\$\{scrollbarWidth\}px`/);
  assert.match(component, /window\.scrollTo/);
  assert.doesNotMatch(component, /transitionend|animationend/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /animation-duration:\s*40ms/);
  assert.doesNotMatch(styles, /^\s*transform:/m);
});

test("supports mobile viewport, zoom reflow, and safe-area targets", () => {
  assert.match(styles, /min-height:\s*100dvh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /@media \(max-width: 899px\)/);
  assert.match(styles, /\.enterButton\s*\{\s*width:\s*100%;/);
  assert.doesNotMatch(styles, /overflow-x:\s*(hidden|clip)/);
});

test("keeps explorer states and interaction semantics explicit", () => {
  assert.match(explorer, /Preparing specimen/);
  assert.match(explorer, /Market specimen unavailable/);
  assert.match(explorer, /No protocol milestones or security scars are available/);
  assert.match(explorer, /role="group"/);
  assert.match(explorer, /aria-roledescription="interactive chart"/);
  assert.match(explorer, /role="status" aria-live="polite"/);
  assert.match(explorer, /visibilitychange/);
  assert.match(explorer, /document\.visibilityState === "hidden"/);
  assert.doesNotMatch(explorer, /setInterval\(refresh/);
  assert.match(globalStyles, /\.canvas-shell \{ width: min\(100%, 440px\); \}/);
});

test("keeps chart interaction month-based and restores the latest month when idle", () => {
  assert.match(explorer, /const idleSelection = useMemo<Selection>/);
  assert.match(explorer, /if \(event\.pointerType === "mouse"\) restoreIdleSelection\(\)/);
  assert.match(explorer, /const market = marketAt\(event\.clientX, event\.clientY, "fine"\)/);
  assert.match(explorer, /selectedEvents\.map/);
  assert.doesNotMatch(explorer, /hitTestInteractive|commitEvent|eventPreview|setEventSelection|eventSelectionRef/);
  assert.match(explorer, /<article key=\{key\} className="event-card">/);
  assert.doesNotMatch(explorer, /className="event-button"/);
});

test("uses a cohesive instrument rail and quiet control highlights", () => {
  assert.match(globalStyles, /\.instrument-column \{[^}]*min-height: calc\(100svh - clamp\(28px, 4vw, 48px\)\);[^}]*border-left: 1px solid var\(--line-strong\);[^}]*align-self: stretch;/);
  assert.match(globalStyles, /\.selector-block \{[^}]*border-bottom: 1px solid var\(--line\);[^}]*grid-template-columns: 112px/);
  assert.match(globalStyles, /\.year-button\[aria-pressed="true"\], \.month-button\[aria-pressed="true"\] \{[^}]*color: var\(--ink\);[^}]*background: rgb\(23 26 23 \/ 6%\);/);
  assert.match(globalStyles, /\.year-button\[aria-pressed="true"\]::after, \.month-button\[aria-pressed="true"\]::after \{[^}]*height: 2px;[^}]*background: var\(--ink\);/);
  assert.match(explorer, /01 \/ <\/span>Market year/);
  assert.match(explorer, /02 \/ <\/span>Observed month/);
  assert.match(explorer, /03 \/ <\/span>Market reading/);
});

test("keeps the instrument hierarchy compact", () => {
  assert.match(globalStyles, /\.project-intro h1 \{[^}]*clamp\(18px,/);
  assert.match(globalStyles, /\.readout-grid \{[^}]*grid-template-columns: \.8fr \.8fr 1\.4fr;/);
  assert.match(explorer, /formatUpdatedTimestamp/);
  assert.match(explorer, /className="event-meta"/);
  assert.match(explorer, /String\(eventIndex \+ 4\)\.padStart\(2, "0"\)/);
  assert.doesNotMatch(explorer, /item\.record\.summary/);
  assert.doesNotMatch(explorer, /item\.record\.recoveryStatus/);
  assert.doesNotMatch(explorer, /item\.record\.confidence/);
});

test("keeps graph selection and metadata monochrome", () => {
  assert.match(globalStyles, /--ring-accent: #171a17/);
  assert.match(globalStyles, /--ring-event-accent: #171a17/);
  assert.match(globalStyles, /--ring-bark: #6b6d66/);
  assert.match(explorer, /styles\.getPropertyValue\("--paper"\)\.trim\(\)/);
  assert.match(globalStyles, /\.return-stamp \.positive, \.return-stamp \.negative \{ color: var\(--ink\); \}/);
  assert.match(globalStyles, /\.source-note a \{[^}]*color: var\(--secondary-ink\);/);
});

test("keeps one dedicated method section and separate event and method links", () => {
  assert.match(explorer, />Market data ↗<\/a>/);
  assert.match(explorer, /<a href="#events">Knots \+ scars ↓<\/a>/);
  assert.match(explorer, /<a href="#method">Method ↓<\/a>/);
  assert.doesNotMatch(explorer, /\* Price from:/);
  assert.match(explorer, /<section id="events" className="event-index"/);
  assert.match(explorer, /<section id="method" className="methodology" aria-labelledby="method-title">/);
  assert.match(explorer, /How the rings are built/);
  assert.doesNotMatch(explorer, /construction-drawer|Method & events/);
  assert.match(explorer, /Four close-price samples per month → ln\(price\) → −1…\+1/);
  assert.match(explorer, /Monthly average daily USD volume → log<sub>10<\/sub>\(volume\) → 0…1/);
  assert.match(explorer, /R<sub>y<\/sub>\(θ\) = R<sub>y−1<\/sub>\(θ\) \+ 0\.9g \+ 0\.39g · price<sub>y<\/sub>\(θ\)/);
  assert.match(explorer, /clearance prevents collisions/);
  assert.match(globalStyles, /\.methodology \{ display: grid; grid-template-columns: minmax\(180px, \.25fr\) 1fr/);
  assert.match(globalStyles, /\.source-note \{[^}]*display: grid;/);
  assert.match(globalStyles, /\.method-steps sub \{[^}]*font-size: \.9em;/);
  assert.doesNotMatch(globalStyles, /\.construction-drawer|\.construction-panel/);
});
