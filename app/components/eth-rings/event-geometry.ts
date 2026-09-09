import type { EventSelection, Milestone } from "./model";

export const TAU = Math.PI * 2;
const DAY_MS = 86_400_000;

export type Point = Readonly<{ x: number; y: number }>;

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

export type CanonicalEvent = Readonly<{ kind: "milestone"; record: Milestone }>;

export type EventAnchor = Readonly<{
  eventId: string;
  kind: "milestone";
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

export type EventHitRegion = Readonly<{
  eventId: string;
  kind: "milestone";
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
    left.date.localeCompare(right.date) || left.eventId.localeCompare(right.eventId));
  void metrics.pointer;
  const placed: EventAnchor[] = [];
  for (const anchor of sorted) {
    const step = clamp(4 / Math.max(anchor.ringRadius, 1), Math.PI / 180, Math.PI / 90);
    const offsets = [0, 1, -1, 2, -2, 3, -3].map((value) => value * step);
    const candidates = offsets
      .filter((offset) => Math.abs(offset) <= Math.PI / 30 + 1e-9)
      .map((offset) => anchorWithDisplayAngle(anchor, anchor.trueAngle + offset));
    const sameYear = placed.filter((candidate) => candidate.year === anchor.year);
    // Two knots need their visual radii plus a small margin between centres.
    const clearance = 2 * (14 + metrics.selectionHaloPx) + 3;
    const overlapWith = (candidate: EventAnchor) => sameYear.reduce((total, other) => {
      const distance = Math.hypot(candidate.point.x - other.point.x, candidate.point.y - other.point.y);
      return total + Math.max(0, clearance - distance);
    }, 0);
    const clears = (candidate: EventAnchor) => overlapWith(candidate) === 0;
    placed.push(candidates.find(clears) ?? candidates.reduce((best, candidate) =>
      overlapWith(candidate) < overlapWith(best) ? candidate : best, candidates[0]));
  }
  return placed;
}

/**
 * The eight control points a knot is grown from: an ellipse laid along the ring
 * it interrupts, with each point pushed in or out by its own share of the seed
 * so no two knots on the plate are the same shape.
 *
 * The key draws its knot from here too, rather than describing one, so the mark
 * beside "protocol milestones" is built the way the marks on the plate are.
 */
export function knotOutline(
  seed: string,
  center: Point,
  majorRadius: number,
  minorRadius: number,
  rotation: number,
): Point[] {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = index / 8 * TAU;
    const irregularity = 1 + hashSigned(`${seed}:${index}`) * 0.1;
    const localX = Math.cos(angle) * majorRadius * irregularity;
    const localY = Math.sin(angle) * minorRadius / irregularity;
    return {
      x: center.x + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      y: center.y + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    };
  });
}

export function buildKnotGeometry(
  event: Milestone,
  anchor: EventAnchor,
  localGap: number,
): KnotGeometry {
  const majorRadius = clamp(localGap * 0.42, 7, 12);
  const minorRadius = clamp(localGap * 0.25, 4.5, 7.5);
  const rotation = anchor.displayAngle + Math.PI / 2 + hashSigned(event.id) * 0.2;
  const offset = hashSigned(`${event.id}:offset`) * Math.min(localGap * 0.055, 1.25);
  const center = pointAt(
    anchor.center,
    anchor.ringRadius + offset,
    anchor.displayAngle,
  );
  const path = knotOutline(event.id, center, majorRadius, minorRadius, rotation);
  return { eventId: event.id, kind: "milestone", anchor, path, center, majorRadius, minorRadius };
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
  pointer: "fine" | "coarse",
) {
  const radiusCssPx = pointer === "coarse" ? 22 : 14;
  return knots.map((knot): EventHitRegion => ({
    eventId: knot.eventId,
    kind: knot.kind,
    date: knot.anchor.date,
    centerline: [knot.anchor.truePoint, knot.center],
    polygon: knot.path,
    anchor: knot.anchor.truePoint,
    radiusCssPx,
    bounds: boundsOf(knot.path, radiusCssPx),
  }));
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
