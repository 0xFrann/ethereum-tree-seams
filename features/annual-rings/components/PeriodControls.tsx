'use client';

import { MONTH_NAMES } from '../domain/selectors';
import type { MarketDocument, MonthSelection } from '../domain/types';

type PeriodControlsProps = {
  data: MarketDocument;
  selection: MonthSelection;
  onSelect: (selection: MonthSelection) => void;
};

export function PeriodControls({ data, selection, onSelect }: PeriodControlsProps) {
  const selectedYear =
    data.years.find((year) => year.year === selection.year) ?? data.years[0];
  if (!selectedYear) return null;

  return (
    <div className="period-controls" aria-label="Market period controls">
      <div className="year-controls" aria-label="Year">
        {data.years.map((year) => (
          <button
            key={year.year}
            type="button"
            aria-pressed={year.year === selection.year}
            onClick={() =>
              onSelect({ year: year.year, month: year.months.at(-1)?.month ?? 0 })
            }
          >
            {year.year}
          </button>
        ))}
      </div>
      <div className="month-controls" aria-label="Month">
        {selectedYear.months.map((month) => (
          <button
            key={month.month}
            type="button"
            aria-pressed={month.month === selection.month}
            onClick={() => onSelect({ year: selectedYear.year, month: month.month })}
          >
            {MONTH_NAMES[month.month]}
          </button>
        ))}
      </div>
    </div>
  );
}
