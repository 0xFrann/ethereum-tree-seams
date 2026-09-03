// Motion for the specimen plate.
//
// One principle governs every animation on this page: motion is reserved for
// arrival and for commitment. Hovering the plate is a reading action, and
// reading must never be disturbed, so the scrub tier is deliberately still.
//
//   Tier 1  arrival     first render of the plate      full choreography
//   Tier 2  commitment  click, arrow key, dialog pick  short and directional
//   Tier 3  scrub       pointer move across segments   no motion at all
//
// The plate is drawn the way a drafter works: construction grain runs ahead of
// the pen, the year rings ink in behind it from the pith outward, the ink then
// gains its volume weight in a second pass, the knots are punched, and the
// index ring and its labels close the sheet. Typed annotations arrive last,
// because a specimen is annotated after it is mounted.

export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// The growth front. It starts from nothing and builds to twice the average rate
// by the end, so the specimen gathers pace as it widens rather than easing to a
// halt. easeInCubic would finish at 3x, but it leaves the outermost rings
// almost no time to take on their weight.
export const easeInQuad: Easing = (t) => t * t;

/**
 * A stepped schedule. `travel` is the relative time each stop takes to reach,
 * `dwell` the relative pause once it has landed. Both are in the same unit, so
 * a dwell of 1 is as long as a travel of 1.
 *
 * A smooth ramp gives a beat no rhythm — it is the one shape on this page that
 * nothing lands in. Stepping through the stops instead lets each arrival read
 * as an arrival.
 */
export function buildSchedule(travel: readonly number[], dwell: readonly number[]) {
  const steps = travel.length;
  const total = travel.reduce((sum, value) => sum + value, 0) + dwell.reduce((sum, value) => sum + value, 0);

  let at = 0;
  const marks = travel.map((span, index) => {
    const from = at / total;
    at += span;
    const to = at / total;
    at += dwell[index] ?? 0;
    return { from, to, until: at / total };
  });

  return (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    for (let index = 0; index < steps; index += 1) {
      const mark = marks[index];
      if (clamped >= mark.until) continue;
      if (clamped >= mark.to) return (index + 1) / steps;
      const local = (clamped - mark.from) / Math.max(1e-6, mark.to - mark.from);
      // Each stop is approached and settled on, so it reads as landing.
      return (index + easeInOutCubic(local)) / steps;
    }
    return 1;
  };
}

/**
 * A schedule that opens slowly and gathers pace over a set number of steps,
 * then runs at a ceiling for the rest.
 *
 * The pace climbs from the opening step to `range` times faster over `ramp`
 * steps. The climb is eased on the log scale: `curve` maps a step's position
 * in the ramp to how far up the climb it is, so an ease-in keeps the opening
 * steps almost equally slow and spends the acceleration late. Past the ramp
 * every step runs at the ceiling, and `finale` sets the last step's share so a
 * closing movement has room of its own.
 *
 * The first attempt at this was the Fibonacci series, one term per step. It
 * has the right idea — start slow, run away — but the series is geometric
 * with ratio φ per term, and taken a step at a time that is a second to a
 * frame in eight steps: slow, slow, medium, then sixty steps at one constant
 * pace. The drama is in the ramp, and the ramp has to be long enough to be
 * watched and flat enough at its start to feel slow rather than merely
 * begin so.
 *
 * Each hold is half the one before, so the opening steps are held and the
 * rest flow.
 */
export function buildRamp(
  steps: number,
  ramp: number,
  range: number,
  curve: Easing,
  hold: number,
  finale?: number,
) {
  const travel = Array.from({ length: steps }, (_, index) => {
    const position = ramp > 0 ? Math.min(1, index / ramp) : 1;
    return range ** -curve(position);
  });
  if (finale !== undefined && steps > 0) travel[steps - 1] = finale;
  const dwell = Array.from({ length: steps }, (_, index) => hold * 0.5 ** index);
  return buildSchedule(travel, dwell);
}

// The plate steps line by line: the first line of the pith at length, a hold,
// the next nearly as long, a shorter hold, and then a gathering pace over the
// first few rings until the lines are coming one a frame, where the rush
// simply runs to the bark. The finale is the outer rings taking on their
// weight and wants room of its own — most of a first line's worth.
//
//   ramp    how many lines the pace takes to reach the ceiling: about three
//           rings' worth, so the acceleration is itself something watched
//   range   how much faster the rush is than the opening line; at the plate's
//           duration the ceiling is about a line a frame, and past that
//           several lines land in one frame and the layers turn back into
//           blocks
//   curve   ease-in on the log scale, so the opening lines stay slow for a
//           while and the pace breaks late rather than immediately
export const PLATE_RAMP = { ramp: 18, range: 18, curve: easeInQuad, hold: 0.55, finale: 0.8 } as const;
// The calendar closes the sheet in two gestures: January is struck and held,
// then the pen completes the circle in one continuous sweep — starting slow,
// running, and landing on December.
//
// It does not step month by month. A ramp needs enough steps to be read as
// acceleration; the plate has seventy lines and the calendar has twelve, and
// twelve stops read as a stutter rather than a build. One month presented as
// the element, then the whole year as a single movement, is the same idea at
// the scale the calendar actually has.
//
// In milliseconds; the index beat in the score is their sum.
export const INDEX_BEAT = { january: 380, hold: 220, sweep: 700 } as const;
export const INDEX_DURATION = INDEX_BEAT.january + INDEX_BEAT.hold + INDEX_BEAT.sweep;

/** Progress of the calendar sweep, 0..1 around the ring, at `t` of the index beat. */
export function indexSchedule(t: number) {
  const at = Math.max(0, Math.min(1, t)) * INDEX_DURATION;
  const { january, hold, sweep } = INDEX_BEAT;
  if (at < january) return easeInOutCubic(at / january) / 12;
  if (at < january + hold) return 1 / 12;
  return 1 / 12 + (11 / 12) * easeInOutCubic(Math.min(1, (at - january - hold) / sweep));
}

/**
 * The month the calendar's pen is in at `progress` around the ring.
 *
 * The reading follows the pen rather than trailing it: the month changes the
 * moment its arc is entered, so the number and the stroke name the same thing.
 * January is the exception at both ends — it is struck and then held, and a
 * bare floor would call that hold February.
 */
export function monthAtIndex(progress: number) {
  return Math.max(0, Math.min(11, Math.ceil(Math.max(0, Math.min(1, progress)) * 12) - 1));
}

/** Normalised progress of a phase that starts at `start` ms and runs `duration` ms. */
export function phase(elapsed: number, start: number, duration: number, ease: Easing = linear) {
  if (duration <= 0) return elapsed >= start ? 1 : 0;
  return ease(Math.max(0, Math.min(1, (elapsed - start) / duration)));
}

// The score.
//
// Every beat on the page reads its timing from this one table, canvas and DOM
// alike. Timings used to live in three places — this table, CSS transition
// delays, and the typing timers — related only by when a class happened to
// flip, which is why the page arrived as several separate animations instead
// of one composition.
//
// The order is the order the sheet is actually made: label it, mount the
// specimen, then take the reading off it. Beats start in sequence but their
// tails overlap; strict back-to-back beats leave dead air between them, which
// reads as stalling rather than rhythm.
//
//   header   the project introduces itself, then rattles off its provenance
//   plate    the specimen is drawn
//   readout  the label finished, the instrument is set on the specimen line
//            by line, and the year it shows is the year the front is laying
//            down
//   index    the calendar is struck around the finished plate, and a bare
//            wedge turns with the pen from January round to the present
//   wash     the reading lands: the wedge's month is brought up and the rest
//            of the specimen dims away from it
//   note     and only then is that reading annotated
//
// The readout does not wait for the specimen to be finished before it is
// placed. An instrument that arrives afterwards and then spins up to the
// present is a second animation about the same fact the plate has just spent
// six seconds stating. Reading the front instead makes the two one gesture:
// the number is a caption on the ring being drawn, and the reader learns what
// the widening actually means while it is still widening.
//
// It reads the year and no more. The front is radial — it lays whole contours
// down at once — so at no moment during the growth is one month of a year
// further along than another, and a month rolling under the year would be
// showing a precision the drawing does not have. January is the year's label
// here, not a reading, and it holds until there is a calendar to move it.
//
// The note is deliberately last. Its content is a function of the selected
// month, so placed any earlier it would flicker through every month the
// calendar passes over.
//
// The plate is far and away the longest beat: the growth is the thing worth
// watching, and it is paced to be watched rather than got through. Most of
// its length is spent on the first three rings, gathering pace; the rest is
// given away in a rush of a line a frame. Its length is set from the ramp so
// that the rush lands at exactly that: shorten it and lines start sharing
// frames, and the layers turn back into blocks.
//
// The plate and the header open on the same beat. The front starts so slowly
// that its first moment of travel shows almost nothing, so it costs the header
// no attention to share the downbeat with it: the first line of the label is
// struck and the pith is set at once, and by the time the provenance dates are
// rattling past the specimen's first contours are already under them.
//
// This is the one place the sheet is not made strictly in order. Labelling
// first is the rule everywhere else in this score, but the plate's opening is
// slow enough that starting it a beat late reads as the page hesitating rather
// than as the label taking precedence.
//
// The readout does keep to that rule. It waits for the label to finish and is
// then laid down line by line, so the sheet's two upper corners are made one
// after the other rather than at once: the specimen is named, then the
// instrument is set on it. Sharing the downbeat put a block of figures beside
// a header that was still being written, and two corners being written at
// the same time is a page with no order to read it in — worse, the corner
// that finished first was the one that had not been struck at all.
//
// Waiting costs the caption nothing. The front is still on its first ring at
// that point and does not reach its second year for another three hundred
// milliseconds, so the instrument is placed, and only then does the reading
// under it begin to move.
//
// The calendar waits longest. The plate ends in a rush and a settling of
// weight, and the calendar is a new idea — the specimen is finished, now it
// is measured — so it is given a real pause: long enough for the finished
// shape to be seen still, and for the reading to be seen resting on the last
// year's January, before the first month is struck against it.
//
// Only two things move while the calendar is being drawn: the circle itself,
// and a bare wedge turning with the pen. The reading proper — the month
// brought up out of a wash that drops over everything else — waits for the
// circle to close and lands as one movement.
//
// Taking the reading concurrently was tried and is worse in both ways it can
// be. It reads as three animations at once rather than one: a circle drawing
// itself, a wedge turning, and a wash creeping in over a specimen the eye is
// still learning. And it is genuinely slow — restoring a segment out of the
// wash means clipping and re-blitting the whole plate several times a frame,
// every frame, so the sweep it was meant to accompany stutters. The wedge on
// its own is sixty lines and a stroke.
export const SCORE = {
  header: { start: 0, duration: 2230 },
  plate: { start: 0, duration: 5800 },
  // On the header's last beat, so the label is finished before the instrument
  // is set on it. Long enough for the instrument's four lines to be laid down
  // one after another: READOUT_STEP_MS apart, plus the last line's arrival.
  readout: { start: 2230, duration: 640 },
  index: { start: 6700, duration: 1300 },
  // On the calendar's last step, with no gap: the circle closes and the plate
  // resolves into the reading in one movement.
  wash: { start: 8000, duration: 520 },
  note: { start: 8600, duration: 360 },
} as const;

// Where the specimen itself is finished, before the calendar closes the sheet.
// The live-edge marker waits for this: it says the outermost ring is still
// growing in reality, which only reads once that ring exists to grow from.
export const PLATE_END = SCORE.plate.start + SCORE.plate.duration;

// The canvas keeps drawing until the calendar has closed the sheet, not merely
// until the plate itself is finished: the index ring is part of the drawing.
export const DRAW_END = Math.max(PLATE_END, SCORE.index.start + SCORE.index.duration);
export const SCORE_DURATION = SCORE.note.start + SCORE.note.duration;

// How far the advancing edge is feathered, as a multiple of the ring gap. A
// year is six lines, so a line spacing is a sixth of a gap; the feather is a
// little wider than that, so each line lands on its own but its neighbours
// are already stirring — layers, not slices, and not a block.
export const FRONT_FEATHER_GAPS = 0.22;

// The wash the finished plate carries over everything but the selected month.
export const SELECTION_WASH = 0.3;

// The header is struck as a chain: each line begins when the one before it
// finishes. The two identity lines are set at a presenting pace and hold
// afterwards; the provenance rows that follow are a detail, and rattle past.
export const TITLE_SPEED_MS = 32;
export const TITLE_HOLD_MS = 260;
export const DETAIL_SPEED_MS = 11;
export const DETAIL_HOLD_MS = 45;
export const TYPE_SPEED_MS = 17;

// The readout is laid down line by line on the same downbeat, so the sheet's
// two upper corners arrive as one gesture rather than one of them being
// written while the other is simply already there.
//
// It is not struck. Only annotations type on this page, and a reading is not
// an annotation — a figure typing itself would also be at odds with the reel
// it sits on, which is already winding up to it. Each line arrives instead,
// the same way a committed note does, and the step is shorter than the arrival
// so the lines cascade rather than queue.
export const READOUT_STEP_MS = 150;

export type ChainLink = { text: string; speed: number; hold: number };

/**
 * Start offsets for a chain of struck lines, each beginning where the previous
 * one ends. Fixed per-item delays drift as soon as any string changes length;
 * chaining off the real text keeps the rhythm intact whatever the data says.
 */
export function chainDelays(links: readonly ChainLink[]) {
  let at = 0;
  return links.map((link) => {
    const start = at;
    at += link.text.length * link.speed + link.hold;
    return start;
  });
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Subscribe to the reduced-motion preference. Canvas and timer driven motion
 * cannot be reached by the stylesheet's `prefers-reduced-motion` rule, so every
 * animation on this page consults this instead.
 */
export function watchReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
