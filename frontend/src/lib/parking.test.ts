import { describe, it, expect } from 'vitest';
import {
  isImageStale,
  isStale,
  IMAGE_STALE_AFTER_MS,
  STALE_AFTER_MS,
} from './parking';

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

describe('isImageStale', () => {
  it('15 分ちょうどで古い', () => {
    expect(isImageStale('2026-10-10T11:45:00.000Z', now)).toBe(true);
  });
  it('14 分 59 秒は古くない', () => {
    expect(isImageStale('2026-10-10T11:45:01.000Z', now)).toBe(false);
  });
  it('閾値は 15 分で状態の古さと別', () => {
    expect(IMAGE_STALE_AFTER_MS).toBe(15 * 60 * 1000);
    expect(IMAGE_STALE_AFTER_MS).not.toBe(STALE_AFTER_MS);
  });
});
