import { describe, expect, it } from 'vitest';
import { formatFullDate } from './format-date';

describe('formatFullDate', () => {
  it('月・日をゼロ埋めせず「年月日」で表記する', () => {
    expect(formatFullDate('2026-09-22T00:00:00.000Z')).toBe('2026年9月22日');
  });

  it('1 桁の月・日でも先頭の 0 を付けない', () => {
    expect(formatFullDate('2026-07-05T00:00:00.000Z')).toBe('2026年7月5日');
  });

  it('UTC 深夜の時刻は JST の暦日 (翌日) で表記する', () => {
    // UTC 15:00 は JST +9h で翌日 00:00 になる
    expect(formatFullDate('2026-07-10T15:00:00.000Z')).toBe('2026年7月11日');
  });
});
