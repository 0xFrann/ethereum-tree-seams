const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function assertIsoDate(value: string): void {
  const parts = ISO_DATE.exec(value);
  if (!parts) throw new Error(`Expected an ISO date, received ${value}.`);

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Expected a real calendar date, received ${value}.`);
  }
}

export function dateFromUnixSeconds(value: number): string {
  if (!Number.isInteger(value)) throw new Error('Expected an integer Unix timestamp.');
  return new Date(value * 1_000).toISOString().slice(0, 10);
}

export function dayOfYearProgress(date: string, includeDay: boolean): number {
  assertIsoDate(date);
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const start = Date.UTC(year, 0, 1);
  const elapsed = (Date.UTC(year, month - 1, day) - start) / DAY_MS;
  const length = (Date.UTC(year + 1, 0, 1) - start) / DAY_MS;
  return Math.min(1, Math.max(0, (elapsed + Number(includeDay)) / length));
}
