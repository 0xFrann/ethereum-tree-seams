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
});

test("keeps the explorer subtree mounted and the narrative modal labelled", () => {
  assert.equal(component.match(/\{children\}/g)?.length, 1);
  assert.match(component, /inert=\{blocked\}/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-label="Read introduction"/);
  assert.match(styles, /\.reopenControl \{[\s\S]*bottom:/);
});

test("ships the accepted introduction and preserves its close behavior", () => {
  assert.match(component, /A living market archive/);
  assert.match(component, /Enter the rings →/);
  assert.match(component, /Return to the rings/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /window\.scrollTo/);
});

test("builds a no-scroll viewport stage with centered graph and six edge regions", () => {
  assert.match(globalStyles, /\.explorer-stage \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);
  assert.match(globalStyles, /\.graph-stage \{[^}]*top: 50%;[^}]*left: 50%;/);
  assert.match(globalStyles, /width: clamp\(760px, 68vmin, 920px\)/);
  assert.match(explorer, /className="stage-title"/);
  assert.match(explorer, /className="stage-provenance"/);
  assert.match(explorer, /className="stage-price"/);
  assert.match(explorer, /className="selected-mark"/);
  assert.match(explorer, /className="stage-more"/);
  assert.match(explorer, /className="stage-credit"/);
});

test("uses price observations rather than returns", () => {
  assert.match(explorer, /Observed price range/);
  assert.match(explorer, /Range volatility/);
  assert.match(explorer, /const volatilityPercent = \(\(priceHigh - priceLow\) \/ averagePrice\) \* 100/);
  assert.match(explorer, /const volatilityLabel =/);
  assert.match(explorer, /Average price/);
  assert.match(explorer, /month\.averageClose/);
  assert.match(explorer, /month\.low/);
  assert.match(explorer, /month\.high/);
  assert.match(explorer, /hasDetailedPriceStats/);
  assert.doesNotMatch(explorer, /returnPct|Monthly return|Year return|signedPercent/);
});

test("makes one event selectable rather than flattening it into a monthly readout", () => {
  assert.match(explorer, /const \[eventSelection, setEventSelection\]/);
  assert.match(explorer, /const marketForEvent/);
  assert.match(explorer, /const selectEvent/);
  assert.match(explorer, /if \(next\.event\) selectEvent\(next\.event, true\)/);
  assert.match(explorer, /<EventNote item=\{selectedEvent\}/);
});

test("puts the formerly scrolling content behind labelled accessible dialogs", () => {
  assert.match(explorer, /createPortal/);
  assert.match(explorer, /stage\?\.setAttribute\("inert", ""\)/);
  assert.match(explorer, /role="dialog" aria-modal="true"/);
  assert.match(explorer, /Choose an observed period/);
  assert.match(explorer, /Knots and scars/);
  assert.match(explorer, /Data and source/);
  assert.match(explorer, /How the rings are built/);
  assert.doesNotMatch(explorer, /className="event-index"|className="methodology"/);
});

test("keeps a compact responsive fallback for narrow or short viewports", () => {
  assert.match(globalStyles, /@media \(max-width: 719px\), \(max-height: 620px\)/);
  assert.match(globalStyles, /\.graph-stage \{ width: min\(82vw, 58dvh\)/);
  assert.match(globalStyles, /@media \(max-width: 390px\), \(max-height: 500px\)/);
  assert.match(globalStyles, /env\(safe-area-inset-top\)/);
});
