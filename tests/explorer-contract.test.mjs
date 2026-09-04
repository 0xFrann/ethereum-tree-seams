import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const explorer = await readFile(new URL("../app/components/EthRings.tsx", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

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
  assert.match(explorer, /className="price-range readout-line"/);
  assert.match(explorer, /Volatility/);
  assert.match(explorer, /const volatilityPercent = averagePrice/);
  assert.match(explorer, /const volatilityLabel =/);
  assert.match(explorer, /Average price/);
  assert.match(explorer, /month\.averageClose/);
  assert.match(explorer, /month\.low/);
  assert.match(explorer, /month\.high/);
  assert.match(explorer, /hasDetailedPriceStats/);
  assert.doesNotMatch(explorer, /returnPct|Monthly return|Year return|signedPercent/);
});

test("keeps semantic event selection while canvas marks inherit their month interaction", () => {
  assert.match(explorer, /const \[eventSelection, setEventSelection\]/);
  assert.match(explorer, /const marketForEvent/);
  assert.match(explorer, /const selectEvent/);
  assert.match(explorer, /if \(next\) selectMarket\(next, true\)/);
  assert.doesNotMatch(explorer, /hitTestEvent\(geometry/);
  assert.match(explorer, /<EventNote item=\{selectedEvent\}/);
});

test("puts the formerly scrolling content behind labelled accessible dialogs", () => {
  assert.match(explorer, /createPortal/);
  assert.match(explorer, /stage\?\.setAttribute\("inert", ""\)/);
  assert.match(explorer, /role="dialog" aria-modal="true"/);
  assert.match(explorer, /StageDialog title="Knots"/);
  assert.match(explorer, /Data and source/);
  assert.match(explorer, /How the rings are built/);
  assert.doesNotMatch(explorer, /className="event-index"|className="methodology"/);
});

test("keeps scars out of the visible and selectable explorer UI", () => {
  assert.doesNotMatch(explorer, /data\.scars|Scar|scar/);
  assert.doesNotMatch(globalStyles, /key-scar/);
});

test("keeps a compact responsive fallback for narrow or short viewports", () => {
  assert.match(globalStyles, /@media \(max-width: 719px\), \(max-height: 620px\)/);
  assert.match(globalStyles, /\.graph-stage \{ width: min\(82vw, 58dvh\)/);
  assert.match(globalStyles, /@media \(max-width: 390px\), \(max-height: 500px\)/);
  assert.match(globalStyles, /env\(safe-area-inset-top\)/);
});
