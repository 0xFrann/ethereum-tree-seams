'use client';

import { useState } from 'react';
import type { EventSelection } from '../domain/types';
import { useMarketData } from '../hooks/use-market-data';
import { useMonthSelection } from '../hooks/use-month-selection';
import { EventList } from './EventList';
import { MarketReadout } from './MarketReadout';
import { MarketStatus } from './MarketStatus';
import { PeriodControls } from './PeriodControls';
import { RingCanvas } from './RingCanvas';
import styles from './AnnualRingsExplorer.module.css';

export function AnnualRingsExplorer() {
  const state = useMarketData();
  const data = state.status === 'ready' ? state.data : null;
  const { selection, select, move } = useMonthSelection(data);
  const [eventSelection, setEventSelection] = useState<EventSelection>(null);

  if (state.status === 'loading')
    return <MarketStatus message="Loading the observed market history…" />;
  if (state.status === 'error' || !data || !selection)
    return (
      <MarketStatus
        message={state.status === 'error' ? state.message : 'Market data is unavailable.'}
        error
      />
    );

  return (
    <section className={styles.explorer} aria-labelledby="rings-title">
      <div className={styles.graph}>
        <RingCanvas
          state={{ data, selection, eventSelection }}
          onSelect={select}
          onMove={move}
        />
        <div className={styles.center} aria-hidden="true">
          <span>◆</span>
          <strong>{data.source.market}</strong>
        </div>
      </div>
      <p className={styles.hint}>
        Select a point, use arrow keys, or choose a period below.
      </p>
      <PeriodControls data={data} selection={selection} onSelect={select} />
      <MarketReadout data={data} selection={selection} />
      <EventList data={data} selection={eventSelection} onSelect={setEventSelection} />
    </section>
  );
}
