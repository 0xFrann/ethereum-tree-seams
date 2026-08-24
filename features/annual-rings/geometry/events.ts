import { dayOfYearProgress } from '../domain/dates';
import type { Milestone, Scar, YearRecord } from '../domain/types';
import { polarPoint, type Point } from './polar';

type TimelineEvent = Milestone | Scar;

export type EventAnchor = Point & {
  id: string;
  kind: 'milestone' | 'scar';
  radius: number;
  angle: number;
};

export function eventAnchors(
  center: Point,
  years: YearRecord[],
  milestones: readonly Milestone[],
  scars: readonly Scar[],
): EventAnchor[] {
  return [
    ...milestones.map((event) => placeEvent(center, years, event, 'milestone')),
    ...scars.map((event) => placeEvent(center, years, event, 'scar')),
  ].filter((anchor): anchor is EventAnchor => anchor !== null);
}

function placeEvent(
  center: Point,
  years: YearRecord[],
  event: TimelineEvent,
  kind: EventAnchor['kind'],
): EventAnchor | null {
  const year = Number(event.date.slice(0, 4));
  const index = years.findIndex((candidate) => candidate.year === year);
  if (index < 0) return null;
  const radius = 72 + index * 32 + (kind === 'scar' ? 16 : 10);
  const angle = -Math.PI / 2 + dayOfYearProgress(event.date, true) * Math.PI * 2;
  return { ...polarPoint(center, radius, angle), id: event.id, kind, radius, angle };
}
