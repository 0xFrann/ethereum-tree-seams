export type DailyMarketRecord = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};

export type MonthRecord = {
  month: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volumeUsd: number;
  priceShape: number;
  volumeWeight: number;
};

export type YearRecord = {
  year: number;
  firstDate: string;
  lastDate: string;
  startProgress: number;
  progress: number;
  annual: Pick<MonthRecord, 'open' | 'close' | 'high' | 'low' | 'volumeUsd'>;
  months: MonthRecord[];
};

type TimelineEvent = {
  id: string;
  date: string;
  name: string;
  summary: string;
  sourceUrl: string;
};

export type Milestone = TimelineEvent & {
  category: string;
  activation: string;
};

export type Scar = TimelineEvent & {
  affectedLayer: string;
  grossUsdAtIncident: number;
  reportedImpact: string;
  recoveryStatus: string;
  healingState: 'healed' | 'closed' | 'open';
  visualMagnitude: number;
};

export type MarketDocument = {
  schemaVersion: 1;
  refreshedAt: string;
  chronology: {
    origin: string;
    marketDataFrom: string;
  };
  source: {
    provider: string;
    market: string;
    cutoff: string;
    observedRows: number;
    gaps: string[];
  };
  years: YearRecord[];
  milestones: Milestone[];
  scars: Scar[];
};

export type MonthSelection = {
  year: number;
  month: number;
};

export type EventSelection =
  { kind: 'milestone'; id: string } | { kind: 'scar'; id: string } | null;
