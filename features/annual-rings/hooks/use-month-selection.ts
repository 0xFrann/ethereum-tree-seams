'use client';

import { useState } from 'react';
import { initialSelection, moveSelection, selectedMonth } from '../domain/selectors';
import type { MarketDocument, MonthSelection } from '../domain/types';

export function useMonthSelection(data: MarketDocument | null) {
  const [selection, setSelection] = useState<MonthSelection | null>(null);

  const activeSelection = data
    ? selection && selectedMonth(data, selection)
      ? selection
      : initialSelection(data)
    : null;

  return {
    selection: activeSelection,
    select: setSelection,
    move: (offset: number) => {
      if (data && activeSelection) {
        setSelection(moveSelection(data, activeSelection, offset));
      }
    },
  };
}
