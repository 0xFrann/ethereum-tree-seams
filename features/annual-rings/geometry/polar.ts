export type Point = { x: number; y: number };

export function polarPoint(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

export function calendarAngle(month: number, fraction = 0.5): number {
  return -Math.PI / 2 + ((month + fraction) / 12) * Math.PI * 2;
}
