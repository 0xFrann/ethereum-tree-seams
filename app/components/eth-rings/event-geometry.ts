import type { EventSelection, Milestone, Scar } from "./model";

export const EVENT_SAMPLE_COUNT = 360;
export const TAU = Math.PI * 2;
const DAY_MS = 86_400_000;
const FLOOR_USD = 1_000_000;
const CAP_USD = 1_500_000_000;

export type Point = Readonly<{ x: number; y: number }>;
export type PolarPoint = Readonly<{ radius: number; angle: number }>;

export type YearBandGeometry = Readonly<{
  year: number;
  radii: readonly number[];
  widths: readonly number[];
  startFraction: number;
  activeFraction: number;
  innerBoundary: readonly number[];
  outerBoundary: readonly number[];
  marketYearIndex: number | null;
}>;

export type CanonicalEvent =
  | Readonly<{ kind: "milestone"; record: Milestone }>
  | Readonly<{ kind: "scar"; record: Scar }>;

export type EventAnchor = Readonly<{
  eventId: string;
  kind: "milestone" | "scar";
  date: string;
  year: number;
  trueFraction: number;
  trueAngle: number;
  displayAngle: number;
  ringRadius: number;
  point: Point;
  truePoint: Point;
  center: number;
  leader: readonly Point[] | null;
}>;

export type KnotGeometry = Readonly<{
  eventId: string;
  kind: "milestone";
  anchor: EventAnchor;
  path: readonly Point[];
  center: Point;
  majorRadius: number;
  minorRadius: number;
}>;

export type ScarGeometry = Readonly<{
  eventId: string;
  kind: "scar";
  anchor: EventAnchor;
  healingState: Scar["healingState"];
  score: number;
  polygon: readonly Point[];
  centerline: readonly Point[];
  bridges: readonly (readonly Point[])[];
  maxHalfWidth: number;
  endRadius: number;
}>;

export type EventHitRegion = Readonly<{
  eventId: string;
  kind: "milestone" | "scar";
  date: string;
  centerline: readonly Point[];
  polygon: readonly Point[];
  anchor: Point;
  radiusCssPx: number;
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

export function parseIsoDateUtc(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid ISO date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  const timestamp = Date.UTC(year, month - 1, day);
  const value = new Date(timestamp);
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  const start = Date.UTC(year, 0, 1);
  const daysInYear = ((Date.UTC(year + 1, 0, 1) - start) / DAY_MS) as 365 | 366;
  const dayIndex = (timestamp - start) / DAY_MS;
  return { year, dayIndex, daysInYear, fraction: (dayIndex + 0.5) / daysInYear };
}

export function dateToAngle(date: string) {
  return -Math.PI / 2 + parseIsoDateUtc(date).fraction * TAU;
}

export function interpolateRingAtFraction(radii: readonly number[], fraction: number) {
  if (radii.length === 0 || !Number.isFinite(fraction)) {
    throw new Error("Ring interpolation requires radii and a finite fraction.");
  }
  const wrapped = ((fraction % 1) + 1) % 1;
  const position = wrapped * radii.length;
  const index = Math.floor(position) % radii.length;
  const next = (index + 1) % radii.length;
  return radii[index] + (radii[next] - radii[index]) * (position - Math.floor(position));
}

export function smoothCircularSeries(values: readonly number[], radius = 5) {
  if (values.length < 3 || radius < 1) return [...values];
  const window = Math.min(radius, Math.floor((values.length - 1) / 2));
  return values.map((_, index) => {
    let weighted = 0;
    let total = 0;
    for (let offset = -window; offset <= window; offset += 1) {
      const weight = window + 1 - Math.abs(offset);
      weighted += values[(index + offset + values.length) % values.length] * weight;
      total += weight;
    }
    return weighted / total;
  });
}

export function normalizeScarMagnitude(grossUsdAtIncident: number) {
  if (!Number.isFinite(grossUsdAtIncident) || grossUsdAtIncident < 0) {
    throw new Error("Scar magnitude must be a finite non-negative number.");
  }
  const clamped = Math.min(Math.max(grossUsdAtIncident, FLOOR_USD), CAP_USD);
  return Math.round(
    100 * Math.log10(clamped / FLOOR_USD) / Math.log10(CAP_USD / FLOOR_USD),
  );
}

export function pointAt(center: number, radius: number, angle: number): Point {
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashSigned(value: string) {
  return (stableHash(value) / 0xffffffff) * 2 - 1;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function shortestAngle(left: number, right: number) {
  return ((left - right + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

function anchorWithDisplayAngle(anchor: EventAnchor, displayAngle: number): EventAnchor {
  const point = pointAt(anchor.center, anchor.ringRadius, displayAngle);
  const displaced = Math.abs(shortestAngle(displayAngle, anchor.trueAngle)) > 1e-9;
  return {
    ...anchor,
    displayAngle,
    point,
    leader: displaced ? [anchor.truePoint, point] : null,
  };
}

export function buildEventAnchors(
  events: readonly CanonicalEvent[],
  yearBands: readonly YearBandGeometry[],
  options: Readonly<{ center: number; size: number; gap: number; lastDate: string }>,
) {
  return events.flatMap((event): EventAnchor[] => {
    const date = event.record.date;
    if (date > options.lastDate) return [];
    const parsed = parseIsoDateUtc(date);
    const band = yearBands.find((candidate) => candidate.year === parsed.year);
    if (!band || parsed.fraction < band.startFraction || parsed.fraction > band.activeFraction) return [];
    const ringRadius = interpolateRingAtFraction(band.radii, parsed.fraction);
    const trueAngle = -Math.PI / 2 + parsed.fraction * TAU;
    const truePoint = pointAt(options.center, ringRadius, trueAngle);
    return [{
      eventId: event.record.id,
      kind: event.kind,
      date,
      year: parsed.year,
      trueFraction: parsed.fraction,
      trueAngle,
      displayAngle: trueAngle,
      ringRadius,
      point: truePoint,
      truePoint,
      center: options.center,
      leader: null,
    }];
  });
}

export function resolveEventCollisions(
  anchors: readonly EventAnchor[],
  metrics: Readonly<{ pointer: "fine" | "coarse"; selectionHaloPx: number }>,
) {
  const sorted = [...anchors].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    (left.kind === right.kind ? 0 : left.kind === "scar" ? -1 : 1) ||
    left.eventId.localeCompare(right.eventId));
  void metrics.pointer;
  const placed: EventAnchor[] = [];
  for (const anchor of sorted) {
    const step = clamp(4 / Math.max(anchor.ringRadius, 1), Math.PI / 180, Math.PI / 90);
    const offsets = [0, 1, -1, 2, -2, 3, -3].map((value) => value * step);
    const candidates = offsets
      .filter((offset) => Math.abs(offset) <= Math.PI / 30 + 1e-9)
      .map((offset) => anchorWithDisplayAngle(anchor, anchor.trueAngle + offset));
    const sameYear = placed.filter((candidate) => candidate.year === anchor.year);
    const visualRadius = (candidate: EventAnchor) =>
      candidate.kind === "milestone" ? 10 + metrics.selectionHaloPx : 11 + metrics.selectionHaloPx;
    const clears = (candidate: EventAnchor) => sameYear.every((other) => {
      const distance = Math.hypot(candidate.point.x - other.point.x, candidate.point.y - other.point.y);
      return distance >= visualRadius(candidate) + visualRadius(other) + 3;
    });
    placed.push(candidates.find(clears) ?? candidates.reduce((best, candidate) => {
      const overlap = sameYear.reduce((total, other) => {
        const distance = Math.hypot(candidate.point.x - other.point.x, candidate.point.y - other.point.y);
        return total + Math.max(0, visualRadius(candidate) + visualRadius(other) + 3 - distance);
      }, 0);
      const bestOverlap = sameYear.reduce((total, other) => {
        const distance = Math.hypot(best.point.x - other.point.x, best.point.y - other.point.y);
        return total + Math.max(0, visualRadius(best) + visualRadius(other) + 3 - distance);
      }, 0);
      return overlap < bestOverlap ? candidate : best;
    }, candidates[0]));
  }
  return placed;
}

export function buildKnotGeometry(
  event: Milestone,
  anchor: EventAnchor,
  localGap: number,
): KnotGeometry {
  const majorRadius = clamp(localGap * 0.29, 5, 9);
  const minorRadius = clamp(localGap * 0.17, 3, 5.5);
  const rotation = anchor.displayAngle + Math.PI / 2 + hashSigned(event.id) * 0.2;
  const offset = hashSigned(`${event.id}:offset`) * Math.min(localGap * 0.055, 1.25);
  const center = pointAt(
    anchor.center,
    anchor.ringRadius + offset,
    anchor.displayAngle,
  );
  const path = Array.from({ length: 8 }, (_, index) => {
    const angle = index / 8 * TAU;
    const irregularity = 1 + hashSigned(`${event.id}:${index}`) * 0.1;
    const localX = Math.cos(angle) * majorRadius * irregularity;
    const localY = Math.sin(angle) * minorRadius / irregularity;
    return {
      x: center.x + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      y: center.y + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    };
  });
  return { eventId: event.id, kind: "milestone", anchor, path, center, majorRadius, minorRadius };
}

function scarWidth(state: Scar["healingState"], t: number, maximum: number) {
  if (state === "healed") return maximum * Math.sin(Math.PI * t) ** 0.72;
  if (state === "closed") {
    return maximum * Math.sin(Math.PI * t) ** 0.58 * (0.92 - 0.16 * t);
  }
  if (t < 0.68) return maximum * Math.sin(Math.PI * t / 1.36) ** 0.72;
  const previous = maximum;
  return previous + (maximum * 0.52 - previous) * ((t - 0.68) / 0.32);
}

export function buildScarGeometry(
  event: Scar,
  anchor: EventAnchor,
  context: Readonly<{ localGap: number; barkRadii: readonly number[] }>,
): ScarGeometry {
  const score = clamp(event.visualMagnitude, 0, 100);
  const scaled = score / 100;
  const gap = context.localGap;
  const maxHalfWidth = clamp(gap * (0.07 + 0.17 * scaled), 1.5, 4.5);
  const potential = anchor.ringRadius + gap * (0.45 + 1.45 * scaled);
  const barkRadius = interpolateRingAtFraction(
    context.barkRadii,
    ((anchor.displayAngle + Math.PI / 2) / TAU + 1) % 1,
  );
  const beforeBark = barkRadius - Math.max(0.22 * gap, 3);
  let endRadius = potential;
  if (event.healingState === "healed") endRadius = Math.min(potential, beforeBark);
  else if (event.healingState === "closed") {
    endRadius = Math.min(anchor.ringRadius + 1.18 * (potential - anchor.ringRadius), beforeBark);
  } else endRadius = barkRadius + Math.min(0.1 * gap, 2);
  endRadius = Math.max(anchor.ringRadius + Math.min(3, Math.max(0.5, barkRadius - anchor.ringRadius)), endRadius);

  const count = clamp(Math.ceil((endRadius - anchor.ringRadius) / 3), 12, 32);
  const left: Point[] = [];
  const right: Point[] = [];
  const centerline: Point[] = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    const radius = anchor.ringRadius + (endRadius - anchor.ringRadius) * t;
    const width = scarWidth(event.healingState, t, maxHalfWidth);
    const jitter = index === 0 ? 0 : hashSigned(`${event.id}:edge:${index}`) * maxHalfWidth * 0.1;
    const leftWidth = Math.max(0, width + jitter);
    const rightWidth = Math.max(0, width - jitter * 0.7);
    centerline.push(pointAt(anchor.center, radius, anchor.displayAngle));
    left.push(pointAt(anchor.center, radius, anchor.displayAngle - leftWidth / Math.max(radius, 1)));
    right.push(pointAt(anchor.center, radius, anchor.displayAngle + rightWidth / Math.max(radius, 1)));
  }
  const bridges: Point[][] = [];
  if (event.healingState !== "open") {
    const start = event.healingState === "healed" ? 0.65 : 0.82;
    const bridgeCount = event.healingState === "healed" ? 3 : 1;
    for (let index = 0; index < bridgeCount; index += 1) {
      const t = start + (1 - start) * ((index + 1) / (bridgeCount + 1));
      const item = Math.round(t * count);
      bridges.push([left[item], right[item]]);
    }
  }
  return {
    eventId: event.id,
    kind: "scar",
    anchor,
    healingState: event.healingState,
    score,
    polygon: [...left, ...right.reverse()],
    centerline,
    bridges,
    maxHalfWidth,
    endRadius,
  };
}

export function deformGrainPoint(
  point: PolarPoint,
  scars: readonly ScarGeometry[],
  knots: readonly KnotGeometry[],
): PolarPoint {
  let radius = point.radius;
  let angularPush = 0;
  for (const knot of knots) {
    const delta = shortestAngle(point.angle, knot.anchor.displayAngle);
    const aperture = clamp(10 / Math.max(knot.anchor.ringRadius, 1), 0.025, 0.065);
    if (Math.abs(delta) < aperture && Math.abs(radius - knot.anchor.ringRadius) < knot.majorRadius * 2) {
      const q = Math.abs(delta) / aperture;
      radius += knot.majorRadius * 0.25 * (1 - q * q) ** 2 * (1 + 0.22 * delta / aperture);
    }
  }
  for (const scar of scars) {
    if (radius < scar.anchor.ringRadius || radius > scar.endRadius) continue;
    const t = (radius - scar.anchor.ringRadius) / Math.max(1e-9, scar.endRadius - scar.anchor.ringRadius);
    const width = scarWidth(scar.healingState, t, scar.maxHalfWidth);
    const halfAngle = (width + 2) / Math.max(radius, 1);
    const delta = shortestAngle(point.angle, scar.anchor.displayAngle);
    if (Math.abs(delta) >= 1.55 * halfAngle) continue;
    const direction = delta === 0 ? (hashSigned(scar.eventId) < 0 ? -1 : 1) : Math.sign(delta);
    const smoothT = clamp(t / 0.22, 0, 1);
    const smoothing = smoothT * smoothT * (3 - 2 * smoothT);
    angularPush += direction * (1.55 * halfAngle - Math.abs(delta)) * smoothing;
  }
  const cap = Math.min(0.035, 0.55 * Math.max(1, knots[0]?.majorRadius ?? 8) / Math.max(radius, 1));
  return { radius, angle: point.angle + clamp(angularPush, -cap, cap) };
}

function boundsOf(points: readonly Point[], padding: number) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs) - padding;
  const top = Math.min(...ys) - padding;
  const right = Math.max(...xs) + padding;
  const bottom = Math.max(...ys) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function buildEventHitRegions(
  knots: readonly KnotGeometry[],
  scars: readonly ScarGeometry[],
  pointer: "fine" | "coarse",
) {
  const radiusCssPx = pointer === "coarse" ? 22 : 14;
  const knotRegions = knots.map((knot): EventHitRegion => ({
    eventId: knot.eventId,
    kind: knot.kind,
    date: knot.anchor.date,
    centerline: [knot.anchor.truePoint, knot.center],
    polygon: knot.path,
    anchor: knot.anchor.truePoint,
    radiusCssPx,
    bounds: boundsOf(knot.path, radiusCssPx),
  }));
  const scarRegions = scars.map((scar): EventHitRegion => ({
    eventId: scar.eventId,
    kind: scar.kind,
    date: scar.anchor.date,
    centerline: [scar.anchor.truePoint, ...scar.centerline],
    polygon: scar.polygon,
    anchor: scar.anchor.truePoint,
    radiusCssPx,
    bounds: boundsOf(scar.polygon, radiusCssPx),
  }));
  return [...knotRegions, ...scarRegions];
}

function pointInPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.y > point.y) !== (b.y > point.y)) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function pathDistance(point: Point, path: readonly Point[]) {
  if (path.length === 1) return Math.hypot(point.x - path[0].x, point.y - path[0].y);
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    distance = Math.min(distance, segmentDistance(point, path[index - 1], path[index]));
  }
  return distance;
}

export function hitTestEvents(regions: readonly EventHitRegion[], point: Point): EventSelection {
  const hits = regions.flatMap((region) => {
    if (point.x < region.bounds.x || point.y < region.bounds.y ||
      point.x > region.bounds.x + region.bounds.width ||
      point.y > region.bounds.y + region.bounds.height) return [];
    const inside = pointInPolygon(point, region.polygon);
    const distance = pathDistance(point, region.centerline);
    if (!inside && distance > region.radiusCssPx) return [];
    return [{
      region,
      inside,
      distance: inside ? 0 : distance / region.radiusCssPx,
      anchorDistance: Math.hypot(point.x - region.anchor.x, point.y - region.anchor.y),
    }];
  });
  hits.sort((left, right) =>
    Number(right.inside) - Number(left.inside) ||
    left.distance - right.distance ||
    left.anchorDistance - right.anchorDistance ||
    left.region.date.localeCompare(right.region.date) ||
    left.region.eventId.localeCompare(right.region.eventId));
  const match = hits[0]?.region;
  if (!match) return null;
  return { kind: match.kind, id: match.eventId };
}

export function nextEventId(
  events: readonly CanonicalEvent[],
  currentId: string | null,
  direction: -1 | 1 | "first" | "last",
) {
  const sorted = [...events].sort((left, right) =>
    left.record.date.localeCompare(right.record.date) || left.record.id.localeCompare(right.record.id));
  if (sorted.length === 0) return null;
  if (direction === "first") return sorted[0].record.id;
  if (direction === "last") return sorted.at(-1)!.record.id;
  const current = sorted.findIndex((event) => event.record.id === currentId);
  const next = clamp((current === -1 ? (direction === 1 ? -1 : sorted.length) : current) + direction, 0, sorted.length - 1);
  return sorted[next]?.record.id ?? null;
}
