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

test("reads the plate from the document's arrow keys rather than from a tab stop", () => {
  // A focus ring on the canvas box stood well outside the calendar ring and
  // read as one more circle the specimen had not earned.
  assert.match(explorer, /aria-roledescription="interactive chart" tabIndex=\{-1\}/);
  assert.doesNotMatch(explorer, /tabIndex=\{0\}/);
  assert.doesNotMatch(globalStyles, /rings-canvas:focus-visible/);
  assert.match(globalStyles, /\.rings-canvas:focus \{ outline: none; \}/);
  // Still focusable, because the retry path hands focus to the loaded specimen.
  assert.match(explorer, /entryTargetRef\.current = node/);
  assert.match(explorer, /document\.addEventListener\("keydown", handleArrowKey\)/);
  assert.match(explorer, /document\.removeEventListener\("keydown", handleArrowKey\)/);
  // An open sheet owns the keyboard, including the arrows that scroll its body.
  assert.match(explorer, /if \(dialog\) return;/);
  // A modified arrow is a browser shortcut; a focused control owns its own keys.
  assert.match(explorer, /if \(event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey \|\| event\.shiftKey\) return;/);
  assert.match(explorer, /closest\("button, a\[href\]/);
  // The reading comes from the ref, not from a closure: a listener that
  // depended on the selection would re-register per frame of a pointer scrub.
  assert.match(explorer, /const selection = selectionRef\.current;/);
  // The arrow keys are the description's business, not the name's: the name is
  // read on every landing and would recite them every time.
  assert.match(explorer, /id="rings-instructions" className="sr-only">Arrow keys/);
  assert.doesNotMatch(explorer, /aria-label=\{`Interactive Ethereum annual rings[^`]*arrows/);
});

test("teaches the arrow keys in the plate's own margin", () => {
  assert.match(explorer, /<p className="rings-hint" aria-hidden="true">/);
  // The glyphs carry the instruction, so they are set above the label type the
  // words are in; at 12px in Courier an arrow is barely a mark.
  assert.match(explorer, /<span className="rings-hint-keys">← →<\/span>Months<span className="rings-hint-keys">↑ ↓<\/span>Years/);
  assert.match(globalStyles, /\.rings-hint-keys \{[^}]*font-size: 17px;/);
  assert.match(globalStyles, /\.rings-hint-keys \+ \.rings-hint-keys \{ margin-left: 2\.2rem; \}/);
  // A caption on the plate: it travels with the specimen and never takes the
  // pointer off it.
  assert.match(globalStyles, /\.rings-hint \{[^}]*position: absolute;[^}]*pointer-events: none;/);
  // No arrow keys on a touch screen, and no paper for a caption once the credit
  // has walked up into the plate's margin.
  assert.match(globalStyles, /@media \(hover: none\), \(pointer: coarse\), \(max-height: 880px\) \{ \.rings-hint \{ display: none; \} \}/);
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
