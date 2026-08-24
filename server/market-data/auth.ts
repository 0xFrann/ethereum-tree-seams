import { timingSafeEqual } from 'node:crypto';

export function hasRefreshAuthorization(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
