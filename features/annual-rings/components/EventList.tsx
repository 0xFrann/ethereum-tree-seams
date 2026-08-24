'use client';

import type { EventSelection, MarketDocument } from '../domain/types';

type EventListProps = {
  data: MarketDocument;
  selection: EventSelection;
  onSelect: (selection: EventSelection) => void;
};

export function EventList({ data, selection, onSelect }: EventListProps) {
  const events = [
    ...data.milestones.map((event) => ({ ...event, kind: 'milestone' as const })),
    ...data.scars.map((event) => ({ ...event, kind: 'scar' as const })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <section
      className="event-list"
      aria-label="Protocol milestones and security incidents"
    >
      <h2>Rings remember</h2>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              aria-pressed={selection?.id === event.id}
              onClick={() => onSelect({ kind: event.kind, id: event.id })}
            >
              <span>{event.date}</span>
              {event.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
