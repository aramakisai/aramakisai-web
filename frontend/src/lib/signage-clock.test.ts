import { describe, expect, it } from 'vitest';
import { formatSignageClock, formatSignageDate } from './signage-clock';

describe('signage clock', () => {
  const now = new Date('2026-11-02T05:07:00Z'); // JST 14:07 月曜
  it('日付はM/D (曜)', () => {
    expect(formatSignageDate(now)).toBe('11/2 (月)');
  });
  it('時計はJSTのHH:MM', () => {
    expect(formatSignageClock(now)).toBe('14:07');
  });
});
