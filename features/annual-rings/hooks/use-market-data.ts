'use client';

import { useEffect, useState } from 'react';
import type { MarketDocument } from '../domain/types';

type MarketDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: MarketDocument }
  | { status: 'error'; message: string };

export function useMarketData(): MarketDataState {
  const [state, setState] = useState<MarketDataState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void loadMarketData(controller.signal).then(setState);
    return () => controller.abort();
  }, []);

  return state;
}

async function loadMarketData(signal: AbortSignal): Promise<MarketDataState> {
  try {
    const response = await fetch('/api/market-data', { signal });
    if (!response.ok) throw new Error('The market cache is not ready yet.');
    return { status: 'ready', data: (await response.json()) as MarketDocument };
  } catch (error) {
    if (signal.aborted) return { status: 'loading' };
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Market data failed to load.',
    };
  }
}
