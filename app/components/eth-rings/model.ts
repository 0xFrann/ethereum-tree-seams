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

export type MarketEvent = {
  year: number;
  month: number;
  name: string;
  loss: string;
  sourceUrl: string;
};

export type MarketData = {
  period: string;
  source: { provider: string; market: string; frequency: string; url: string; cutoff: string };
  methodology: { price: string; volume: string; caveat: string };
  years: YearRecord[];
  events: MarketEvent[];
};

export type Selection = { yearIndex: number; month: number };
