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
  // Label the sheet, mount the specimen, place the instrument, take the
  // reading, and only then annotate it.
  assert.ok(beats.header.start < beats.plate.start, "the sheet is labelled first");
  assert.ok(beats.plate.start < beats.readout.start, "the specimen precedes its reading");
  assert.ok(beats.readout.start < beats.sweep.start, "the instrument is placed before it travels");
  assert.ok(beats.sweep.start < beats.note.start, "the note annotates a reading already taken");
  // The note's content is a function of the selected month, so it must not
  // exist while the sweep is still moving through months.
  assert.ok(beats.sweep.start + beats.sweep.duration <= beats.note.start, "the sweep finishes before the note arrives");
  // Beats overlap; strict back-to-back beats leave dead air between them.
  assert.ok(beats.plate.start < beats.header.start + beats.header.duration, "beats cascade rather than queue");
  // The calendar waits for the plate to finish rather than closing it out, so
  // it reads as its own arrival instead of the tail of the growth — and it
  // waits long enough for the finished shape to be seen still first.
  assert.ok(beats.index.start - (beats.plate.start + beats.plate.duration) >= 800, "the calendar pauses before its first month");
  assert.ok(beats.readout.start > beats.index.start + beats.index.duration, "the numbers wait for the calendar");
  // Knots are no longer a beat at all; they ride the front with the rings.
  assert.ok(!beats.knots, "knots must not have a phase of their own");
  // The growth is the centrepiece and is paced to be watched.
  const longest = Object.entries(beats).sort((a, b) => b[1].duration - a[1].duration)[0][0];
  assert.equal(longest, "plate", "the plate must be the longest beat on the page");
  // A pause between the reading being placed and it starting to travel.
  assert.ok(beats.sweep.start > beats.readout.start + beats.readout.duration, "the sweep waits before it spins");
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
  // The growing edge belongs to the plate, not to an empty sheet.
  assert.match(styles, /\.is-plate \.growth-frontier \{ animation: frontier-breath/);
});

test("shows the first reading at the sweep's origin, not at the present", () => {
  // The readout used to appear showing the present month, snap back to
  // January when the sweep began, and roll forward to where it started.
  assert.match(explorer, /useState<Selection>\(\{ year: data\.years\[latestYearIndex\]\.year, month: data\.years\[latestYearIndex\]\.months\[0\]\?\.month \?\? 0 \}\)/);
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
  // The plate opens under the header rather than after it.
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

test("takes the reading as a movement instead of a jump", () => {
  // The finished plate used to appear, then snap: a wash dropped over
  // everything and a month was selected in the same instant.
  assert.match(motion, /sweep: \{ start: \d+, duration: \d+ \}/);
  assert.match(explorer, /washRef\.current = SELECTION_WASH \* settling/);
  assert.match(explorer, /context\.globalAlpha = washRef\.current/);
  assert.doesNotMatch(explorer, /context\.globalAlpha = 0\.3/);
  // The selection travels across the final year rather than landing on it.
  assert.match(explorer, /const month = sweepFrom \+ Math\.round\(\(sweepTo - sweepFrom\) \* settling\)/);
  // The sweep must not narrate itself to a screen reader month by month: it
  // starts silent and is announced once, when the reading is final.
  assert.match(explorer, /const \[announceSelection, setAnnounceSelection\] = useState\(false\)/);
  assert.match(explorer, /setAnnounceSelection\(true\);/);
  assert.doesNotMatch(explorer, /setAnnounceSelection\(true\)[\s\S]{0,200}const settling = phase/);
  // A reader who acts during the sweep wins; the animation stops rather than
  // pulling the reading back off what they just chose.
  assert.match(explorer, /if \(sweepInterruptedRef\.current\) \{/);
  assert.match(explorer, /sweepInterruptedRef\.current = true;/);
  // But the rest of the sheet still arrives: the readout and the note are
  // cued by the clock, so an interrupted sweep must play the score out rather
  // than return from the loop and leave them blank.
  assert.match(explorer, /if \(sweepInterruptedRef\.current\) allCues\(\); else finish\(\);/);
  assert.doesNotMatch(explorer, /if \(sweepInterruptedRef\.current\) \{[^}]*return;/);
  // And an interruption only counts once the sweep is running: the pointer
  // crossing the plate while it was still being drawn used to cancel a sweep
  // that had not started, and with it the beats after.
  assert.match(explorer, /revealPlayedRef\.current = true;[\s\S]{0,400}sweepInterruptedRef\.current = false;/);
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
  // The settling sweep rolls too, but that is the reading being taken.
  assert.match(explorer, /const rollNumbers = !reduced && cues\.readout && \(announceSelection \|\| sweeping\)/);
  assert.match(explorer, /if \(announce\) setCommitSeq\(\(value\) => value \+ 1\)/);
  assert.match(explorer, /<WipeIn wipeKey=\{String\(commitSeq\)\}>/);
  // Scrubbing must not re-strike the note.
  assert.match(explorer, /firstPass=\{!noteSettled\}/);
  // The odometer keeps one stable DOM and switches the transition off instead
  // of swapping renderings, or a commit would have nothing to roll from.
  assert.match(odometer, /odo-still/);
  assert.match(styles, /\.odo-still \.odo-strip[^}]*transition: none/);
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
  // An un-wound counter shows zeros, which is wrong data rather than still
  // data, so the real reading has to land without a frame.
  assert.match(odometer, /const backstop = window\.setTimeout\(\(\) => setWound\(true\), 250\)/);
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

test("rolls the month across a year boundary and covers the unpriced interval", () => {
  // A tape that began at the first market year would scroll a knot in the
  // ghost chronology clean off the strip.
  assert.match(explorer, /const firstArchiveYear = Number\(data\.chronology\.origin\.slice\(0, 4\)\)/);
  assert.match(odometer, /yearCount \* 12/);
  assert.match(odometer, /MONTHS\[index % 12\]/);
});

test("gives the counter back the type that the readout's span rule overrides", () => {
  // `.stage-price span` sets the 12px label face on every span in the readout.
  assert.match(styles, /\.stage-price \.odo, \.stage-price \.odo \*/);
  // A cell taller than the type, or a month like Sep loses its descender.
  assert.match(styles, /--odo-cell: 1\.32em/);
  assert.match(odometer, /translateY\(calc\(var\(--odo-cell\)/);
});

test("shows the unfinished outer ring as the one piece of ambient motion", () => {
  assert.match(renderer, /export function growthFrontier/);
  assert.match(explorer, /className="growth-frontier"/);
  assert.match(styles, /@keyframes frontier-breath/);
});
