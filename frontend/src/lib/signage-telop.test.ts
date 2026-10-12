import { describe, expect, it } from 'vitest';
import { telopAt, telopBoxWidth, telopSchedule } from './signage-telop';

describe('telopBoxWidth', () => {
  it('帯の内寸(左右余白を除いた幅)', () => {
    expect(telopBoxWidth('landscape')).toBe(936);
    expect(telopBoxWidth('portrait')).toBe(984);
  });
});

describe('telopSchedule', () => {
  it('横型の枠に収まる文面は8秒、幅ちょうども収まる扱い', () => {
    expect(telopSchedule([100, 936], 150)).toEqual([
      { scroll: false, durationSec: 8 },
      { scroll: false, durationSec: 8 },
    ]);
  });

  it('収まらない文面は(文面幅+縦型の枠幅)/速度を秒に切り上げる', () => {
    expect(telopSchedule([937], 150)).toEqual([
      { scroll: true, durationSec: 13 }, // 1921/150 = 12.8
    ]);
    expect(telopSchedule([966], 150)).toEqual([
      { scroll: true, durationSec: 13 }, // 1950/150 = 13
    ]);
  });

  it('0件は空', () => {
    expect(telopSchedule([], 150)).toEqual([]);
  });
});

describe('telopAt', () => {
  const schedule = telopSchedule([100, 966], 150); // 8秒 + 13秒 = 周期21秒

  it('0件・周期0ではnull', () => {
    expect(telopAt([], 5000, 150)).toBeNull();
    expect(telopAt([{ scroll: false, durationSec: 0 }], 5000, 150)).toBeNull();
  });

  it('周期の境目で次の件へ進み、周期の終わりで先頭へ戻る', () => {
    expect(telopAt(schedule, 7_999, 150)?.index).toBe(0);
    expect(telopAt(schedule, 8_000, 150)?.index).toBe(1);
    expect(telopAt(schedule, 20_999, 150)?.index).toBe(1);
    expect(telopAt(schedule, 21_000, 150)?.index).toBe(0);
    expect(telopAt(schedule, 21_000 * 1000 + 8_000, 150)?.index).toBe(1);
  });

  it('流さない件は流れた距離なし', () => {
    expect(telopAt(schedule, 3_000, 150)?.scrolledPx).toBeNull();
  });

  it('流す件は件の始まりから時刻に比例して流れる', () => {
    expect(telopAt(schedule, 8_000, 150)?.scrolledPx).toBe(0);
    expect(telopAt(schedule, 10_000, 150)?.scrolledPx).toBe(300);
  });

  it('1件だけでも周期で繰り返す', () => {
    const one = telopSchedule([100], 150);
    expect(telopAt(one, 8_000, 150)?.index).toBe(0);
  });
});
