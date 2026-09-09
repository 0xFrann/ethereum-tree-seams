export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

type MonthRecord = {
  month: number;
  open: number;
  close: number;
  averageClose?: number;
  low?: number;
  high?: number;
  volumeUsd: number;
  volumeWeight: number;
};

type YearRecord = {
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
    volumeUsd: number;
  };
  priceShape: number[];
  volumeShape?: number[];
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
};

// A segment is a calendar month, whether it is backed by a market contour or
// solely by a chronology mark in the unpriced interval.
export type Selection = { year: number; month: number };

export type EventSelection = { kind: "milestone"; id: string } | null;
