import { MONTHS, type MarketData, type Selection } from "./model";

const SAMPLE_COUNT = 360;
const TAU = Math.PI * 2;

type RingGeometry = { radii: number[]; widths: number[] };

export type Geometry = {
  center: number;
  size: number;
  gap: number;
  inner: number;
  rings: RingGeometry[];
};

function interpolate(values: number[], position: number) {
  const count = values.length;
  const index = Math.floor(position);
  const t = position - index;
  const at = (offset: number) => values[(index + offset + count) % count];
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

function polar(center: number, radius: number, sample: number, total = SAMPLE_COUNT) {
  const angle = -Math.PI / 2 + (sample / total) * TAU;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function traceRing(context: CanvasRenderingContext2D, radii: number[], center: number) {
  context.beginPath();
  radii.forEach((radius, index) => {
    const point = polar(center, radius, index, radii.length);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
}

export function buildGeometry(data: MarketData, size: number): Geometry {
  const center = size / 2;
  const inner = size * 0.115;
  const outer = size * 0.39;
  const gap = (outer - inner) / (data.years.length - 1);
  let previous = Array(SAMPLE_COUNT).fill(inner - gap);

  const rings = data.years.map((year, yearIndex) => {
    const base = inner + yearIndex * gap;
    const radii = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
      const shape = interpolate(year.priceShape, (index / SAMPLE_COUNT) * year.priceShape.length);
      return Math.max(base + shape * gap * 0.26, previous[index] + gap * 0.36);
    });
    const widths = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
      const monthPosition = (index / SAMPLE_COUNT) * 12;
      const month = Math.floor(monthPosition) % 12;
      const pulse = Math.sin(Math.PI * (monthPosition - Math.floor(monthPosition))) ** 1.35;
      return 0.72 + year.months[month].volumeWeight * gap * 0.13 * pulse;
    });
    previous = radii;
    return { radii, widths };
  });

  return { center, size, gap, inner, rings };
}

function drawVariableRing(
  context: CanvasRenderingContext2D,
  ring: RingGeometry,
  center: number,
  color: string,
  alpha = 1,
) {
  context.save();
  context.strokeStyle = color;
  context.lineCap = "round";
  context.globalAlpha = alpha;
  for (let index = 1; index <= ring.radii.length; index += 1) {
    const current = index % ring.radii.length;
    const previous = index - 1;
    const start = polar(center, ring.radii[previous], previous, ring.radii.length);
    const end = polar(center, ring.radii[current], index, ring.radii.length);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.lineWidth = ring.widths[current];
    context.stroke();
  }
  context.restore();
}

export function drawStaticArtwork(
  context: CanvasRenderingContext2D,
  data: MarketData,
  geometry: Geometry,
  colors: { ink: string; grain: string; muted: string },
) {
  const { center, rings, gap, size } = geometry;
  context.clearRect(0, 0, size, size);

  for (let index = 0; index < rings.length - 1; index += 1) {
    [0.2, 0.4, 0.6, 0.8].forEach((fraction, grainIndex) => {
      const radii = rings[index].radii.map((radius, pointIndex) => {
        const next = rings[index + 1].radii[pointIndex];
        const angle = (pointIndex / SAMPLE_COUNT) * TAU;
        const noise = (
          Math.sin(angle * 13 + index + grainIndex) + Math.sin(angle * 27 - grainIndex) * 0.4
        ) * gap * 0.008;
        return radius + (next - radius) * fraction + noise;
      });
      context.strokeStyle = colors.grain;
      context.lineWidth = 0.55;
      context.globalAlpha = 0.64;
      traceRing(context, radii, center);
      context.stroke();
    });
  }
  context.globalAlpha = 1;
  rings.forEach((ring) => drawVariableRing(context, ring, center, colors.ink, 0.76));

  const outerRing = rings.at(-1)!;
  const bark = outerRing.radii.map((radius, index) => {
    const angle = (index / outerRing.radii.length) * TAU;
    return radius + gap * (0.42 + Math.sin(angle * 5.2) * 0.05 + Math.sin(angle * 23.4) * 0.035);
  });
  context.strokeStyle = colors.muted;
  context.lineWidth = 1;
  context.globalAlpha = 0.4;
  traceRing(context, bark, center);
  context.stroke();
  context.globalAlpha = 1;

  data.events.forEach((event) => {
    const yearIndex = data.years.findIndex((year) => year.year === event.year);
    if (yearIndex === -1) return;
    const sample = Math.round(((event.month + 0.5) / 12) * SAMPLE_COUNT) % SAMPLE_COUNT;
    const radius = rings[yearIndex].radii[sample] - gap * 0.16;
    const point = polar(center, radius, sample);
    context.save();
    context.translate(point.x, point.y);
    context.rotate((sample / SAMPLE_COUNT) * TAU);
    context.fillStyle = colors.muted;
    context.globalAlpha = 0.86;
    context.beginPath();
    context.ellipse(0, 0, Math.max(3.5, gap * 0.13), Math.max(2.2, gap * 0.075), 0, 0, TAU);
    context.fill();
    context.restore();
  });

  context.fillStyle = colors.muted;
  context.font = `500 ${Math.max(9, size * 0.018)}px ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  MONTHS.forEach((month, index) => {
    const angle = -Math.PI / 2 + (index / 12) * TAU;
    const radius = size * 0.45;
    context.fillText(month.toUpperCase(), center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
  });
}

export function drawSelection(
  context: CanvasRenderingContext2D,
  data: MarketData,
  geometry: Geometry,
  selection: Selection,
  color: string,
) {
  const ring = geometry.rings[selection.yearIndex];
  const start = selection.month * 30;
  const end = start + 30;
  context.save();
  context.strokeStyle = color;
  context.lineCap = "round";
  context.shadowColor = color;
  context.shadowBlur = 8;
  for (let index = start + 1; index <= end; index += 1) {
    const previous = index - 1;
    const current = index % SAMPLE_COUNT;
    const p1 = polar(geometry.center, ring.radii[previous], previous);
    const p2 = polar(geometry.center, ring.radii[current], index);
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.lineWidth = ring.widths[current] + 1.4;
    context.stroke();
  }
  context.restore();

  const event = data.events.find(
    (item) => item.year === data.years[selection.yearIndex].year && item.month === selection.month,
  );
  if (event) {
    const sample = start + 15;
    const point = polar(geometry.center, ring.radii[sample], sample);
    context.fillStyle = color;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(3, geometry.gap * 0.11), 0, TAU);
    context.fill();
  }
}

export function hitTest(geometry: Geometry, x: number, y: number): Selection | null {
  const dx = x - geometry.center;
  const dy = y - geometry.center;
  const radius = Math.hypot(dx, dy);
  if (radius < geometry.inner - geometry.gap || radius > geometry.size * 0.47) return null;

  const angle = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU;
  const month = Math.min(11, Math.floor((angle / TAU) * 12));
  const sample = Math.round((angle / TAU) * SAMPLE_COUNT) % SAMPLE_COUNT;
  let yearIndex = 0;
  let distance = Number.POSITIVE_INFINITY;
  geometry.rings.forEach((ring, index) => {
    const nextDistance = Math.abs(radius - ring.radii[sample]);
    if (nextDistance < distance) {
      distance = nextDistance;
      yearIndex = index;
    }
  });
  return { yearIndex, month };
}
