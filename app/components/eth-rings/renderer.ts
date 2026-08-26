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
const VOLUME_TRANSITION_FRACTION = 0.12;
const VOLUME_YEAR_BASELINE_MIN = 0.08;
const VOLUME_YEAR_BASELINE_RANGE = 0.78;
const VOLUME_LOCAL_CONTRAST = 0.7;

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
  bark: number[];
  rings: RingGeometry[];
  yearBands: YearBandGeometry[];
  selectableMonths: Selection[];
  events: EventGeometry;
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

function interpolateVolumeBand(values: number[], position: number, cyclic: boolean) {
  const count = values.length;
  const index = Math.floor(position);
  const t = position - index;
  const current = cyclic
    ? values[(index + count) % count]
    : values[Math.max(0, Math.min(count - 1, index))];
  const next = cyclic
    ? values[(index + 1 + count) % count]
    : values[Math.max(0, Math.min(count - 1, index + 1))];
  // Keep each sampled observation legible as a short band. The last portion
  // joins directly into the next value without falling toward a rest width.
  const join = Math.max(0, Math.min(1, (t - (1 - VOLUME_TRANSITION_FRACTION)) / VOLUME_TRANSITION_FRACTION));
  return current + (next - current) * join;
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
) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.22;
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
  context.restore();
}

function drawMonthTicks(
  context: CanvasRenderingContext2D,
  center: number,
  indexRadius: number,
  size: number,
  color: string,
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
        ? (index / SAMPLE_COUNT) * (year.volumeShape?.length ?? 0)
        : (Math.min(index, activeSamples - 1) - startSample) / Math.max(1, observedSamples - 1) * Math.max(0, (year.volumeShape?.length ?? 1) - 1);
      const monthlyPosition = (index / SAMPLE_COUNT) * 12;
      const monthlyIndex = Math.floor(monthlyPosition);
      const monthlyProgress = monthlyPosition - monthlyIndex;
      const current = volumeWeightAt(monthlyIndex);
      const nextMonth = monthlyIndex === 11 ? (cyclic ? 0 : 11) : monthlyIndex + 1;
      const next = volumeWeightAt(nextMonth);
      // New cache records provide four daily-volume nodes per month. Legacy
      // records retain the monthly-node fallback until the next refresh.
      const volumeWeight = year.volumeShape?.length
        ? interpolateVolumeBand(year.volumeShape, shapePosition, cyclic)
        : current + (next - current) * monthlyProgress;
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

  return { center, size, gap, inner, indexRadius, bark, rings, yearBands, selectableMonths, events };
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

function strokeMonthWedge(
  context: CanvasRenderingContext2D,
  geometry: Geometry,
  selection: Selection,
  color: string,
) {
  const band = geometry.yearBands.find((candidate) => candidate.year === selection.year);
  if (!band) return;
  const innerBoundary = geometry.yearBands[0]?.innerBoundary ?? band.innerBoundary;
  context.save();
  traceMonthWedge(context, innerBoundary, geometry.bark, selection.month, geometry.center);
  context.strokeStyle = color;
  context.globalAlpha = 0.3;
  context.lineWidth = Math.max(0.8, geometry.size * 0.0012);
  context.stroke();
  context.restore();
}

function tracePointPath(
  context: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  close: boolean,
) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  if (close) context.closePath();
}

function drawKnot(
  context: CanvasRenderingContext2D,
  knot: KnotGeometry,
  color: string,
) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 1;
  tracePointPath(context, knot.path, true);
  context.fill();
  context.restore();
}

export function drawStaticArtwork(
  context: CanvasRenderingContext2D,
  data: MarketData,
  geometry: Geometry,
  colors: { ink: string; grain: string; muted: string; mark: string; bark: string },
) {
  const { center, rings, gap, inner, size, bark, indexRadius } = geometry;
  context.clearRect(0, 0, size, size);
  drawBark(context, rings.at(-1)!.radii, bark, center, colors.bark);

  const emptyYearBands = geometry.yearBands.filter((band) => band.marketYearIndex === null);
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
      strokeGhostContour(
        context,
        radii,
        center,
        colors.grain,
        0,
        SAMPLE_COUNT,
        true,
        emptyGhostAlphaAt(progress),
      );
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
      strokeGhostContour(context, radii, center, colors.grain);
    });
  }
  rings.forEach((ring) => {
    if (ring.startSample > 0) {
      strokeGhostContour(context, ring.radii, center, colors.grain, 0, ring.startSample + 1, false);
    }
    if (ring.activeSamples < SAMPLE_COUNT) {
      strokeGhostContour(
        context,
        ring.radii,
        center,
        colors.grain,
        ring.activeSamples - 1,
        SAMPLE_COUNT,
        false,
      );
    }
  });
  rings.forEach((ring) => {
    const end = ring.activeSamples === SAMPLE_COUNT ? SAMPLE_COUNT : ring.activeSamples - 1;
    fillVariableContour(context, ring, center, colors.ink, ring.startSample, end, 0.82);
  });

  geometry.events.knots.forEach((knot) => drawKnot(context, knot, colors.mark));
  geometry.events.knots.map((knot) => knot.anchor)
    .forEach((anchor) => {
      if (!anchor.leader) return;
      context.save();
      context.strokeStyle = colors.ink;
      context.globalAlpha = 0.55;
      context.lineWidth = 1;
      tracePointPath(context, anchor.leader, false);
      context.stroke();
      context.restore();
    });

  context.strokeStyle = colors.muted;
  context.lineWidth = 1;
  context.globalAlpha = 1;
  context.beginPath();
  context.arc(center, center, indexRadius, 0, TAU);
  context.stroke();
  context.globalAlpha = 1;
  drawMonthTicks(context, center, indexRadius, size, colors.muted);

  const labelFontSize = Math.max(9, size * 0.018);
  const labelClearance = Math.max(5, size * 0.012);
  context.fillStyle = colors.muted;
  context.font = `400 ${labelFontSize}px "Cutive Mono", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  MONTHS.forEach((month, index) => {
    const angle = -Math.PI / 2 + (index / 12) * TAU;
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
}

export function drawSelection(
  context: CanvasRenderingContext2D,
  _data: MarketData,
  geometry: Geometry,
  selection: Selection,
  color: string,
  source: CanvasImageSource,
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
  context.restore();
  strokeMonthWedge(context, geometry, selection, color);

  // Marks inherit their host segment's hover state. This keeps the visual
  // hierarchy coherent without giving knots an independent pointer behavior.
  const selectedMonth = selection.month + 1;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 1;
  geometry.events.knots
    .filter((knot) => knot.anchor.year === selection.year && Number(knot.anchor.date.slice(5, 7)) === selectedMonth)
    .forEach((knot) => {
      context.save();
      tracePointPath(context, knot.path, true);
      context.clip();
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
  context.font = `400 ${labelFontSize}px "Cutive Mono", monospace`;
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
