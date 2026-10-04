import { describe, it, expect } from 'vitest';
import { isStale, STALE_AFTER_MS } from './parking';

const now = new Date('2026-10-10T12:00:00.000Z');

describe('isStale', () => {
  it('30 分ちょうどは古くない', () => {
    expect(isStale('2026-10-10T11:30:00.000Z', now)).toBe(false);
  });
  it('30 分 1 秒は古い', () => {
    expect(isStale('2026-10-10T11:29:59.000Z', now)).toBe(true);
  });
  it('直近は古くない', () => {
    expect(isStale('2026-10-10T11:59:00.000Z', now)).toBe(false);
  });
  it('閾値は 30 分', () => {
    expect(STALE_AFTER_MS).toBe(30 * 60 * 1000);
  });
});
