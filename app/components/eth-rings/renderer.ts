import {
  buildEventAnchors,
  buildEventHitRegions,
  buildKnotGeometry,
  hitTestEvents,
  resolveEventCollisions,
  type EventHitRegion,
  type KnotGeometry,
  type YearBandGeometry,
} from "./event-geometry";
import { MONTHS, type EventSelection, type MarketData, type Selection } from "./model";

const SAMPLE_COUNT = 360;
const TAU = Math.PI * 2;
const VOLUME_SAMPLES_PER_MONTH = 4;
const PRE_MARKET_GHOST_COUNT = 14;
const INTERSTITIAL_GHOST_FRACTIONS = [0.17, 0.34, 0.52, 0.7, 0.84] as const;
const GHOST_ALPHA = 0.5;
const EMPTY_GHOST_ALPHA_MIN = 0.2;
const EMPTY_GHOST_ALPHA_MAX = 0.48;
// These are intentionally editorial rather than literal market scales: the
// specimen needs visible relief and grain while preserving ring clearance.
const PRICE_RELIEF = 0.52;
const MINIMUM_RING_WEIGHT = 0.65;
const VOLUME_WIDTH_RANGE = 0.28;
const VOLUME_YEAR_BASELINE_MIN = 0.08;
const VOLUME_YEAR_BASELINE_RANGE = 0.78;
const VOLUME_LOCAL_CONTRAST = 0.7;
// How the reveal staggers, in ring gaps behind the advancing front. Every line —
// ghost grain and year ring alike — arrives at the front as the same thin
// stroke; weight follows well behind, so the plate first exists as a drawing of
// uniform lines and only then takes on its final form. Knots swell just behind
// their own ring rather than being punched in at the end.
//
// Measured in gaps, not in the front's feather: the feather is narrower than a
// line spacing so that lines land one at a time, and a lag tied to it would
// have the weight arrive with the line instead of after it.
const WEIGHT_LAG_GAPS = 2.5;
const WEIGHT_SPAN_GAPS = 2.7;
const KNOT_LAG_GAPS = 0.6;
const KNOT_SPAN_GAPS = 1.9;
const KNOT_MINIMUM_SCALE = 0.25;


type RingGeometry = {
  year: number;
  radii: number[];
  widths: number[];
  startSample: number;
  activeSamples: number;
};

export type EventGeometry = {
  knots: KnotGeometry[];
  fineHitRegions: EventHitRegion[];
  coarseHitRegions: EventHitRegion[];
};

export type Geometry = {
  center: number;
  size: number;
  gap: number;
  inner: number;
  indexRadius: number;
  restWidth: number;
  bark: number[];
  grain: GrainContour[];
  rings: RingGeometry[];
  yearBands: YearBandGeometry[];
  selectableMonths: Selection[];
  events: EventGeometry;
};

/**
 * The state of the plate part-way through its first drawing: how far the
 * drawing has reached, measured as a radius in canvas pixels, and how soft
 * that advancing edge is. One front carries grain, ink and ring weight
 * together, so nothing arrives as a separate later pass.
 */
export type RevealState = {
  radius: number;
  feather: number;
  index: number;
};

function interpolate(values: number[], position: number, cyclic: boolean) {
  const count = values.length;
  const index = Math.floor(position);
  const t = position - index;
  const at = (offset: number) => {
    const target = index + offset;
    return cyclic
      ? values[(target + count) % count]
      : values[Math.max(0, Math.min(count - 1, target))];
  };
  const [p0, p1, p2, p3] = [at(-1), at(0), at(1), at(2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * The volume weight between two sampled observations.
 *
 * A ring is one line whose weight is modulated, not a chain of bands, so the
 * nodes are joined by a curve that is always on its way somewhere. Holding
 * each observation flat and snapping to the next made every ring a staircase:
 * a year carries 48 volume nodes against 360 rendered samples, so a join over
 * a tenth of the interval lands inside a single sample — the whole change of
 * weight happening in one degree of arc, forty-eight times a ring. That reads
 * as segments butted together, which is exactly what the drawing is not.
 *
 * The tangents are Catmull-Rom — the same curve the price relief is read
 * with — limited the Fritsch–Carlson way so the stroke never overshoots a
 * node it passes through. Unlimited tangents let a sharp month pull the line
 * thinner than either neighbour, and a pinch in the ink reads as a gap in the
 * record that the observations do not have.
 */
function interpolateVolumeBand(values: number[], position: number, cyclic: boolean) {
  const count = values.length;
  const at = (offset: number) => {
    const target = Math.floor(position) + offset;
    return cyclic
      ? values[((target % count) + count) % count]
      : values[Math.max(0, Math.min(count - 1, target))];
  };
  const t = position - Math.floor(position);
  const [previous, current, next, following] = [at(-1), at(0), at(1), at(2)];
  const slope = next - current;
  // Tangents are in units of one node interval, and a tangent steeper than
  // three times the span it crosses is what lets a cubic double back.
  const limit = (tangent: number) =>
    slope === 0 ? 0 : Math.max(0, Math.min(3, tangent / slope)) * slope;
  const entering = limit((next - previous) / 2);
  const leaving = limit((following - current) / 2);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * current +
    (t3 - 2 * t2 + t) * entering +
    (-2 * t3 + 3 * t2) * next +
    (t3 - t2) * leaving
  );
}

function traceContour(
  context: CanvasRenderingContext2D,
  radii: readonly number[],
  center: number,
  startSample: number,
  sampleCount: number,
  close: boolean,
) {
  context.beginPath();
  for (let index = startSample; index < sampleCount; index += 1) {
    const point = polar(center, radii[index], index);
    if (index === startSample) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  if (close) context.closePath();
}

function strokeGhostContour(
  context: CanvasRenderingContext2D,
  radii: readonly number[],
  center: number,
  color: string,
  startSample = 0,
  sampleCount = SAMPLE_COUNT,
  close = startSample === 0 && sampleCount === SAMPLE_COUNT,
  alpha = GHOST_ALPHA,
) {
  if (sampleCount - startSample < 2) return;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 0.78;
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";
  traceContour(context, radii, center, startSample, sampleCount, close);
  context.stroke();
  context.restore();
}

function polar(center: number, radius: number, sample: number) {
  const angle = -Math.PI / 2 + (sample / SAMPLE_COUNT) * TAU;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function drawBark(
  context: CanvasRenderingContext2D,
  innerBark: readonly number[],
  outerBark: readonly number[],
  center: number,
  color: string,
  alphaScale = 1,
) {
  if (alphaScale <= 0) return;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.22 * alphaScale;
  context.beginPath();
  outerBark.forEach((radius, sample) => {
    const point = polar(center, radius, sample);
    if (sample === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  for (let sample = SAMPLE_COUNT - 1; sample >= 0; sample -= 1) {
    const point = polar(center, innerBark[sample], sample);
    if (sample === SAMPLE_COUNT - 1) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fill("evenodd");

  // Bark has to read as a material, not as a drop shadow. A cambium hairline
  // separates it from the last completed year, and deterministic radial
  // fissures give the band tooth at every size.
  context.strokeStyle = color;
  context.globalAlpha = 0.55 * alphaScale;
  context.lineWidth = 0.9;
  traceContour(context, innerBark, center, 0, SAMPLE_COUNT, true);
  context.stroke();
  context.globalAlpha = 0.4 * alphaScale;
  context.lineWidth = 0.8;
  traceContour(context, outerBark, center, 0, SAMPLE_COUNT, true);
  context.stroke();
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 2) {
    const band = outerBark[sample] - innerBark[sample];
    if (band <= 0) continue;
    const noise = Math.sin(sample * 12.9898) * 43758.5453;
    const jitter = noise - Math.floor(noise);
    const start = innerBark[sample] + band * (0.08 + jitter * 0.3);
    const end = Math.min(start + band * (0.18 + jitter * 0.58), outerBark[sample] - band * 0.06);
    if (end <= start) continue;
    context.globalAlpha = (0.14 + jitter * 0.28) * alphaScale;
    context.lineWidth = 0.55 + jitter * 0.5;
    const from = polar(center, start, sample);
    const to = polar(center, end, sample);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }
  context.restore();
}

function drawMonthTicks(
  context: CanvasRenderingContext2D,
  center: number,
  indexRadius: number,
  size: number,
  color: string,
  progress = 1,
) {
  const tickInside = Math.max(2.5, size * 0.004);
  const tickOutside = Math.max(4, size * 0.006);
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = 0.52;
  context.lineWidth = Math.max(0.75, size * 0.001);
  MONTHS.forEach((_, month) => {
    for (let segment = 0; segment < VOLUME_SAMPLES_PER_MONTH; segment += 1) {
      const sample = (month * VOLUME_SAMPLES_PER_MONTH + segment) * (SAMPLE_COUNT / (MONTHS.length * VOLUME_SAMPLES_PER_MONTH));
      // The index ring is drawn as a clockwise sweep from January, so a tick
      // only exists once the sweep has reached it.
      if (sample / SAMPLE_COUNT > progress) continue;
      const inner = polar(center, indexRadius - tickInside, sample);
      const outer = polar(center, indexRadius + tickOutside, sample);
      context.beginPath();
      context.moveTo(inner.x, inner.y);
      context.lineTo(outer.x, outer.y);
      context.stroke();
    }
  });
  context.restore();
}

export function buildGeometry(data: MarketData, size: number): Geometry {
  const center = size / 2;
  const inner = size * 0.0975;
  const outer = size * 0.39;
  const gap = (outer - inner) / Math.max(1, data.years.length - 1);
  // The width every ring falls back to where its volume encoding is at rest.
  // The reveal starts every ring here before the weight pass modulates it.
  const restWidth = Math.max(MINIMUM_RING_WEIGHT, gap * 0.024);
  let baseline = Array(SAMPLE_COUNT).fill(inner);

  const rings = data.years.map((year): RingGeometry => {
    const startSample = Math.max(0, Math.min(SAMPLE_COUNT - 1, Math.floor(year.startProgress * SAMPLE_COUNT)));
    const activeSamples = Math.max(2, Math.min(SAMPLE_COUNT, Math.round(year.progress * SAMPLE_COUNT)));
    const cyclic = startSample === 0 && activeSamples === SAMPLE_COUNT;
    const rawRadii = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
      if (index < startSample) return baseline[index];
      const observedSamples = Math.max(2, activeSamples - startSample);
      const position = cyclic
        ? (index / SAMPLE_COUNT) * year.priceShape.length
        : (Math.min(index, activeSamples - 1) - startSample) / Math.max(1, observedSamples - 1) * (year.priceShape.length - 1);
      const shape = interpolate(year.priceShape, position, cyclic);
      return Math.max(baseline[index] + shape * gap * PRICE_RELIEF, baseline[index] - gap * 0.6);
    });
    const radii = rawRadii;
    if (startSample > 0) {
      // The partial 2017 ring has no January–October observations. Its ghost
      // arc must connect the final December node back to the first November
      // node—not return to the original circle—otherwise every following
      // annual ring inherits a hard December-to-January seam.
      const firstObservedRadius = radii[startSample];
      const lastObservedRadius = radii[activeSamples - 1];
      for (let index = 0; index < startSample; index += 1) {
        const t = (index + 1) / (startSample + 1);
        radii[index] = lastObservedRadius + (firstObservedRadius - lastObservedRadius) * t;
      }
    }
    if (startSample === 0 && activeSamples < SAMPLE_COUNT) {
      const lastObserved = activeSamples - 1;
      const missingSamples = SAMPLE_COUNT - activeSamples;
      const joinSamples = Math.min(18, Math.max(6, Math.floor(missingSamples * 0.16)));
      const closingSamples = 12;
      const closingStart = SAMPLE_COUNT - closingSamples;
      const closingRadius = baseline[closingStart];
      const incomingSlope = baseline[closingStart] - baseline[closingStart - 1];
      const outgoingSlope = radii[1] - radii[0];
      for (let index = activeSamples; index < SAMPLE_COUNT; index += 1) {
        const futureRadius = baseline[index];
        if (index < activeSamples + joinSamples) {
          const t = (index - lastObserved) / (joinSamples + 1);
          const eased = t * t * (3 - 2 * t);
          radii[index] = radii[lastObserved] + (futureRadius - radii[lastObserved]) * eased;
        } else if (index >= closingStart) {
          const t = (index - closingStart) / closingSamples;
          const t2 = t * t;
          const t3 = t2 * t;
          const startWeight = 2 * t3 - 3 * t2 + 1;
          const startTangentWeight = t3 - 2 * t2 + t;
          const endWeight = -2 * t3 + 3 * t2;
          const endTangentWeight = t3 - t2;
          radii[index] =
            startWeight * closingRadius +
            startTangentWeight * incomingSlope * closingSamples +
            endWeight * radii[0] +
            endTangentWeight * outgoingSlope * closingSamples;
        } else {
          radii[index] = futureRadius;
        }
      }
    }
    // A year ring always remains visually authoritative, even where its
    // volume encoding is at rest. The interstitial contours below are only
    // ghost grain and must never read at the same weight.
    const rest = Math.max(MINIMUM_RING_WEIGHT, gap * 0.024);
    const volumeWeightAt = (month: number) => {
      const exact = year.months.find((record) => record.month === month);
      if (exact) return exact.volumeWeight;
      const earlier = year.months.filter((record) => record.month < month).at(-1);
      return earlier?.volumeWeight ?? year.months[0]?.volumeWeight ?? 0;
    };
    // New cache records provide four daily-volume nodes per month. Legacy
    // records retain the monthly-node fallback until the next refresh; both
    // are read through the same curve, so a ring's weight is continuous
    // whichever the cache happens to hold. The fallback is carried out to a
    // full twelve so a partial year's nodes still sit on their own months.
    const monthlyWeights = Array.from({ length: MONTHS.length }, (_, month) => volumeWeightAt(month));
    const volumeNodes = year.volumeShape?.length ? year.volumeShape : monthlyWeights;
    const volumeValues = year.volumeShape?.length
      ? year.volumeShape
      : year.months.map((record) => record.volumeWeight);
    const volumeMean = volumeValues.reduce((total, value) => total + value, 0) / Math.max(1, volumeValues.length);
    const volumeMinimum = Math.min(...volumeValues);
    const volumeMaximum = Math.max(...volumeValues);
    const volumeSpan = volumeMaximum - volumeMinimum;
    const visualVolumeWeight = (globalWeight: number) => {
      const localWeight = volumeSpan < 0.0001 ? 0.5 : (globalWeight - volumeMinimum) / volumeSpan;
      const yearBaseline = VOLUME_YEAR_BASELINE_MIN + volumeMean * VOLUME_YEAR_BASELINE_RANGE;
      // Global scale sets the ring's overall density; local range only
      // modulates that baseline, so high-volume years stay visibly heavier.
      return Math.max(0, Math.min(1, yearBaseline + (localWeight - 0.5) * VOLUME_LOCAL_CONTRAST));
    };
    const widths = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
      const observedSamples = Math.max(2, activeSamples - startSample);
      const shapePosition = cyclic
        ? (index / SAMPLE_COUNT) * volumeNodes.length
        : (Math.min(index, activeSamples - 1) - startSample) / Math.max(1, observedSamples - 1) * Math.max(0, volumeNodes.length - 1);
      const volumeWeight = interpolateVolumeBand(volumeNodes, shapePosition, cyclic);
      return rest + visualVolumeWeight(volumeWeight) * gap * VOLUME_WIDTH_RANGE;
    });
    // Every succeeding year starts from the actual previous contour. This is
    // especially important for partial 2017: averaging its observed relief
    // before drawing 2018 lets its highest points collide with the next ring.
    // Carrying the full outline preserves a stable radial clearance, while the
    // unobserved arc remains visibly ghosted in the static artwork.
    baseline = radii.map((radius) => radius + gap * 0.9);
    return {
      year: year.year,
      radii,
      widths,
      startSample,
      activeSamples,
    };
  });

  const marketBands: YearBandGeometry[] = rings.map((ring, index) => {
    const year = data.years[index];
    const previousRing = rings[index - 1];
    const nextRing = rings[index + 1];
    const innerBoundary = ring.radii.map((radius, sample) =>
      previousRing ? (previousRing.radii[sample] + radius) / 2 : radius - gap * 0.5);
    const outerBoundary = ring.radii.map((radius, sample) =>
      nextRing ? (nextRing.radii[sample] + radius) / 2 : radius + gap * 0.5);
    return {
      year: year.year,
      radii: ring.radii,
      widths: ring.widths,
      startFraction: 0,
      activeFraction: year.progress,
      innerBoundary,
      outerBoundary,
      marketYearIndex: index,
    };
  });

  const firstMarketYear = data.years[0]?.year ?? Number(data.source.cutoff.slice(0, 4));
  const originYear = Number(data.chronology.origin.slice(0, 4));
  const firstMarketRing = rings[0];
  const preMarketContours = Array.from(
    { length: Math.max(0, firstMarketYear - originYear) },
    (_, index) => {
      const year = originYear + index;
      const radius = inner - gap * (firstMarketYear - year);
      // The ghost chronology grows from a true central circle toward the
      // first market contour. This bridges unpriced time into the observed
      // 2017 arc without pretending its missing months are observations.
      const shapeBlend = index / Math.max(1, firstMarketYear - originYear);
      return firstMarketRing
        ? firstMarketRing.radii.map((firstRadius) => radius + (firstRadius - inner) * shapeBlend)
        : Array(SAMPLE_COUNT).fill(radius);
    },
  );
  const preMarketBands: YearBandGeometry[] = preMarketContours.map((radii, index) => {
    const previous = preMarketContours[index - 1];
    const next = preMarketContours[index + 1] ?? firstMarketRing?.radii;
    const sharedBoundary = (neighbor: number[]) => radii.map((radius, sample) => (radius + neighbor[sample]) / 2);
    return {
      year: originYear + index,
      radii,
      widths: Array(SAMPLE_COUNT).fill(0.72),
      startFraction: index === 0 ? 210.5 / 365 : 0,
      activeFraction: 1,
      // Neighbor midpoints keep each interpolated ghost band continuous with
      // the next one; a fixed half-gap leaves visible seams as the contour
      // becomes more like the first market year.
      innerBoundary: previous ? sharedBoundary(previous) : radii.map((value) => value - gap * 0.5),
      outerBoundary: next ? sharedBoundary(next) : radii.map((value) => value + gap * 0.5),
      marketYearIndex: null,
    };
  });
  const connectedMarketBands = marketBands.map((band, index) =>
    index === 0 && preMarketBands.length
      ? { ...band, innerBoundary: preMarketBands.at(-1)!.outerBoundary }
      : band,
  );
  const yearBands = [...preMarketBands, ...connectedMarketBands];

  const outerVisualRing = rings.at(-1)!;
  const bark = outerVisualRing.radii.map((radius, index) => {
    const angle = -Math.PI / 2 + (index / SAMPLE_COUNT) * TAU;
    const coarse = Math.sin(angle * 3.2 + 1.1) * 0.09;
    const chip = Math.sin(angle * 15.7 - 0.4) * 0.065 + Math.sin(angle * 29.4 + 2.1) * 0.038;
    const spike = Math.max(0, Math.sin(angle * 21.3 + 1.8)) ** 7 * 0.12;
    const notch = -(Math.max(0, Math.sin(angle * 8.1 - 0.7)) ** 9) * 0.15;
    return radius + gap * (0.69 + coarse + chip + spike + notch);
  });
  const indexRadius = Math.max(...bark) + gap * 0.18;

  const canonicalEvents = [
    ...data.milestones.map((record) => ({ kind: "milestone" as const, record })),
  ];
  const anchors = resolveEventCollisions(
    buildEventAnchors(canonicalEvents, yearBands, { center, size, gap, lastDate: data.source.cutoff }),
    { pointer: "coarse", selectionHaloPx: 3 },
  );
  const knots = anchors.flatMap((anchor) => {
    if (anchor.kind !== "milestone") return [];
    const event = data.milestones.find((candidate) => candidate.id === anchor.eventId);
    return event ? [buildKnotGeometry(event, anchor, gap)] : [];
  });
  const events: EventGeometry = {
    knots,
    fineHitRegions: buildEventHitRegions(knots, [], "fine"),
    coarseHitRegions: buildEventHitRegions(knots, [], "coarse"),
  };

  // A calendar segment is interactive only when it can reveal an observed
  // market reading or one of the marks drawn on that segment. Marks extend
  // the segment; they are never an independent pointer target.
  const selectableMonths = [
    ...data.years.flatMap((year) => year.months.map((month) => ({ year: year.year, month: month.month }))),
    ...anchors.map((anchor) => ({ year: anchor.year, month: Number(anchor.date.slice(5, 7)) - 1 })),
  ].filter((segment, index, all) => all.findIndex((candidate) =>
    candidate.year === segment.year && candidate.month === segment.month,
  ) === index);

  const grain = buildGrainContours(rings, yearBands, gap, inner);
  return { center, size, gap, inner, indexRadius, restWidth, bark, grain, rings, yearBands, selectableMonths, events };
}

function fillVariableContour(
  context: CanvasRenderingContext2D,
  ring: RingGeometry,
  center: number,
  color: string,
  startSample = ring.startSample,
  endSample = ring.activeSamples,
  alpha = 1,
  widthBoost = 0,
) {
  const start = Math.max(ring.startSample, startSample);
  const end = Math.min(endSample, SAMPLE_COUNT);
  if (end - start < 2) return;
  context.save();
  context.fillStyle = color;
  context.globalAlpha *= alpha * 0.78;
  traceVariableContour(context, ring, center, start, end, widthBoost);
  context.fill();
  if (start > 0 || end < SAMPLE_COUNT) {
    for (const sample of [start, end]) {
      const index = sample % SAMPLE_COUNT;
      const point = polar(center, ring.radii[index], sample);
      context.beginPath();
      context.arc(point.x, point.y, (ring.widths[index] + widthBoost) / 2, 0, TAU);
      context.fill();
    }
  }
  context.restore();
}

function traceVariableContour(
  context: CanvasRenderingContext2D,
  ring: RingGeometry,
  center: number,
  start: number,
  end: number,
  widthBoost = 0,
) {
  context.beginPath();
  for (let sample = start; sample <= end; sample += 1) {
    const index = sample % SAMPLE_COUNT;
    const point = polar(center, ring.radii[index] + (ring.widths[index] + widthBoost) / 2, sample);
    if (sample === start) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  for (let sample = end; sample >= start; sample -= 1) {
    const index = sample % SAMPLE_COUNT;
    const point = polar(center, ring.radii[index] - (ring.widths[index] + widthBoost) / 2, sample);
    context.lineTo(point.x, point.y);
  }
  context.closePath();
}

function traceMonthWedge(
  context: CanvasRenderingContext2D,
  inner: readonly number[],
  outer: readonly number[],
  month: number,
  center: number,
) {
  const start = month * 30;
  const end = start + 30;
  context.beginPath();
  for (let sample = start; sample <= end; sample += 1) {
    const index = sample % SAMPLE_COUNT;
    const point = polar(center, outer[index], sample);
    if (sample === start) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  for (let sample = end; sample >= start; sample -= 1) {
    const index = sample % SAMPLE_COUNT;
    const point = polar(center, inner[index], sample);
    context.lineTo(point.x, point.y);
  }
  context.closePath();
}

/**
 * The wedge outline: one month of the plate, pith to bark.
 *
 * It is the whole of the reading while the calendar is being drawn — a bare
 * figure turning with the pen — and the frame around it once the reading has
 * landed. Sixty lines and a stroke, so it can be redrawn every frame of the
 * sweep without costing the circle its smoothness.
 *
 * It takes a month rather than a selection because during the sweep there is
 * no selection yet: the wedge is following the calendar, not a reading.
 */
export function strokeMonthWedge(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  month: number,
  color: string,
) {
  const innerBoundary = geometry.yearBands[0]?.innerBoundary;
  if (!innerBoundary) return;
  context.save();
  traceMonthWedge(context, innerBoundary, geometry.bark, month, geometry.center);
  context.strokeStyle = color;
  context.globalAlpha = 0.22;
  context.lineWidth = Math.max(0.9, geometry.size * 0.0013);
  context.stroke();
  context.restore();
}

function tracePointPath(
  context: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  close: boolean,
) {
  if (!points.length) return;
  // Leaders are drawn lines and stay straight. A closed path is a knot, and a
  // knot in wood has no corners: run a smooth loop through the same control
  // points instead of stroking the polygon between them.
  if (!close || points.length < 3) {
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    if (close) context.closePath();
    return;
  }
  const count = points.length;
  const at = (index: number) => points[((index % count) + count) % count];
  context.beginPath();
  context.moveTo(at(0).x, at(0).y);
  for (let index = 0; index < count; index += 1) {
    const previous = at(index - 1);
    const from = at(index);
    const to = at(index + 1);
    const next = at(index + 2);
    context.bezierCurveTo(
      from.x + (to.x - previous.x) / 6,
      from.y + (to.y - previous.y) / 6,
      to.x - (next.x - from.x) / 6,
      to.y - (next.y - from.y) / 6,
      to.x,
      to.y,
    );
  }
  context.closePath();
}

function knotCentre(path: readonly { x: number; y: number }[]) {
  let x = 0;
  let y = 0;
  path.forEach((point) => { x += point.x; y += point.y; });
  return { x: x / path.length, y: y / path.length };
}

function drawKnot(
  context: CanvasRenderingContext2D,
  knot: KnotGeometry,
  color: string,
  scale = 1,
  alpha = 1,
) {
  context.save();
  context.fillStyle = color;
  // A finished knot is drawn at full strength; an emerging one has to multiply
  // into whatever the caller set, or it pops in at full opacity while it grows.
  if (alpha >= 1) context.globalAlpha = 1;
  else context.globalAlpha *= alpha;
  const centre = knotCentre(knot.path);
  const path = scale >= 1
    ? knot.path
    : knot.path.map((point) => ({
      x: centre.x + (point.x - centre.x) * scale,
      y: centre.y + (point.y - centre.y) * scale,
    }));
  tracePointPath(context, path, true);
  context.fill();
  context.restore();
}

export function drawStaticArtwork(
  context: CanvasRenderingContext2D,
  _data: MarketData,
  geometry: Geometry,
  colors: { ink: string; grain: string; muted: string; mark: string; bark: string },
) {
  context.clearRect(0, 0, geometry.size, geometry.size);
  drawGroundLayer(context, geometry, colors);
  drawInkLayer(context, geometry, colors);
  drawKnotLayer(context, geometry, colors);
  drawIndexLayer(context, geometry, colors);
}

/**
 * One ghost contour of the construction drawing, with the radius it sits at.
 * The reveal fades these in along a soft radial front rather than uncovering
 * them through a clip, so each one has to be addressable on its own.
 */
export type GrainContour = {
  radii: number[];
  mean: number;
  alpha: number;
  startSample: number;
  sampleCount: number;
  close: boolean;
};

function contourMean(radii: readonly number[], startSample: number, sampleCount: number) {
  let total = 0;
  let count = 0;
  for (let index = startSample; index < sampleCount; index += 1) {
    total += radii[index];
    count += 1;
  }
  return count ? total / count : 0;
}

/** How far a mark at `mean` has emerged behind an advancing front. */
function frontAlpha(reveal: { radius: number; feather: number } | undefined, mean: number) {
  if (!reveal) return 1;
  return clamp01((reveal.radius - mean) / Math.max(1, reveal.feather));
}

/**
 * Every ghost contour of the construction drawing, ordered from the pith
 * outward. Built once per resize: the reveal reads this list every frame.
 */
export function buildGrainContours(
  rings: readonly RingGeometry[],
  yearBands: readonly YearBandGeometry[],
  gap: number,
  inner: number,
): GrainContour[] {
  const contours: GrainContour[] = [];
  const add = (
    radii: number[],
    alpha: number,
    startSample = 0,
    sampleCount = SAMPLE_COUNT,
    close = startSample === 0 && sampleCount === SAMPLE_COUNT,
  ) => {
    contours.push({ radii, alpha, startSample, sampleCount, close, mean: contourMean(radii, startSample, sampleCount) });
  };

  const emptyYearBands = yearBands.filter((band) => band.marketYearIndex === null);
  const preMarketStart = emptyYearBands[0]?.innerBoundary ?? Array(SAMPLE_COUNT).fill(inner * 0.16);
  const emptyGhostAlphaAt = (progress: number) => {
    const clamped = Math.max(0, Math.min(1, progress));
    return EMPTY_GHOST_ALPHA_MIN + (EMPTY_GHOST_ALPHA_MAX - EMPTY_GHOST_ALPHA_MIN) * clamped;
  };
  const firstMarketRing = rings[0];
  if (emptyYearBands.length && firstMarketRing) {
    Array.from({ length: PRE_MARKET_GHOST_COUNT }, (_, index) => (index + 1) / (PRE_MARKET_GHOST_COUNT + 1)).forEach((progress) => {
      // Treat the unpriced years and 2017's missing arc as one transition:
      // every ghost contour interpolates directly from the central circle to
      // the first observed market outline. This avoids a compressed cluster
      // beside the partial 2017 ring.
      const radii = preMarketStart.map((startRadius, sample) =>
        startRadius + (firstMarketRing.radii[sample] - startRadius) * progress);
      add(radii, emptyGhostAlphaAt(progress));
    });
  }

  for (let index = 0; index < rings.length - 1; index += 1) {
    INTERSTITIAL_GHOST_FRACTIONS.forEach((fraction, grainIndex) => {
      const radii = rings[index].radii.map((radius, sample) => {
        const next = rings[index + 1].radii[sample];
        const angle = -Math.PI / 2 + (sample / SAMPLE_COUNT) * TAU;
        const noise = (
          Math.sin(angle * 9 + (index * 5 + grainIndex) * 1.7) +
          Math.sin(angle * 17 - (index * 5 + grainIndex) * 0.8) * 0.55
        ) * gap * 0.012;
        const value = radius + (next - radius) * fraction + noise;
        return Math.max(radius + gap * 0.045, Math.min(next - gap * 0.045, value));
      });
      add(radii, GHOST_ALPHA);
    });
  }
  rings.forEach((ring) => {
    if (ring.startSample > 0) {
      add(ring.radii, GHOST_ALPHA, 0, ring.startSample + 1, false);
    }
    if (ring.activeSamples < SAMPLE_COUNT) {
      add(ring.radii, GHOST_ALPHA, ring.activeSamples - 1, SAMPLE_COUNT, false);
    }
  });
  return contours.sort((left, right) => left.mean - right.mean);
}

/**
 * Bark and every ghost contour: the construction drawing under the inked
 * rings. This is the finished-plate path and keeps the original draw order,
 * so the artwork it produces is unchanged.
 */
function drawGroundLayer(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { ink: string; grain: string; muted: string; mark: string; bark: string },
) {
  const { center, rings, bark, grain } = geometry;
  drawBark(context, rings.at(-1)!.radii, bark, center, colors.bark);
  grain.forEach((contour) => drawGrainContour(context, contour, center, colors.grain, 1));
}

function drawGrainContour(
  context: CanvasRenderingContext2D,
  contour: GrainContour,
  center: number,
  color: string,
  alphaScale: number,
) {
  if (alphaScale <= 0) return;
  strokeGhostContour(
    context,
    contour.radii,
    center,
    color,
    contour.startSample,
    contour.sampleCount,
    contour.close,
    contour.alpha * alphaScale,
  );
}

/**
 * Bake the bark band on its own. Redrawing it costs roughly two hundred draw
 * calls, which is far too much to repeat every frame, and it has to stay
 * beneath the grain, so it cannot join the grain's progressive bake.
 */
export function drawBarkLayer(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { bark: string },
) {
  const { center, rings, bark, size } = geometry;
  context.clearRect(0, 0, size, size);
  drawBark(context, rings.at(-1)!.radii, bark, center, colors.bark);
}

/** How far the bark has emerged behind the front. */
export function barkAlphaAt(geometry: Geometry, reveal: RevealState) {
  return frontAlpha(reveal, contourMean(geometry.rings.at(-1)!.radii, 0, SAMPLE_COUNT));
}

/**
 * Grain contours are sorted by radius and the front only advances, so the
 * contours that have reached full opacity are always a prefix. Everything in
 * that prefix is baked once and blitted thereafter, which keeps the per-frame
 * work to the handful of contours actually inside the feathered edge.
 */
export function settledGrainCount(geometry: Geometry, reveal: RevealState, from: number) {
  let index = from;
  while (index < geometry.grain.length && frontAlpha(reveal, geometry.grain[index].mean) >= 1) index += 1;
  return index;
}

export function bakeGrain(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { grain: string },
  from: number,
  to: number,
) {
  for (let index = from; index < to; index += 1) {
    drawGrainContour(context, geometry.grain[index], geometry.center, colors.grain, 1);
  }
}

/**
 * The inked year rings. A ring emerges as the front reaches it and takes on
 * its volume weight in the same movement, trailing its own outline only
 * slightly: the weight is part of drawing the line, not a later pass over it.
 */
function drawInkLayer(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { ink: string },
  reveal?: { radius: number; feather: number },
) {
  const { center, rings, restWidth, gap } = geometry;
  rings.forEach((ring) => {
    const end = ring.activeSamples === SAMPLE_COUNT ? SAMPLE_COUNT : ring.activeSamples - 1;
    if (!reveal) {
      fillVariableContour(context, ring, center, colors.ink, ring.startSample, end, 0.82);
      return;
    }
    const mean = contourMean(ring.radii, ring.startSample, end);
    const arrival = frontAlpha(reveal, mean);
    if (arrival <= 0) return;
    const weight = clamp01((reveal.radius - mean - gap * WEIGHT_LAG_GAPS) / (gap * WEIGHT_SPAN_GAPS));
    const weighted: RingGeometry = {
      ...ring,
      widths: ring.widths.map((width) => restWidth + (width - restWidth) * weight),
    };
    context.save();
    context.globalAlpha = arrival;
    fillVariableContour(context, weighted, center, colors.ink, weighted.startSample, end, 0.82);
    context.restore();
  });
}

/**
 * Knots and their leaders. Each one swells from a seed as the front reaches its
 * own radius, so a knot belongs to the ring it sits on rather than being
 * punched into a finished plate afterwards.
 */
function drawKnotLayer(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { ink: string; mark: string },
  reveal?: { radius: number; feather: number },
) {
  const { center, gap } = geometry;
  const emergence = (knot: KnotGeometry) => {
    if (!reveal) return 1;
    const centre = knotCentre(knot.path);
    const mean = Math.hypot(centre.x - center, centre.y - center);
    return clamp01((reveal.radius - mean - gap * KNOT_LAG_GAPS) / (gap * KNOT_SPAN_GAPS));
  };
  geometry.events.knots.forEach((knot) => {
    const grown = emergence(knot);
    if (grown <= 0) return;
    if (!reveal) {
      drawKnot(context, knot, colors.mark);
      return;
    }
    drawKnot(context, knot, colors.mark, KNOT_MINIMUM_SCALE + (1 - KNOT_MINIMUM_SCALE) * grown, grown);
  });
  geometry.events.knots.forEach((knot) => {
    const anchor = knot.anchor;
    if (!anchor.leader) return;
    const grown = emergence(knot);
    if (grown <= 0) return;
    context.save();
    context.strokeStyle = colors.ink;
    context.globalAlpha = 0.55 * grown;
    context.lineWidth = 1;
    tracePointPath(context, anchor.leader, false);
    context.stroke();
    context.restore();
  });
}

/** The index ring, its month ticks and its labels: the sheet's calendar axis. */
function drawIndexLayer(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { muted: string },
  progress = 1,
) {
  const { center, size, indexRadius } = geometry;
  const sweep = clamp01(progress);
  if (sweep <= 0) return;
  context.save();
  context.strokeStyle = colors.muted;
  context.lineWidth = 1;
  context.globalAlpha = 0.45;
  context.beginPath();
  // Clockwise from January, because the angular axis of the plate is the year.
  context.arc(center, center, indexRadius, -Math.PI / 2, -Math.PI / 2 + sweep * TAU);
  context.stroke();
  context.globalAlpha = 1;
  context.restore();
  // The finished plate takes the canonical call; only a sweep in progress needs
  // to withhold the ticks the pen has not reached yet.
  if (sweep >= 1) drawMonthTicks(context, center, indexRadius, size, colors.muted);
  else drawMonthTicks(context, center, indexRadius, size, colors.muted, sweep);

  const labelFontSize = Math.max(9, size * 0.018);
  const labelClearance = Math.max(5, size * 0.012);
  context.save();
  context.fillStyle = colors.muted;
  context.font = `400 ${labelFontSize}px "Courier Prime", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  MONTHS.forEach((month, index) => {
    const angle = -Math.PI / 2 + (index / 12) * TAU;
    // Each label settles just behind the sweep that uncovered its tick.
    const arrival = clamp01((sweep - index / 12) / 0.06);
    if (arrival <= 0) return;
    context.globalAlpha = arrival;
    const label = month.toUpperCase();
    const halfWidth = context.measureText(label).width / 2;
    const halfHeight = labelFontSize / 2;
    const textExtent = Math.abs(Math.cos(angle)) * halfWidth + Math.abs(Math.sin(angle)) * halfHeight;
    const labelRadius = indexRadius + labelClearance + textExtent;
    const rawX = center + Math.cos(angle) * labelRadius;
    const rawY = center + Math.sin(angle) * labelRadius;
    const x = Math.max(halfWidth + 4, Math.min(size - halfWidth - 4, rawX));
    const y = Math.max(10, Math.min(size - 10, rawY));
    context.fillText(label, x, y);
  });
  context.restore();
}

/**
 * One frame of the plate being drawn. Grain, ink and ring weight all emerge
 * together at each radius behind a single soft front, so the construction
 * lines and the year they belong to arrive as one gesture rather than as
 * separate passes. Settled work is blitted; only the feathered edge is live.
 */
export function drawRevealFrame(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  colors: { ink: string; grain: string; muted: string; mark: string; bark: string },
  reveal: RevealState,
  layers: { bark: HTMLCanvasElement | null; grain: HTMLCanvasElement | null; settled: number },
) {
  const { center, size } = geometry;
  context.clearRect(0, 0, size, size);

  // Blit the baked layers at their native device resolution. Drawing them
  // through the context's device-pixel transform sends them down a resampling
  // path, which smears every hairline the bake was meant to preserve.
  const blit = (image: HTMLCanvasElement, alpha: number) => {
    context.save();
    context.globalAlpha = alpha;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(image, 0, 0);
    context.restore();
  };

  const barkAlpha = barkAlphaAt(geometry, reveal);
  if (layers.bark && barkAlpha > 0) blit(layers.bark, barkAlpha);
  if (layers.grain && layers.settled > 0) blit(layers.grain, 1);
  for (let index = layers.settled; index < geometry.grain.length; index += 1) {
    const contour = geometry.grain[index];
    drawGrainContour(context, contour, center, colors.grain, frontAlpha(reveal, contour.mean));
  }

  drawInkLayer(context, geometry, colors, reveal);
  drawKnotLayer(context, geometry, colors, reveal);
  if (reveal.index > 0) drawIndexLayer(context, geometry, colors, reveal.index);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Where the outermost ring stops growing: the live edge of the specimen. The
 * introduction promises that this ring is unfinished and that each new day can
 * change its shape, and nothing on the plate showed that until now. Returned
 * in canvas units so a marker can be placed over the plate in CSS.
 */
/**
 * The radius the front must reach for every mark to be finished: the last
 * contour visible, the last ring at full weight, the last knot fully grown.
 *
 * Derived rather than assumed. A fixed overshoot either strands the outermost
 * rings part-grown or leaves the front travelling through empty space after
 * the last of them has finished, which reads as the animation stalling.
 */
export function revealFrontEnd(geometry: Geometry, feather: number) {
  const { center, rings, grain, gap } = geometry;
  const weightReach = gap * (WEIGHT_LAG_GAPS + WEIGHT_SPAN_GAPS);
  const knotReach = gap * (KNOT_LAG_GAPS + KNOT_SPAN_GAPS);
  let end = contourMean(rings.at(-1)!.radii, 0, SAMPLE_COUNT) + feather;
  grain.forEach((contour) => { end = Math.max(end, contour.mean + feather); });
  rings.forEach((ring) => {
    const end_ = ring.activeSamples === SAMPLE_COUNT ? SAMPLE_COUNT : ring.activeSamples - 1;
    end = Math.max(end, contourMean(ring.radii, ring.startSample, end_) + weightReach);
  });
  geometry.events.knots.forEach((knot) => {
    const centre = knotCentre(knot.path);
    end = Math.max(end, Math.hypot(centre.x - center, centre.y - center) + knotReach);
  });
  return end;
}

/**
 * The radii the front steps between: every line of the drawing in turn — each
 * ghost contour of the construction grain and each inked year ring, from the
 * pith outward — and then the reach the trailing weight needs.
 *
 * One stop per line, not per year. A year is six lines (five of grain and one
 * of ink); stepping the front a year at a time made them arrive as a block,
 * and a specimen is not laid down in blocks. It is laid down a layer at a
 * time, and the reveal steps the same way.
 *
 * The ghosted arcs of a partial ring sit at their ring's radius and are the
 * same line; stops closer together than a sliver of a gap are merged.
 */
export function revealStops(geometry: Geometry, feather: number) {
  const lines = [
    ...geometry.grain.map((contour) => contour.mean),
    ...geometry.rings.map((ring) => {
      const end = ring.activeSamples === SAMPLE_COUNT ? SAMPLE_COUNT : ring.activeSamples - 1;
      return contourMean(ring.radii, ring.startSample, end);
    }),
  ].sort((left, right) => left - right);
  const stops: number[] = [];
  const sliver = geometry.gap * 0.05;
  lines.forEach((radius) => {
    if (stops.length && radius - stops[stops.length - 1] < sliver) return;
    stops.push(radius);
  });
  stops.push(revealFrontEnd(geometry, feather));
  return stops;
}

/**
 * Each year paired with the radius at which its band is wholly behind the
 * front — the midline to the next year, so a band is "reached" when the
 * drawing is closer to its successor than to it.
 *
 * Computed with the geometry rather than per frame: it is a couple of dozen
 * means over the sample ring, and the reveal asks for it sixty times a second.
 */
export function yearReach(geometry: Geometry) {
  return geometry.yearBands.map((band) => ({
    year: band.year,
    reach: band.outerBoundary.reduce((sum, radius) => sum + radius, 0) / Math.max(1, band.outerBoundary.length),
  }));
}

/** The year the front is currently laying down, given that table. */
export function yearAtRadius(reach: readonly { year: number; reach: number }[], radius: number) {
  const band = reach.find((candidate) => radius < candidate.reach);
  return band ? band.year : reach.at(-1)?.year ?? 0;
}

/** The radius at a fractional position along the stops, counting from the pith. */
export function radiusAtStop(stops: readonly number[], position: number) {
  if (!stops.length) return 0;
  const clamped = Math.max(0, Math.min(stops.length, position));
  const index = Math.min(stops.length - 1, Math.floor(clamped));
  const from = index === 0 ? 0 : stops[index - 1];
  const to = stops[index];
  return from + (to - from) * (clamped - index);
}

export function growthFrontier(geometry: Geometry) {
  const ring = geometry.rings.at(-1);
  if (!ring) return null;
  const sample = Math.max(0, Math.min(SAMPLE_COUNT - 1, ring.activeSamples - 1));
  return polar(geometry.center, ring.radii[sample], sample);
}

/**
 * The reading: the plate dimmed to one month, with that month brought back up
 * out of the wash at full contrast.
 *
 * `arrival` is how far the reading has come in — 1 for any ordinary paint, and
 * a ramp only while the entrance is landing it. Everything here is a
 * counterweight to the wash the caller has laid down, so all of it scales
 * together: dim the plate half way and the segment is restored half way, and
 * the reading is correct at every point of the movement rather than only at
 * the end of it.
 *
 * The wedge outline is the exception. It has been turning with the calendar's
 * pen since January was struck, and the reading landing around it must not
 * make it flicker, so it is drawn at its own weight throughout.
 */
export function drawSelection(
  context: CanvasRenderingContext2D,
  _data: MarketData,
  geometry: Geometry,
  selection: Selection,
  color: string,
  source: CanvasImageSource,
  arrival = 1,
) {
  const band = geometry.yearBands.find((candidate) => candidate.year === selection.year);
  if (!band) return;
  const monthStart = selection.month * 30;
  const startSample = Math.floor(band.startFraction * SAMPLE_COUNT);
  const activeSamples = Math.ceil(band.activeFraction * SAMPLE_COUNT);
  if (monthStart + 30 <= startSample || monthStart >= activeSamples) return;
  const actualEnd = activeSamples === SAMPLE_COUNT ? SAMPLE_COUNT : activeSamples - 1;
  const start = Math.max(monthStart, startSample);
  const end = Math.min(monthStart + 30, actualEnd);

  if (end - start < 2) return;

  const wedgeInner = geometry.yearBands[0]?.innerBoundary;
  if (wedgeInner) {
    context.save();
    traceMonthWedge(context, wedgeInner, geometry.bark, selection.month, geometry.center);
    context.clip();
    // Taken down the same way the caller's wash is: the drawing inside the
    // wedge is faded, not covered, so nothing paints a slice of paper over the
    // gaps between the rings.
    context.globalCompositeOperation = "destination-out";
    context.globalAlpha = 0.2 * arrival;
    context.fillRect(0, 0, geometry.size, geometry.size);
    context.restore();
  }

  const selectedRing = {
    year: band.year,
    radii: [...band.radii],
    widths: [...band.widths],
    startSample,
    activeSamples,
  };
  // The entire specimen is faded by the caller. Restore precisely the active
  // segment rather than filling its month wedge, so it alone returns to the
  // normal drawing contrast.
  context.save();
  traceVariableContour(context, selectedRing, geometry.center, start, end);
  context.clip();
  context.drawImage(source, 0, 0, geometry.size, geometry.size);
  context.globalAlpha = 0.55 * arrival;
  context.drawImage(source, 0, 0, geometry.size, geometry.size);
  context.restore();
  strokeMonthWedge(context, geometry, selection.month, color);

  // The reading is taken at the perimeter, where the month labels are, so the
  // index ring carries a solid accent arc across the selected month.
  const wedgeStart = -Math.PI / 2 + (selection.month / 12) * TAU;
  context.save();
  context.strokeStyle = color;
  context.globalAlpha = arrival;
  context.lineWidth = Math.max(1.4, geometry.size * 0.0022);
  context.beginPath();
  context.arc(geometry.center, geometry.center, geometry.indexRadius, wedgeStart, wedgeStart + TAU / 12);
  context.stroke();
  context.restore();

  // Restore a knot at normal ink contrast without giving it a separate accent:
  // a selected segment remains the only colored element.
  const selectedMonth = selection.month + 1;
  context.save();
  geometry.events.knots
    .filter((knot) => knot.anchor.year === selection.year && Number(knot.anchor.date.slice(5, 7)) === selectedMonth)
    .forEach((knot) => {
      context.save();
      tracePointPath(context, knot.path, true);
      context.clip();
      context.drawImage(source, 0, 0, geometry.size, geometry.size);
      context.globalAlpha = 0.55 * arrival;
      context.drawImage(source, 0, 0, geometry.size, geometry.size);
      context.restore();
    });
  context.restore();

  const labelFontSize = Math.max(9, geometry.size * 0.018);
  const labelClearance = Math.max(5, geometry.size * 0.012);
  const angle = -Math.PI / 2 + (selection.month / 12) * TAU;
  const label = MONTHS[selection.month].toUpperCase();
  context.save();
  context.fillStyle = color;
  context.globalAlpha = arrival;
  context.font = `400 ${labelFontSize}px "Courier Prime", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const halfWidth = context.measureText(label).width / 2;
  const halfHeight = labelFontSize / 2;
  const textExtent = Math.abs(Math.cos(angle)) * halfWidth + Math.abs(Math.sin(angle)) * halfHeight;
  const labelRadius = geometry.indexRadius + labelClearance + textExtent;
  const rawX = geometry.center + Math.cos(angle) * labelRadius;
  const rawY = geometry.center + Math.sin(angle) * labelRadius;
  const x = Math.max(halfWidth + 4, Math.min(geometry.size - halfWidth - 4, rawX));
  const y = Math.max(10, Math.min(geometry.size - 10, rawY));
  context.fillText(label, x, y);
  context.restore();
}

export function drawEventSelection(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  selection: EventSelection,
  color: string,
) {
  if (!selection) return;
  const knot = selection.kind === "milestone"
    ? geometry.events.knots.find((candidate) => candidate.eventId === selection.id)
    : undefined;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 1;
  if (knot) {
    tracePointPath(context, knot.path, true);
    context.fill();
  }
  context.restore();
}

export function hitTestEvent(
  geometry: Geometry,
  x: number,
  y: number,
  pointer: "fine" | "coarse" = "fine",
) {
  return hitTestEvents(
    pointer === "coarse" ? geometry.events.coarseHitRegions : geometry.events.fineHitRegions,
    { x, y },
  );
}

export function hitTestInteractive(
  geometry: Geometry,
  x: number,
  y: number,
  pointer: "fine" | "coarse" = "fine",
): Readonly<{ event: EventSelection; market: Selection | null }> {
  void pointer;
  return { event: null, market: hitTest(geometry, x, y) };
}

export function hitTest(geometry: Geometry, x: number, y: number): Selection | null {
  const dx = x - geometry.center;
  const dy = y - geometry.center;
  const radius = Math.hypot(dx, dy);
  const minimumRadius = Math.min(...geometry.yearBands.flatMap((band) => band.innerBoundary));
  if (radius < minimumRadius || radius > geometry.indexRadius) return null;

  const angle = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU;
  const month = Math.min(11, Math.floor((angle / TAU) * 12));
  const sample = Math.floor((angle / TAU) * SAMPLE_COUNT) % SAMPLE_COUNT;
  let year: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  geometry.yearBands.forEach((band) => {
    const selectable = geometry.selectableMonths.some((segment) => segment.year === band.year && segment.month === month);
    if (!selectable || sample < band.startFraction * SAMPLE_COUNT || sample >= band.activeFraction * SAMPLE_COUNT) return;
    const nextDistance = Math.abs(radius - band.radii[sample]);
    if (nextDistance < distance) {
      distance = nextDistance;
      year = band.year;
    }
  });
  return year === null ? null : { year, month };
}
