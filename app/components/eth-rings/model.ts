export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type MonthRecord = {
  month: number;
  open: number;
  close: number;
  returnPct: number;
  volumeUsd: number;
  volumeWeight: number;
};

export type YearRecord = {
  year: number;
  firstDate: string;
  lastDate: string;
  startProgress: number;
  progress: number;
  annual: {
    open: number;
    close: number;
    high: number;
    low: number;
    returnPct: number;
    volumeUsd: number;
  };
  priceShape: number[];
  months: MonthRecord[];
};

export type Milestone = {
  id: string;
  date: string;
  name: string;
  summary: string;
  category: string;
  sourceUrl: string;
  confidence: string;
  activation?: string;
};

export type Scar = {
  id: string;
  date: string;
  name: string;
  summary: string;
  affectedLayer: string;
  grossUsdAtIncident: number;
  reportedImpact: string;
  recoveryStatus: string;
  sourceUrl: string;
  confidence: string;
  visualMagnitude: number;
  healingState: "healed" | "closed" | "open";
};

export type MarketData = {
  period: string;
  chronology: {
    origin: string;
    marketDataFrom: string;
    preSeriesLabel: string;
  };
  source: {
    provider: string;
    market: string;
    frequency: string;
    url: string;
    cutoff: string;
    timezone: string;
    gaps: string[];
    observedRows: number;
  };
  cache: {
    schemaVersion: number;
    updatedAt: string;
  };
  methodology: { price: string; volume: string; caveat: string };
  years: YearRecord[];
  milestones: Milestone[];
  scars: Scar[];
};

export type Selection = { yearIndex: number; month: number };

export type EventSelection =
  | { kind: "milestone"; id: string }
  | { kind: "scar"; id: string }
  | null;
