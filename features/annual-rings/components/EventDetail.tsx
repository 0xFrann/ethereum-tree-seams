import type { EventSelection, MarketDocument } from '../domain/types';

type EventDetailProps = {
  data: MarketDocument;
  selection: EventSelection;
};

export function EventDetail({ data, selection }: EventDetailProps) {
  if (!selection) return null;
  const events = selection.kind === 'milestone' ? data.milestones : data.scars;
  const event = events.find((candidate) => candidate.id === selection.id);
  if (!event) return null;

  return (
    <aside className="event-detail" aria-label="Selected event" aria-live="polite">
      <p>{event.date}</p>
      <h3>{event.name}</h3>
      <p>{event.summary}</p>
      <a href={event.sourceUrl} target="_blank" rel="noreferrer">
        Read the source
      </a>
    </aside>
  );
}
