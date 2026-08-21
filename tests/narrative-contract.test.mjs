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
  assert.match(component, /aria-label="Read introduction"/);
  assert.match(component, /role="tooltip"/);
  assert.match(component, /aria-describedby=\{tooltipVisible \? tooltipId : undefined\}/);
  assert.doesNotMatch(component, /title="Read introduction"/);
  assert.match(styles, /\.reopenButton\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
});

test("locks scrolling without making animation a behavior gate", () => {
  assert.match(component, /body\.style\.position = "fixed"/);
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

test("uses solid dark control highlights without outlined boxes", () => {
  assert.match(globalStyles, /\.year-button\[aria-pressed="true"\], \.month-button\[aria-pressed="true"\] \{[^}]*color: var\(--paper\);[^}]*background: var\(--ink\);/);
  assert.match(globalStyles, /\.year-button:focus-visible, \.month-button:focus-visible \{ outline: 0;[^}]*background: var\(--secondary-ink\);/);
});

test("keeps graph selection and metadata monochrome", () => {
  assert.match(globalStyles, /--ring-accent: #171a17/);
  assert.match(globalStyles, /--ring-event-accent: #171a17/);
  assert.match(globalStyles, /--ring-bark: #6b6d66/);
  assert.match(explorer, /styles\.getPropertyValue\("--paper"\)\.trim\(\)/);
  assert.match(globalStyles, /\.return-stamp \.positive, \.return-stamp \.negative \{ color: var\(--ink\); \}/);
  assert.match(globalStyles, /\.source-note a \{ color: var\(--secondary-ink\); \}/);
});

test("offers an upward construction drawer with the additive ring method", () => {
  assert.match(explorer, /<details className="construction-drawer">/);
  assert.match(explorer, /<summary aria-label="Read how market data is transformed into rings">Method\?<\/summary>/);
  assert.match(explorer, /Four close-price samples per month → ln\(price\) → −1…\+1/);
  assert.match(explorer, /Monthly average daily USD volume → log₁₀\(volume\) → 0…1/);
  assert.match(explorer, /Rᵧ\(θ\) = Rᵧ₋₁\(θ\) \+ 0\.9g \+ 0\.39g · priceᵧ\(θ\)/);
  assert.match(explorer, /clearance prevents collisions/);
  assert.match(globalStyles, /\.construction-drawer \{ position: absolute;[^}]*bottom: 6px;[^}]*left: 50%;/);
  assert.match(globalStyles, /\.construction-drawer summary \{[^}]*white-space: nowrap;/);
  assert.match(globalStyles, /\.construction-panel \{ position: absolute; bottom: 33px;/);
  assert.match(globalStyles, /\.construction-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(globalStyles, /\.construction-drawer summary \{[^}]*font: 650 11px\/1 var\(--font-mono\)/);
  assert.match(globalStyles, /\.construction-grid p, \.construction-grid code \{[^}]*font: 11px\/1\.5 var\(--font-mono\)/);
  assert.doesNotMatch(globalStyles, /\.construction-drawer(?:\[open\])? summary::after/);
});
