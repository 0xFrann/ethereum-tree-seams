import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const beatsOf = (src) => Object.fromEntries(
  [...src.matchAll(/(\w+): \{ start: (\d+), duration: (\d+) \}/g)]
    .map(([, name, start, duration]) => [name, { start: Number(start), duration: Number(duration) }]),
);

const read = (name) => readFile(new URL(`../app/components/${name}`, import.meta.url), "utf8");

// The motion module is plain TypeScript with no imports; strip the types and
// run it, so the schedule can be measured rather than merely grepped.
const importMotion = async () => {
  const ts = await import("typescript");
  const { outputText } = ts.default.transpileModule(await read("eth-rings/motion.ts"), {
    compilerOptions: { module: ts.default.ModuleKind.ESNext, target: ts.default.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
};

const motion = await read("eth-rings/motion.ts");
const explorer = await read("EthRings.tsx");
const odometer = await read("eth-rings/Odometer.tsx");
const typeOn = await read("eth-rings/TypeOn.tsx");
const useMotion = await read("eth-rings/use-motion.ts");
const renderer = await read("eth-rings/renderer.ts");
const shell = await read("NarrativeShell.tsx");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("plays the page from one score, in the order the sheet is made", () => {
  const beats = Object.fromEntries(
    [...motion.matchAll(/(\w+): \{ start: (\d+), duration: (\d+) \}/g)]
      .map(([, name, start, duration]) => [name, { start: Number(start), duration: Number(duration) }]),
  );
  // Label the sheet, mount the specimen and place the instrument on it, take
  // the reading, and only then annotate it. The label, the specimen and the
  // readout share the downbeat: the growth front opens so slowly that holding
  // them back reads as hesitation rather than as precedence.
  assert.ok(beats.header.start <= beats.plate.start, "the sheet is labelled no later than the specimen is mounted");
  assert.equal(beats.plate.start, beats.header.start, "the plate opens on the header's downbeat");
  // The readout is a caption on the growth, not a second animation about it,
  // so it opens with the front rather than after the specimen is finished.
  assert.equal(beats.readout.start, beats.plate.start, "the reading opens on the plate's downbeat");
  // The reading lands on the calendar's last step, with no gap: the circle
  // closes and the plate resolves into the reading in one movement.
  assert.equal(beats.wash.start, beats.index.start + beats.index.duration, "the reading lands as the circle closes");
  assert.ok(beats.wash.start < beats.note.start, "the note annotates a reading already taken");
  // The note's content is a function of the selected month, so it must not
  // exist while the calendar is still moving the reading through months.
  assert.ok(beats.index.start + beats.index.duration <= beats.note.start, "the calendar finishes before the note arrives");
  // Beats overlap; strict back-to-back beats leave dead air between them.
  assert.ok(beats.plate.start < beats.header.start + beats.header.duration, "beats cascade rather than queue");
  // The calendar waits for the plate to finish rather than closing it out, so
  // it reads as its own arrival instead of the tail of the growth — and it
  // waits long enough for the finished shape to be seen still first, with the
  // reading resting on the last year's January.
  assert.ok(beats.index.start - (beats.plate.start + beats.plate.duration) >= 800, "the calendar pauses before its first month");
  // The plate no longer hands off to a separate spin-up of the numbers.
  assert.ok(!beats.sweep, "the reading must not travel in a beat of its own");
  // Knots are no longer a beat at all; they ride the front with the rings.
  assert.ok(!beats.knots, "knots must not have a phase of their own");
  // The growth is the centrepiece and is paced to be watched.
  const longest = Object.entries(beats).sort((a, b) => b[1].duration - a[1].duration)[0][0];
  assert.equal(longest, "plate", "the plate must be the longest beat on the page");
  // A breath between the sheet being finished and being annotated.
  assert.ok(beats.note.start > beats.index.start + beats.index.duration, "the finished sheet is held before the note");
  // Ring weight is a property of the front, not a beat of its own.
  assert.doesNotMatch(motion, /weight: \{ start:/);
});

test("keeps every beat on the one clock", () => {
  // Timing used to live in the score, in CSS transition delays and in the
  // typing timers at once, related only by when a class happened to flip.
  assert.match(explorer, /if \(elapsed >= SCORE\.header\.start\) fireCue\("header"\)/);
  assert.doesNotMatch(explorer, /SCORE\.knots/);
  assert.match(explorer, /if \(elapsed >= SCORE\.plate\.start\) fireCue\("plate"\)/);
  assert.match(explorer, /if \(elapsed >= SCORE\.readout\.start\) fireCue\("readout"\)/);
  assert.match(explorer, /if \(elapsed >= SCORE\.note\.start\) fireCue\("note"\)/);
  // No stray delays in the stylesheet competing with the score.
  assert.doesNotMatch(styles, /\.is-\w+ \.[\w-]+ \{ opacity: 1; transition: opacity [\d.]+s ease \.\d+s/);
  assert.doesNotMatch(styles, /is-annotated/);
  // The live edge belongs to the finished specimen, not to an empty sheet: it
  // marks the outermost ring as still growing in reality, which only reads
  // once that ring exists to grow from.
  assert.match(explorer, /if \(elapsed >= PLATE_END\) fireCue\("grown"\)/);
  assert.match(styles, /\.is-grown \.growth-frontier \{ animation: frontier-breath/);
  assert.doesNotMatch(styles, /\.is-plate \.growth-frontier/);
});

test("opens the reading where the drawing opens, not at the present", () => {
  // The readout used to appear after the plate was finished, showing the
  // present month, then snap back to January and spin forward to where it
  // started — a second animation about a fact the plate had just spent six
  // seconds stating. It now opens on the pith with the front.
  assert.match(explorer, /useState<Selection>\(\{ year: firstArchiveYear, month: 0 \}\)/);
  // Nothing is announced until the reading is final.
  assert.match(explorer, /const \[announceSelection, setAnnounceSelection\] = useState\(false\)/);
  // The path that plays no reveal still lands on the present.
  assert.match(explorer, /setSelection\(idleSelection\);/);
});

test("grows the plate organically rather than assembling it in passes", () => {
  // Every line arrives at the front as the same thin stroke — ghost grain and
  // year ring alike — and weight follows well behind, so the plate exists first
  // as a uniform drawing and only then takes on its final form.
  assert.match(renderer, /function frontAlpha\(reveal: \{ radius: number; feather: number \} \| undefined, mean: number\)/);
  assert.match(renderer, /const arrival = frontAlpha\(reveal, mean\)/);
  assert.match(renderer, /const WEIGHT_LAG_GAPS = ([\d.]+)/);
  assert.match(renderer, /const weight = clamp01\(\(reveal\.radius - mean - gap \* WEIGHT_LAG_GAPS\) \/ \(gap \* WEIGHT_SPAN_GAPS\)\)/);
  const lag = Number(renderer.match(/const WEIGHT_LAG_GAPS = ([\d.]+)/)[1]);
  assert.ok(lag >= 1, "weight must trail the line by at least a full ring gap to read as growth");
  // The lag is measured in gaps, not in the front's feather: the feather is
  // narrower than a line spacing, and a lag tied to it would arrive with the line.
  assert.doesNotMatch(renderer, /FEATHERS/);

  // Knots swell from a seed on their own ring instead of being punched into a
  // finished plate at the end.
  assert.match(renderer, /const KNOT_LAG_GAPS = [\d.]+/);
  assert.match(renderer, /KNOT_MINIMUM_SCALE \+ \(1 - KNOT_MINIMUM_SCALE\) \* grown/);
  assert.doesNotMatch(renderer, /knots: number;/);

  // The front's travel is derived, so nothing is stranded part-grown and the
  // front never runs on through empty space after the last mark is finished.
  assert.match(renderer, /export function revealFrontEnd/);
  // The stops end at that derived reach, so the closing step covers exactly the
  // travel the trailing weight still needs.
  assert.match(renderer, /stops\.push\(revealFrontEnd\(geometry, feather\)\)/);
  assert.match(explorer, /const stops = revealStops\(geometry, feather\)/);

  // A smooth ramp gives the beat no rhythm. The front steps line by line: the
  // first lines land and hold, and the ones after gather pace over the first
  // rings until they are coming one a frame.
  assert.match(motion, /export function buildSchedule/);
  assert.match(motion, /export function buildRamp/);
  assert.match(explorer, /buildRamp\(stops\.length, PLATE_RAMP\.ramp, PLATE_RAMP\.range, PLATE_RAMP\.curve, PLATE_RAMP\.hold, PLATE_RAMP\.finale\)/);
  assert.match(explorer, /radiusAtStop\(stops, schedule\(/);
  assert.match(explorer, /index: indexSchedule\(/);
  assert.match(renderer, /export function revealStops/);
  // One stop per line of the drawing — every ghost contour and every inked
  // ring — not one per year. A year is six lines, and stepping a year at a
  // time made them arrive as a block.
  assert.match(renderer, /\.\.\.geometry\.grain\.map\(\(contour\) => contour\.mean\)/);
  assert.match(renderer, /\.\.\.geometry\.rings\.map\(\(ring\) => \{/);
  // The feather is narrower than a line spacing would make a block of, so
  // lines land one at a time, but wide enough that neighbours stir together.
  const feather = Number(motion.match(/FRONT_FEATHER_GAPS = ([\d.]+)/)[1]);
  assert.ok(feather > 1 / 6, "the feather must reach the next line so layers, not slices, emerge");
  assert.ok(feather < 0.5, "the feather must be narrower than half a gap or lines land as a block");
  // The plan is a function of the geometry and is rebuilt with it, not per frame.
  assert.match(explorer, /revealPlanRef\.current = planReveal\(geometry\);/);
  // The closing movement is given room instead of being swept up in the build.
  assert.match(motion, /PLATE_RAMP = \{ ramp: \d+, range: \d+, curve: easeInQuad, hold: [\d.]+, finale: [\d.]+ \}/);
  // The canvas keeps drawing until the calendar has closed the sheet.
  assert.match(motion, /export const DRAW_END/);
  assert.match(explorer, /if \(elapsed < DRAW_END\)/);
  // The plate runs under the header rather than after it.
  assert.ok(beatsOf(motion).plate.start < beatsOf(motion).header.duration, "the plate overlaps the header");
  // No travelling hard edge: the old clip reveal is gone.
  assert.doesNotMatch(renderer, /grainRadius|inkRadius/);
});

test("paces the lines slowly at first, gathering pace, then a line a frame", async () => {
  const { buildRamp, buildSchedule, PLATE_RAMP, SCORE } = await importMotion();

  // Time each line owns — its travel and the hold on it — measured off the
  // schedule itself as the moment the front leaves it for the next. Seventy
  // steps is about what the plate has: fourteen ghost lines to the first
  // market ring, six lines a year after that, and the closing step.
  const steps = 70;
  const schedule = buildRamp(steps, PLATE_RAMP.ramp, PLATE_RAMP.range, PLATE_RAMP.curve, PLATE_RAMP.hold, PLATE_RAMP.finale);
  const departures = [0];
  for (let stop = 1; stop < steps; stop += 1) {
    let t = 0;
    while (t < 1 && schedule(t) * steps <= stop + 1e-6) t += 1e-5;
    departures.push(t);
  }
  departures.push(1);
  const spans = departures.slice(1).map((at, index) => at - departures[index]);
  const ms = spans.map((span) => span * SCORE.plate.duration);

  // The opening is slow and stays slow: the first line is presented rather
  // than flashed, and the first four lines all take more than half of it.
  // The Fibonacci series failed exactly here — it halved by the third line.
  assert.ok(ms[0] >= 600, "the first line is presented, not flashed");
  for (let index = 1; index < 4; index += 1) {
    assert.ok(ms[index] > ms[0] * 0.5, `line ${index + 1} must still be slow`);
  }
  // Then it gathers pace: every line in the ramp is faster than the one
  // before it, and the ramp is long enough to be watched — several rings.
  assert.ok(PLATE_RAMP.ramp >= 12, "the ramp must span at least two rings of lines");
  for (let index = 1; index < PLATE_RAMP.ramp; index += 1) {
    assert.ok(ms[index] < ms[index - 1], `line ${index + 1} must come faster than line ${index}`);
  }
  // The acceleration breaks late rather than immediately: the second half of
  // the ramp speeds up by a larger factor than the first.
  const half = Math.floor(PLATE_RAMP.ramp / 2);
  assert.ok(ms[half] / ms[0] > ms[PLATE_RAMP.ramp] / ms[half], "the pace breaks late in the ramp");
  // Past the ramp the rush simply runs: one line a frame, never two in one
  // frame and never a line stalled over several.
  const rush = ms.slice(PLATE_RAMP.ramp, steps - 1);
  assert.ok(rush.length > 40, "most of the plate is laid down in the rush");
  rush.forEach((line, index) => {
    assert.ok(line >= 16 && line <= 34, `rush line ${PLATE_RAMP.ramp + index + 1} is ${line.toFixed(1)}ms; wanted about a frame`);
  });
  // The ramp owns the beat.
  assert.ok(spans.slice(0, PLATE_RAMP.ramp).reduce((sum, span) => sum + span, 0) > 0.6, "the ramp owns the beat");
  // The finale is given room of its own after the rush.
  assert.ok(ms[steps - 1] > 300, "the closing movement has room");

  const plain = buildSchedule([1, 1, 0.5], [0, 0, 0]);
  assert.equal(plain(1), 1);
  assert.equal(plain(0), 0);
});

test("strikes January, holds it, then closes the circle in one sweep", async () => {
  const { indexSchedule, INDEX_BEAT, INDEX_DURATION, SCORE } = await importMotion();
  // The beat in the score is exactly the three gestures laid end to end.
  assert.equal(SCORE.index.duration, INDEX_DURATION);
  // January is presented and held before anything else happens.
  assert.ok(INDEX_BEAT.january >= 300, "January is presented, not flashed");
  assert.ok(INDEX_BEAT.hold >= 150, "and held");
  // Nothing but the circle and the wedge moves until the circle has closed.
  assert.equal(SCORE.wash.start, SCORE.index.start + INDEX_DURATION);
  const t = (ms) => ms / INDEX_DURATION;
  assert.equal(indexSchedule(t(INDEX_BEAT.january)), 1 / 12);
  assert.equal(indexSchedule(t(INDEX_BEAT.january + INDEX_BEAT.hold / 2)), 1 / 12);
  // The rest of the year is one continuous movement, not eleven stops: it is
  // strictly under way at every point of the sweep, and lands on December.
  const sweepStart = INDEX_BEAT.january + INDEX_BEAT.hold;
  let previous = indexSchedule(t(sweepStart));
  for (let ms = sweepStart + 10; ms < INDEX_DURATION; ms += 10) {
    const value = indexSchedule(t(ms));
    assert.ok(value > previous, `the sweep must not pause at ${ms}ms`);
    previous = value;
  }
  assert.equal(indexSchedule(1), 1);
  // Starting slow: the first half of the sweep covers less of the year than
  // the second... and it lands rather than stops, so the last tenth is slow too.
  const mid = indexSchedule(t(sweepStart + INDEX_BEAT.sweep / 2));
  assert.ok(Math.abs(mid - (1 / 12 + 11 / 24)) < 1e-9, "the sweep is symmetric about its middle");
  const early = indexSchedule(t(sweepStart + INDEX_BEAT.sweep * 0.2)) - 1 / 12;
  const middle = indexSchedule(t(sweepStart + INDEX_BEAT.sweep * 0.6)) - indexSchedule(t(sweepStart + INDEX_BEAT.sweep * 0.4));
  assert.ok(early < middle, "the sweep starts slow and runs through the middle");
  // The month-by-month schedules are gone; the calendar is not stepped.
  assert.doesNotMatch(motion, /buildAccelerando|INDEX_ACCELERANDO|INDEX_RAMP/);
});

test("strikes the header as a chain, labels included", () => {
  // The provenance labels used to sit there unanimated while their own values
  // typed in beneath them.
  assert.match(explorer, /<dt><TypeOn text=\{label\}/);
  assert.match(explorer, /<h1><TypeOn text="ETH_TREE_01"/);
  // Chained off the real text, so the rhythm survives a change of wording.
  assert.match(motion, /export function chainDelays/);
  assert.match(explorer, /const at = chainDelays\(links\)/);
  // The identity lines present; the provenance rows are a detail and rattle by.
  const titleSpeed = Number(motion.match(/TITLE_SPEED_MS = (\d+)/)[1]);
  const detailSpeed = Number(motion.match(/DETAIL_SPEED_MS = (\d+)/)[1]);
  const titleHold = Number(motion.match(/TITLE_HOLD_MS = (\d+)/)[1]);
  const detailHold = Number(motion.match(/DETAIL_HOLD_MS = (\d+)/)[1]);
  assert.ok(titleSpeed > detailSpeed * 2, "the identity lines are set at a presenting pace");
  assert.ok(titleHold > detailHold * 2, "and hold before the next line begins");
});

test("keeps the front's own cost off the critical path", () => {
  // Bark is ~200 draw calls and the grain is ~50 long strokes; redrawing them
  // every frame costs far more than a frame budget, so settled work is baked.
  assert.match(renderer, /export function drawBarkLayer/);
  assert.match(renderer, /export function settledGrainCount/);
  assert.match(renderer, /export function bakeGrain/);
  assert.match(explorer, /bakeGrain\(grainLayer\.context, geometry, built\.colors, settledGrainRef\.current, settled\)/);
  // A rebuild invalidates anything baked against the previous geometry.
  assert.match(explorer, /settledGrainRef\.current = 0;/);
  // The front's reach is derived from the geometry, so the last contours are
  // never still part-drawn when the plate hands off.
  assert.match(explorer, /radiusAtStop\(stops, schedule\(/);
});

test("rolls the reading with the drawing rather than after it", () => {
  // The year the readout shows is the year the front is laying down, so the
  // number is a caption on the ring being drawn and the reader learns what
  // the widening means while it is still widening.
  assert.match(renderer, /export function yearReach/);
  assert.match(renderer, /export function yearAtRadius/);
  assert.match(explorer, /return \{ feather, stops, schedule, years: yearReach\(geometry\) \}/);
  assert.match(explorer, /year: yearAtRadius\(plan\.years, state\.radius\), month: 0/);
  // The reach table is built with the geometry, not per frame: it is a couple
  // of dozen means over the sample ring and the reveal asks sixty times a second.
  assert.doesNotMatch(explorer, /yearReach\(geometry\)[\s\S]{0,60}requestAnimationFrame/);
  // Then the calendar takes it over: the month follows the pen from January
  // round to the month the record actually reaches, and stops where it does.
  assert.match(motion, /export function monthAtIndex/);
  assert.match(explorer, /month: Math\.min\(idleSelection\.month, monthAtIndex\(state\.index\)\)/);
  // The old spin-up after the plate is gone, along with the beat it rode.
  assert.doesNotMatch(explorer, /sweepFrom|sweepTo|sweepYear/);

  // The finished plate used to appear and then snap: a wash dropped over
  // everything in the same instant the month landed. It eases in instead.
  assert.match(motion, /wash: \{ start: \d+, duration: \d+ \}/);
  assert.match(explorer, /washRef\.current = SELECTION_WASH \* arrival/);
  assert.match(explorer, /context\.globalAlpha = washRef\.current/);
  assert.doesNotMatch(explorer, /context\.globalAlpha = 0\.3/);
  // The roll must not narrate itself to a screen reader month by month: it
  // starts silent and is announced once, when the reading is final.
  assert.match(explorer, /const \[announceSelection, setAnnounceSelection\] = useState\(false\)/);
  assert.match(explorer, /setAnnounceSelection\(true\);/);
  // A reader who acts during the entrance wins; the roll stops rather than
  // pulling the reading back off what they just chose.
  assert.match(explorer, /if \(interruptedRef\.current\) \{/);
  assert.match(explorer, /interruptedRef\.current = true;/);
  assert.match(explorer, /const reading: Selection = interruptedRef\.current\s*\n\s*\? selectionRef\.current/);
  // But the rest of the sheet still arrives: the note is cued by the clock,
  // so an interrupted entrance must play the score out rather than return
  // from the loop and leave it blank.
  assert.match(explorer, /if \(interruptedRef\.current\) allCues\(\); else finish\(\);/);
  assert.doesNotMatch(explorer, /if \(interruptedRef\.current\) \{[^}]*return;/);
});

test("turns a bare wedge with the pen, and takes the reading once it lands", () => {
  // While the calendar is drawn, only the calendar and the wedge move. Taking
  // the reading alongside them read as three animations at once, and cost the
  // sweep its smoothness: restoring a segment out of the wash means clipping
  // and re-blitting the whole plate several times a frame, every frame.
  assert.match(renderer, /export function strokeMonthWedge\(/);
  assert.match(explorer, /if \(state\.index > 0 && accent\) strokeMonthWedge\(built\.context, geometry, reading\.month, accent\)/);
  assert.doesNotMatch(explorer, /paintReading\([^)]*state\.index\)/);
  // The wedge takes a month, not a selection: during the sweep it is following
  // the calendar, and there is no reading yet for it to be following.
  assert.match(renderer, /export function strokeMonthWedge\(\s*\n\s*context: CanvasRenderingContext2D,\s*\n\s*geometry: Geometry,\s*\n\s*month: number,/);
  // And it is turned from the frame's own reading, not from committed state:
  // React has not applied the latter yet, and that lag is a frame of daylight
  // between the drawn month and the drawn calendar.
  assert.match(explorer, /const reading: Selection = interruptedRef\.current/);
  // It stops where the record does; the pen carries on to December.
  assert.match(explorer, /month: Math\.min\(idleSelection\.month, monthAtIndex\(state\.index\)\)/);

  // Then the reading lands as one movement on the calendar's last step. The
  // wash and everything that counterweights it come up together, so the plate
  // is correct at every point of the movement, not only at the end of it.
  assert.match(explorer, /const arrival = phase\(elapsed, SCORE\.wash\.start, SCORE\.wash\.duration, easeInOutCubic\)/);
  assert.match(explorer, /paintSelection\(arrival\)/);
  assert.match(explorer, /const paintSelection = useCallback\(\(arrival = 1\) =>/);
  assert.match(renderer, /context\.globalAlpha = 0\.2 \* arrival/);
  assert.match(renderer, /context\.globalAlpha = 0\.55 \* arrival/);
  assert.match(renderer, /context\.globalAlpha = arrival;\s*\n\s*context\.lineWidth = Math\.max\(1\.4/);
  // The outline is the exception: it has been turning since January, and the
  // reading landing around it must not make it flicker.
  assert.match(renderer, /context\.globalAlpha = 0\.22;/);
  // The pen clamp went with the concurrent reading: there is no calendar still
  // being drawn by the time the accent arc exists.
  assert.doesNotMatch(renderer, /indexProgress/);
});

test("holds the pointer off the plate while it is being drawn", () => {
  // Running a cursor over a specimen that is still growing is not a reading
  // being taken. It used to set the interrupt flag and cancel the rest of the
  // score, so an idle mouse resting on the canvas cost the page its ending.
  assert.match(explorer, /onPointerMove=\{\(event\) => \{ if \(rolling \|\| event\.pointerType !== "mouse"\) return;/);
  assert.match(explorer, /onPointerLeave=\{\(event\) => \{ if \(rolling \|\| event\.pointerType !== "mouse"\) return;/);
  assert.match(explorer, /onPointerDown=\{\(event\) => \{ if \(rolling\) return;/);
  // The gate is open for the whole entrance and closes when the score lands or
  // when a reader takes the plate over deliberately.
  assert.match(explorer, /setRolling\(true\);/);
  assert.match(explorer, /setRolling\(false\);/);
  // The keyboard stays live: a keypress is deliberate.
  assert.match(explorer, /onKeyDown=\{handleCanvasKeyDown\}/);
  // And a crosshair over an inert plate invites a click that does nothing.
  assert.match(styles, /\.is-drawing \.rings-canvas \{ cursor: default; \}/);
});

test("keeps the blocks that change with the data from resizing the page", () => {
  // The provenance list used to appear only once the cache loaded, which shoved
  // the title block down the moment the data arrived.
  assert.match(explorer, /const provenance: \[string, string \| null\]\[\]/);
  assert.doesNotMatch(explorer, /\{data \? <dl className="stage-provenance"/);
  assert.match(styles, /\.stage-provenance dd \{[^}]*min-height: 1\.2em/);
  // The note swings between one line and a full milestone summary, so its
  // height is reserved at the measured worst case instead of following content.
  assert.match(styles, /\.selected-mark \{[^}]*min-height: 178px/);
  // Scars are hidden for now, so the note reserves only what milestones need.
  assert.match(styles, /\.selected-mark h2 \+ p \{[^}]*-webkit-line-clamp: 4/);
  // A month with no reading must not collapse the observations block.
  assert.match(explorer, /averagePrice === null \? "—"/);
});

test("reserves motion for arrival and commitment, never for a hover scrub", () => {
  // `announceSelection` is false for pointer moves and true for a click, a key
  // or a dialog pick. Both the counter and the note wipe hang off it.
  // The entrance rolls throughout, but that is the reading being taken.
  assert.match(explorer, /const rollNumbers = !reduced && cues\.readout && \(announceSelection \|\| rolling\)/);
  assert.match(explorer, /if \(announce\) setCommitSeq\(\(value\) => value \+ 1\)/);
  assert.match(explorer, /<WipeIn wipeKey=\{String\(commitSeq\)\}>/);
  // Scrubbing must not re-strike the note.
  assert.match(explorer, /firstPass=\{!noteSettled\}/);
  // Tier 3 is the same reels with nowhere to travel: they land on arrival
  // rather than switching to a second rendering, or a commit would have
  // nothing to roll from.
  assert.match(odometer, /if \(still\) land\(reel\);/);
  assert.match(odometer, /useReel\(digit, DIGITS\.length, still, 0\)/);
});

test("answers a scrub once a frame rather than once a pointer event", () => {
  // A high-rate mouse fires many moves between two paints, and each one hit
  // tests the plate, runs the readout through React and repaints the canvas.
  // Only the last position of a frame is still under the cursor.
  assert.match(explorer, /const scrub = useCallback\(\(clientX: number, clientY: number\) => \{/);
  assert.match(explorer, /if \(scrubFrameRef\.current\) return;/);
  assert.match(explorer, /scrubFrameRef\.current = requestAnimationFrame\(/);
  assert.match(explorer, /onPointerMove=\{\(event\) => \{[^}]*scrub\(event\.clientX, event\.clientY\); \}\}/);
  // Leaving the plate and committing both settle the reading themselves.
  assert.match(explorer, /onPointerLeave=\{\(event\) => \{[^}]*endScrub\(\); restoreIdleSelection\(\); \}\}/);
  assert.match(explorer, /onPointerDown=\{\(event\) => \{ if \(rolling\) return; endScrub\(\);/);
});

test("reads the palette with the geometry, not on every painted frame", () => {
  // Asking for a computed style is a style recalc, and the reading is painted
  // every frame of the entrance and every frame of a scrub.
  assert.match(explorer, /const colors = paletteRef\.current;/);
  assert.match(explorer, /paletteRef\.current = \{\s*\n\s*paper: styles\.getPropertyValue\("--paper"\)\.trim\(\),/);
  const reading = explorer.slice(explorer.indexOf("const paintReading = useCallback("), explorer.indexOf("const paintSelection = useCallback("));
  assert.doesNotMatch(reading, /getComputedStyle/);
});

test("guards every timer and frame driven animation behind reduced motion", () => {
  assert.match(useMotion, /useSyncExternalStore\(watchReducedMotion, prefersReducedMotion, \(\) => true\)/);
  for (const [name, source] of [["TypeOn", typeOn], ["Odometer", odometer], ["EthRings", explorer]]) {
    assert.match(source, /useReducedMotion|reduced/, `${name} must consult the reduced-motion preference`);
  }
  assert.match(typeOn, /if \(reduced\) return <span className=\{typedClass\(className\)\}>\{text\}<\/span>/);
  assert.match(explorer, /if \(reduced \|\| revealPlayedRef\.current\) \{\s*\n\s*settle\(\);/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("waits for the introduction to clear before spending the choreography", () => {
  assert.match(shell, /<StageGateContext\.Provider value=\{mode === "closed"\}>\{children\}<\/StageGateContext\.Provider>/);
  assert.equal(shell.match(/\{children\}/g)?.length, 1);
  assert.match(explorer, /const stageOpen = useStageOpen\(\)/);
  assert.match(explorer, /if \(!stageOpen\) return;/);
});

test("accumulates the reveal clock so a background tab does not spend it unseen", () => {
  assert.match(explorer, /revealElapsedRef\.current \+= Math\.min\(now - last, 64\)/);
  assert.doesNotMatch(explorer, /const elapsed = now - begin/);
  // A counter still winding up shows zeros, which is wrong data rather than
  // merely still data. A background tab issues no frames at all, so the reels
  // measure the gap and land on the real reading instead of rolling through
  // an interval nobody watched.
  assert.match(odometer, /const STALL_SECONDS = 0\.25/);
  assert.match(odometer, /if \(seconds > STALL_SECONDS\) land\(reel\)/);
});

test("hands the finished plate back to the ordinary paint path", () => {
  // The reveal owns the canvas while it runs; a selection change must not
  // paint the finished artwork over a half-drawn one.
  assert.match(explorer, /if \(revealActiveRef\.current\) return;/);
  assert.match(explorer, /revealActiveRef\.current = false;\s*\n\s*revealPlayedRef\.current = true;/);
  // The completed reveal and the static artwork must be the same drawing.
  assert.match(renderer, /export function drawRevealFrame/);
  assert.match(renderer, /drawGroundLayer\(context, geometry, colors\);\s*\n\s*drawInkLayer\(context, geometry, colors\);\s*\n\s*drawKnotLayer\(context, geometry, colors\);\s*\n\s*drawIndexLayer\(context, geometry, colors\);/);
});

test("rolls the reading on one spring rather than a transition per change", () => {
  // A year is a position in the record, not four independent columns: rolled
  // as digits, 2019 to 2020 turns the units back nine cells while the tens
  // turns forward one, and during the plate's closing rush — a year every
  // ~130ms against a 420ms transition and its stagger — none of them ever
  // arrived. One cell a year is the movement the specimen is making.
  assert.match(odometer, /export function YearRoll/);
  assert.match(odometer, /years\.map\(\(cell\) => <span key=\{cell\} className="odo-cell">\{cell\}<\/span>\)/);
  assert.match(explorer, /<YearRoll years=\{archiveYears\} year=\{selection\.year\}/);
  // The strip begins at the chronology origin: a knot in the unpriced interval
  // is selectable, and a strip starting in 2017 would have no cell to show it.
  assert.match(explorer, /const firstArchiveYear = Number\(data\.chronology\.origin\.slice\(0, 4\)\)/);
  assert.match(explorer, /const archiveYears = useMemo\(/);

  // Critically damped, re-aimed in flight. A fixed transition per change
  // resets its own duration on every new reading, so a run of readings never
  // converges; a spring carries its speed into the next one.
  assert.match(odometer, /const pull = STIFFNESS \* STIFFNESS \* \(reel\.to - reel\.at\) - 2 \* STIFFNESS \* reel\.speed/);
  assert.doesNotMatch(styles, /\.odo-strip[^}]*transition/);
  // One clock for every counter, stopped the moment they have all arrived.
  assert.match(odometer, /frame = moving \? requestAnimationFrame\(run\) : 0/);
  // Positions are written to the node, never through React: the entrance
  // moves these sixty times a second.
  assert.match(odometer, /reel\.node\.style\.transform = /);

  // The month tape comes back round, so December to January is one cell
  // forward rather than eleven back, and a lap can be taken off the position
  // against the duplicate first cell without anything appearing to move.
  assert.match(odometer, /if \(step > reel\.lap \/ 2\) step -= reel\.lap/);
  assert.match(odometer, /function cyclicCells/);
  assert.match(odometer, /reel\.at -= laps \* reel\.lap/);
  // A background tab issues no frames; rolling through the gap on return
  // would spend it showing numbers that are wrong rather than merely still.
  assert.match(odometer, /if \(seconds > STALL_SECONDS\) land\(reel\)/);
});

test("gives the counter back the type that the readout's span rule overrides", () => {
  // `.stage-price span` sets the 12px label face on every span in the readout.
  assert.match(styles, /\.stage-price \.odo, \.stage-price \.odo \*/);
  // A cell taller than the type, or a month like Sep loses its descender. It
  // is declared on the counter, not the slot: the strips pin it to a whole
  // device pixel and set it back there, and a slot declaring it for itself
  // would shadow that.
  assert.match(styles, /\.odo, \.odo-month \{ --odo-cell: 1\.32em/);
  assert.doesNotMatch(styles, /\.odo-slot \{\s*--odo-cell/);
  assert.match(odometer, /translate3d\(0, calc\(var\(--odo-cell\)/);
});

test("dissolves the counter's mask edges instead of slicing the cells off", () => {
  // Type is not centred in its box, so the two fades take the room each end
  // actually has: a quarter of a cell of clear air above the figures, and an
  // eighth below, where a month's descender reaches to 88% of the cell.
  assert.match(styles, /--odo-fade-top: 22%/);
  assert.match(styles, /--odo-fade-bottom: 11%/);
  assert.match(styles, /mask-image: var\(--odo-mask\)/);
  assert.match(styles, /-webkit-mask-image: var\(--odo-mask\)/);
  // Eased, not linear: a straight ramp over five pixels reads as a band with
  // an edge of its own, which is the thing being got rid of.
  assert.match(styles, /rgba\(0, 0, 0, \.5\) calc\(var\(--odo-fade-top\) \* \.5\)/);
  assert.match(styles, /rgba\(0, 0, 0, \.5\) calc\(100% - var\(--odo-fade-bottom\) \* \.5\)/);
  // A slot that never turns has no cut to hide, and a currency sign reaches
  // higher than a figure does.
  assert.match(styles, /\.odo-slot-fixed \{ -webkit-mask-image: none; mask-image: none; \}/);
  assert.match(odometer, /className="odo-slot odo-slot-fixed"/);
});

test("pins the counter cell to a whole device pixel", () => {
  // 1.32em of a clamped size is 46.464px at the readout, so cell n sits at
  // n x 46.464 and successive cells raster against offsets of 0, .46, .93,
  // .39 ... Turning the strip carries that unevenness past the window, which
  // reads as the years bobbing rather than as one strip moving.
  assert.match(odometer, /function pinCells/);
  assert.match(odometer, /Math\.round\(natural\[index\] \* device\) \/ device/);
  // Measured, because the size is a clamp on the viewport and the face has
  // its own metrics — and re-measured when either can have changed.
  assert.match(odometer, /window\.addEventListener\("resize", schedulePin\)/);
  assert.match(odometer, /document\.fonts\?\.ready\.then\(schedulePin\)/);
  // Cleared in one pass and measured in the next, so the rig costs one reflow.
  assert.match(odometer, /for \(const counter of counters\) counter\.style\.removeProperty\("--odo-cell"\);/);
});

test("shows the unfinished outer ring as the one piece of ambient motion", () => {
  assert.match(renderer, /export function growthFrontier/);
  assert.match(explorer, /className="growth-frontier"/);
  assert.match(styles, /@keyframes frontier-breath/);
});
