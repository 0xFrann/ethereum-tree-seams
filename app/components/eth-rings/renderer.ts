import {
  buildEventAnchors,
  buildEventHitRegions,
  buildKnotGeometry,
  buildScarGeometry,
  hitTestEvents,
  resolveEventCollisions,
  type EventHitRegion,
  type KnotGeometry,
  type ScarGeometry,
  type YearBandGeometry,
} from "./event-geometry";
import { MONTHS, type EventSelection, type MarketData, type Selection } from "./model";

const SAMPLE_COUNT = 360;
const TAU = Math.PI * 2;
const EMPTY_YEAR_GHOST_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
const INTERSTITIAL_GHOST_FRACTIONS = [0.17, 0.34, 0.52, 0.7, 0.84] as const;
const GHOST_ALPHA = 0.5;
const EMPTY_GHOST_ALPHA_MIN = 0.2;
const EMPTY_GHOST_ALPHA_MAX = 0.48;

type RingGeometry = {
  year: number;
  radii: number[];
  widths: number[];
  startSample: number;
  activeSamples: number;
};

export type EventGeometry = {
  knots: KnotGeometry[];
  scars: ScarGeometry[];
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
  context.globalAlpha = 0.3;
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

export function buildGeometry(data: MarketData, size: number): Geometry {
  const center = size / 2;
  const inner = size * 0.0975;
  const outer = size * 0.39;
  const gap = (outer - inner) / Math.max(1, data.years.length - 1);
  let baseline = Array(SAMPLE_COUNT).fill(inner);

  const rings = data.years.map((year): RingGeometry => {
    const incomingBaseline = baseline;
    const startSample = Math.max(0, Math.min(SAMPLE_COUNT - 1, Math.floor(year.startProgress * SAMPLE_COUNT)));
    const activeSamples = Math.max(2, Math.min(SAMPLE_COUNT, Math.round(year.progress * SAMPLE_COUNT)));
    const cyclic = startSample === 0 && activeSamples === SAMPLE_COUNT;
    const radii = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
      if (index < startSample) return baseline[index];
      const observedSamples = Math.max(2, activeSamples - startSample);
      const position = cyclic
        ? (index / SAMPLE_COUNT) * year.priceShape.length
        : (Math.min(index, activeSamples - 1) - startSample) / Math.max(1, observedSamples - 1) * (year.priceShape.length - 1);
      const shape = interpolate(year.priceShape, position, cyclic);
      return Math.max(baseline[index] + shape * gap * 0.39, baseline[index] - gap * 0.6);
    });
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
    const rest = Math.max(0.9, gap * 0.032);
    const widths = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
      const monthPosition = (index / SAMPLE_COUNT) * 12;
      const month = Math.min(year.months.length - 1, Math.floor(monthPosition) % 12);
      const pulse = Math.sin(Math.PI * (monthPosition - Math.floor(monthPosition))) ** 1.35;
      const monthRecord = year.months.find((record) => record.month === Math.floor(monthPosition) % 12)
        ?? year.months[month];
      const peak = rest + monthRecord.volumeWeight * gap * 0.16;
      return rest + (peak - rest) * pulse;
    });
    if (startSample > 0) {
      // A partial first market year cannot define the contour for the months
      // that precede the data source. Carry its average observed growth into a
      // continuous baseline so the missing interval does not become a radial
      // seam in every subsequent ring.
      const observedGrowth = radii
        .slice(startSample, activeSamples)
        .reduce((total, radius, index) => total + radius - incomingBaseline[startSample + index], 0)
        / Math.max(1, activeSamples - startSample);
      baseline = incomingBaseline.map((radius) => radius + observedGrowth + gap * 0.9);
    } else {
      baseline = radii.map((radius) => radius + gap * 0.9);
    }
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
  const preMarketBands: YearBandGeometry[] = Array.from(
    { length: Math.max(0, firstMarketYear - originYear) },
    (_, index) => {
      const year = originYear + index;
      const radius = inner - gap * (firstMarketYear - year);
      const radii = Array(SAMPLE_COUNT).fill(radius);
      return {
        year,
        radii,
        widths: Array(SAMPLE_COUNT).fill(0.72),
        startFraction: year === originYear ? 210.5 / 365 : 0,
        activeFraction: 1,
        innerBoundary: radii.map((value) => value - gap * 0.5),
        outerBoundary: radii.map((value) => value + gap * 0.5),
        marketYearIndex: null,
      };
    },
  );
  const yearBands = [...preMarketBands, ...marketBands];

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
    ...data.scars.map((record) => ({ kind: "scar" as const, record })),
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
  const scars = anchors.flatMap((anchor) => {
    if (anchor.kind !== "scar") return [];
    const event = data.scars.find((candidate) => candidate.id === anchor.eventId);
    return event ? [buildScarGeometry(event, anchor, { localGap: gap, barkRadii: bark })] : [];
  });
  const events: EventGeometry = {
    knots,
    scars,
    fineHitRegions: buildEventHitRegions(knots, scars, "fine"),
    coarseHitRegions: buildEventHitRegions(knots, scars, "coarse"),
  };

  return { center, size, gap, inner, indexRadius, bark, rings, yearBands, events };
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

function transparentVersion(color: string) {
  const hex = color.trim().match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!hex) return "rgba(238, 233, 217, 0)";
  return `rgba(${Number.parseInt(hex[1], 16)}, ${Number.parseInt(hex[2], 16)}, ${Number.parseInt(hex[3], 16)}, 0)`;
}

function drawMonthWedge(
  context: CanvasRenderingContext2D,
  inner: number[],
  selected: number[],
  outer: number[],
  month: number,
  center: number,
  paperColor: string,
) {
  const start = month * 30;
  const end = start + 30;
  context.save();
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

  const averageRadius = (radii: number[]) => {
    let total = 0;
    for (let sample = start; sample <= end; sample += 1) {
      total += radii[sample % SAMPLE_COUNT];
    }
    return total / (end - start + 1);
  };
  const innerRadius = averageRadius(inner);
  const selectedRadius = averageRadius(selected);
  const outerRadius = averageRadius(outer);
  const selectedStop = Math.max(
    0.05,
    Math.min(0.95, (selectedRadius - innerRadius) / Math.max(1, outerRadius - innerRadius)),
  );
  const gradient = context.createRadialGradient(center, center, innerRadius, center, center, outerRadius);
  const transparentPaperColor = transparentVersion(paperColor);
  gradient.addColorStop(0, transparentPaperColor);
  gradient.addColorStop(selectedStop, paperColor);
  gradient.addColorStop(1, transparentPaperColor);

  context.fillStyle = gradient;
  context.globalAlpha = 0.62;
  context.fill();
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

function drawScar(
  context: CanvasRenderingContext2D,
  scar: ScarGeometry,
  color: string,
) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.58;
  tracePointPath(context, scar.polygon, true);
  context.fill();
  context.restore();
}

function drawKnot(
  context: CanvasRenderingContext2D,
  knot: KnotGeometry,
  color: string,
) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 0.58;
  tracePointPath(context, knot.path, true);
  context.fill();
  context.restore();
}

export function drawStaticArtwork(
  context: CanvasRenderingContext2D,
  data: MarketData,
  geometry: Geometry,
  colors: { ink: string; grain: string; muted: string; bark: string },
) {
  const { center, rings, gap, inner, size, bark, indexRadius } = geometry;
  context.clearRect(0, 0, size, size);
  drawBark(context, rings.at(-1)!.radii, bark, center, colors.bark);

  const emptyYearBands = geometry.yearBands.filter((band) => band.marketYearIndex === null);
  const emptyGhostInnerRadius = emptyYearBands[0]?.innerBoundary[0] ?? inner;
  const emptyGhostAlphaAt = (radius: number) => {
    const progress = Math.max(0, Math.min(1, (radius - emptyGhostInnerRadius) / Math.max(1, inner - emptyGhostInnerRadius)));
    return EMPTY_GHOST_ALPHA_MIN + (EMPTY_GHOST_ALPHA_MAX - EMPTY_GHOST_ALPHA_MIN) * progress;
  };
  emptyYearBands.forEach((band) => {
    EMPTY_YEAR_GHOST_FRACTIONS.forEach((fraction) => {
      const radii = band.innerBoundary.map((innerRadius, sample) =>
        innerRadius + (band.outerBoundary[sample] - innerRadius) * fraction);
      strokeGhostContour(
        context,
        radii,
        center,
        colors.grain,
        0,
        SAMPLE_COUNT,
        true,
        emptyGhostAlphaAt(radii[0]),
      );
    });
  });

  const lastEmptyBand = emptyYearBands.at(-1);
  if (lastEmptyBand) {
    const outermostEmptyRadius =
      lastEmptyBand.innerBoundary[0]
      + (lastEmptyBand.outerBoundary[0] - lastEmptyBand.innerBoundary[0]) * 0.9;
    const emptyRingSpacing = gap * 0.2;
    for (
      let radius = outermostEmptyRadius + emptyRingSpacing;
      radius < inner - emptyRingSpacing * 0.5;
      radius += emptyRingSpacing
    ) {
      strokeGhostContour(
        context,
        Array(SAMPLE_COUNT).fill(radius),
        center,
        colors.grain,
        0,
        SAMPLE_COUNT,
        true,
        emptyGhostAlphaAt(radius),
      );
    }
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

  geometry.events.scars.forEach((scar) => drawScar(context, scar, colors.muted));
  geometry.events.knots.forEach((knot) => drawKnot(context, knot, colors.muted));
  [...geometry.events.scars.map((scar) => scar.anchor), ...geometry.events.knots.map((knot) => knot.anchor)]
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

  const labelFontSize = Math.max(9, size * 0.018);
  const labelClearance = Math.max(5, size * 0.012);
  context.fillStyle = colors.muted;
  context.font = `500 ${labelFontSize}px ui-monospace, monospace`;
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
  paperColor: string,
) {
  const ring = geometry.rings[selection.yearIndex];
  if (!ring) return;
  const monthStart = selection.month * 30;
  if (monthStart + 30 <= ring.startSample || monthStart >= ring.activeSamples) return;
  const actualEnd = ring.activeSamples === SAMPLE_COUNT ? SAMPLE_COUNT : ring.activeSamples - 1;
  const start = Math.max(monthStart, ring.startSample);
  const end = Math.min(monthStart + 30, actualEnd);

  drawMonthWedge(
    context,
    geometry.rings[0].radii,
    ring.radii,
    geometry.bark,
    selection.month,
    geometry.center,
    paperColor,
  );

  if (end - start < 2) return;
  fillVariableContour(context, ring, geometry.center, color, start, end, 1, 0.35);

  const labelFontSize = Math.max(9, geometry.size * 0.018);
  const labelClearance = Math.max(5, geometry.size * 0.012);
  const angle = -Math.PI / 2 + (selection.month / 12) * TAU;
  const label = MONTHS[selection.month].toUpperCase();
  context.save();
  context.fillStyle = color;
  context.font = `500 ${labelFontSize}px ui-monospace, monospace`;
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
  const scar = selection.kind === "scar"
    ? geometry.events.scars.find((candidate) => candidate.eventId === selection.id)
    : undefined;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = 1;
  if (knot) {
    tracePointPath(context, knot.path, true);
    context.fill();
  } else if (scar) {
    tracePointPath(context, scar.polygon, true);
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
  const event = hitTestEvent(geometry, x, y, pointer);
  return event ? { event, market: null } : { event: null, market: hitTest(geometry, x, y) };
}

export function hitTest(geometry: Geometry, x: number, y: number): Selection | null {
  const dx = x - geometry.center;
  const dy = y - geometry.center;
  const radius = Math.hypot(dx, dy);
  if (radius < geometry.inner - geometry.gap || radius > geometry.indexRadius) return null;

  const angle = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU;
  const month = Math.min(11, Math.floor((angle / TAU) * 12));
  const sample = Math.floor((angle / TAU) * SAMPLE_COUNT) % SAMPLE_COUNT;
  let yearIndex = -1;
  let distance = Number.POSITIVE_INFINITY;
  geometry.rings.forEach((ring, index) => {
    if (sample < ring.startSample || sample >= ring.activeSamples) return;
    const nextDistance = Math.abs(radius - ring.radii[sample]);
    if (nextDistance < distance) {
      distance = nextDistance;
      yearIndex = index;
    }
  });
  return yearIndex === -1 ? null : { yearIndex, month };
}
