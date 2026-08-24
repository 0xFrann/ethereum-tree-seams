import { MONTH_NAMES } from '../domain/selectors';
import { selectedMonth } from '../domain/selectors';
import type { MarketDocument, MonthSelection } from '../domain/types';

type MarketReadoutProps = {
  data: MarketDocument;
  selection: MonthSelection;
};

export function MarketReadout({ data, selection }: MarketReadoutProps) {
  const month = selectedMonth(data, selection);
  if (!month) return null;
  const returnPercent = ((month.close - month.open) / month.open) * 100;
  const sign = returnPercent >= 0 ? '+' : '';

  return (
    <section
      className="market-readout"
      aria-live="polite"
      aria-label="Selected market period"
    >
      <p>{`${MONTH_NAMES[month.month]} ${selection.year}`}</p>
      <strong>{formatUsd(month.close)}</strong>
      <span
        className={returnPercent >= 0 ? 'positive' : 'negative'}
      >{`${sign}${returnPercent.toFixed(1)}%`}</span>
      <dl>
        <div>
          <dt>Range</dt>
          <dd>{`${formatUsd(month.low)} — ${formatUsd(month.high)}`}</dd>
        </div>
        <div>
          <dt>Volume</dt>
          <dd>{formatCompactUsd(month.volumeUsd)}</dd>
        </div>
      </dl>
    </section>
  );
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
