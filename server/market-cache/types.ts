export type CacheSnapshot = {
  text: string;
  etag: string | null;
};

export type CacheWrite = {
  text: string;
  previousEtag: string | null;
};

export interface MarketCache {
  read(): Promise<CacheSnapshot | null>;
  write(value: CacheWrite): Promise<void>;
}
