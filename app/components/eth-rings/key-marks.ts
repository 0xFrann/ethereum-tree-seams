import { TAU, knotOutline, type Point } from "./event-geometry";

/**
 * The marks the key sets beside its lines.
 *
 * The key used to name them with type — an em dash, a double rule, a bullet —
 * which describes the plate's marks rather than showing them. A reader holding
 * the key up against the specimen has to be able to match what is in front of
 * them, so these are the marks themselves: a contour that wanders, the same
 * contour carrying its volume weight, and a knot grown from the plate's own
 * knot geometry.
 *
 * A ring is a circle here only because the specimen is round. Unrolled, it is a
 * line whose height is the reading and whose weight is the volume behind it,
 * which is what the key shows: the first two rows are one path drawn twice.
 *
 * The line is a specimen, not a reading — it stands for any year, so it is
 * traced from two slow waves a little out of step rather than from the market.
 * Nothing about it changes at runtime, so all three are traced once, here.
 */

export const KEY_MARK_BOX = { width: 44, height: 18 } as const;

const EDGE = 2.5;
const MIDDLE = KEY_MARK_BOX.height / 2;
// Dense enough that the offset edges of the band follow the line rather than
// the polygon between its control points.
const SAMPLES = 48;

const round = (value: number) => Number(value.toFixed(2));
const at = (point: Point) => `${round(point.x)} ${round(point.y)}`;

/**
 * The same tangent rule the plate traces a knot with (`tracePointPath`): a
 * smooth run through the control points rather than the polygon between them.
 * Open runs hold their ends still by treating the first and last point as their
 * own neighbour; a closed one wraps.
 */
function curves(points: readonly Point[], close: boolean) {
  const count = points.length;
  const sample = (index: number) => close
    ? points[((index % count) + count) % count]
    : points[Math.max(0, Math.min(count - 1, index))];
  const segments: string[] = [];
  for (let index = 0; index < (close ? count : count - 1); index += 1) {
    const previous = sample(index - 1);
    const from = sample(index);
    const to = sample(index + 1);
    const next = sample(index + 2);
    segments.push(`C ${at({ x: from.x + (to.x - previous.x) / 6, y: from.y + (to.y - previous.y) / 6 })}`
      + ` ${at({ x: to.x - (next.x - from.x) / 6, y: to.y - (next.y - from.y) / 6 })}`
      + ` ${at(to)}`);
  }
  return segments.join(" ");
}

// One rise and one fall across the swatch, with a second harmonic small enough
// to give the line a little grain and nothing else. A closer-run second wave
// pinches the trough into a corner, which is the one thing a ring never has.
const contour: Point[] = Array.from({ length: SAMPLES + 1 }, (_, index) => {
  const t = index / SAMPLES;
  return {
    x: EDGE + t * (KEY_MARK_BOX.width - EDGE * 2),
    y: MIDDLE - (Math.sin(TAU * (t - 0.08)) * 3 + Math.sin(TAU * 2 * t + 1) * 0.4),
  };
});

// The band is measured across the line, not down the box. Offsetting in y alone
// narrows it by the cosine of the slope wherever the line is steep, so the ink
// thins on the falls and swells on the flats for reasons that have nothing to do
// with volume — and the edges stop tracking the path they belong to, which is
// what makes the band read as a second shape drawn around the first rather than
// as the first one carrying more weight. Offsetting along the normal is what
// stroking a path means.
const normals = contour.map((_, index) => {
  const previous = contour[Math.max(0, index - 1)];
  const next = contour[Math.min(contour.length - 1, index + 1)];
  const run = next.x - previous.x;
  const rise = next.y - previous.y;
  const length = Math.hypot(run, rise) || 1;
  return { x: rise / length, y: -run / length };
});

/**
 * The weight, sample by sample: one stroke of a broad pen.
 *
 * The band is a hairline at both ends and swells once, over the crest, the way
 * a stroke drawn with a width tool does — thin where it is picked up and set
 * down, heavy through the belly. It used to pulse several times along the line
 * with a short run-in at each end, and at this size that read as lumps: the
 * width climbed from hairline to full in a few units, which cut a notch into
 * the outer edge on the first climb and left a spur at the far end, and every
 * pulse after that put a bulge on one side of the line. Offset edges only stay
 * as smooth as the line they follow if the width changes slowly against the
 * arc, so the whole swatch is given to a single rise and fall.
 *
 * The belly sits a little before the middle, on the crest, so the heavy part of
 * the stroke lands where the line is doing the most, and the tail runs out long
 * and thin through the trough.
 */
const REST_HALF_WIDTH = 0.5;
const SWELL_HALF_WIDTH = 1.3;
const widths = contour.map((_, index) => {
  const t = index / SAMPLES;
  // Bending the parameter before the sine moves its peak toward the start;
  // raising the sine sharpens the taper at both ends without adding a corner.
  const skewed = Math.pow(t, 0.8);
  return REST_HALF_WIDTH + SWELL_HALF_WIDTH * Math.pow(Math.sin(Math.PI * skewed), 1.2);
});

const offsetContour = (sign: number) => contour.map((point, index) => ({
  x: point.x + sign * normals[index].x * widths[index],
  y: point.y + sign * normals[index].y * widths[index],
}));

/** Ring shape — price. The contour at the weight every ring is drawn at. */
export const KEY_RING_SHAPE = `M ${at(contour[0])} ${curves(contour, false)}`;

/**
 * Ring weight — volume. The line above, stroked at a width that changes as it
 * goes. Nothing in SVG strokes like that, so the band is drawn as the outline a
 * modulated stroke would leave: the contour offset to either side of itself and
 * closed with a round cap of the local width at each end — the same figure the
 * plate fills a ring's body with, and the same round ends the hairline has.
 */
export const KEY_RING_WEIGHT = (() => {
  const above = offsetContour(1);
  const below = offsetContour(-1).reverse();
  const endCap = widths[SAMPLES];
  const startCap = widths[0];
  return `M ${at(above[0])} ${curves(above, false)}`
    + ` A ${round(endCap)} ${round(endCap)} 0 0 1 ${at(below[0])}`
    + ` ${curves(below, false)}`
    + ` A ${round(startCap)} ${round(startCap)} 0 0 1 ${at(above[0])} Z`;
})();

/**
 * Knots — protocol milestones. Grown by the plate's own knot geometry, at the
 * size of the smallest knots it draws, and lying along the line the way a knot
 * on the specimen lies along the ring it interrupts — including the slight turn
 * off that line every knot is given.
 *
 * It is seeded with a milestone the plate actually carries rather than with a
 * name of its own, so the key shows a knot the reader can go and find. The
 * Merge is the roundest of them: every knot is pushed out of true by its own
 * seed, and this one is off it evenly, with no flat run to catch the eye at the
 * size the key sets it.
 */
export const KEY_KNOT = (() => {
  const path = knotOutline("the-merge", { x: KEY_MARK_BOX.width / 2, y: MIDDLE }, 7, 4.5, 0.12);
  return `M ${at(path[0])} ${curves(path, true)} Z`;
})();
