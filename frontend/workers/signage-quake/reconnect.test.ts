import { describe, expect, it } from 'vitest';
import {
  ALARM_INTERVAL_MS,
  nextAlarmAt,
  retryDelayMs,
  staleSince,
} from './reconnect';

describe('retryDelayMs', () => {
  it('1秒から倍々で、上限60秒を超えない', () => {
    const mid = () => 0.5;
    expect([0, 1, 2, 3, 6, 7, 20].map((n) => retryDelayMs(n, mid))).toEqual([
      1000, 2000, 4000, 8000, 60000, 60000, 60000,
    ]);
  });

  it('±20%に揺らぎ、上限も超えない', () => {
    expect(retryDelayMs(0, () => 0)).toBe(800);
    expect(retryDelayMs(0, () => 0.999999)).toBeCloseTo(1200, -1);
    expect(retryDelayMs(10, () => 0.999999)).toBe(60000);
  });
});

describe('nextAlarmAt', () => {
  it('再試行の時刻が無ければ30秒後', () => {
    expect(nextAlarmAt(1000, [])).toBe(1000 + ALARM_INTERVAL_MS);
  });
  it('30秒より早い再試行の時刻があればそれを選ぶ。過ぎていれば今', () => {
    expect(nextAlarmAt(1000, [5000, 90_000])).toBe(5000);
    expect(nextAlarmAt(1000, [500])).toBe(1000);
  });
});

describe('staleSince', () => {
  it('最後の受信と接続した時刻の遅いほう', () => {
    expect(staleSince(null, 100)).toBe(100);
    expect(staleSince(50, 100)).toBe(100);
    expect(staleSince(300, 100)).toBe(300);
  });
});
