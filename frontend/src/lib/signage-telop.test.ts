import { describe, expect, it } from 'vitest';
import { telopAt, telopBoxWidth, telopSchedule } from './signage-telop';

// チップ幅 148 → 横型の枠 600、縦型の枠 816
const CHIP = 148;

describe('telopBoxWidth', () => {
  it('帯の内寸からチップと間隔を引く', () => {
    expect(telopBoxWidth('landscape', CHIP)).toBe(600);
    expect(telopBoxWidth('portrait', CHIP)).toBe(816);
  });
});

describe('telopSchedule', () => {
  it('横型の枠に収まる文面は8秒、幅ちょうども収まる扱い', () => {
    expect(telopSchedule([100, 600], [CHIP, CHIP], 150)).toEqual([
      { scroll: false, durationSec: 8 },
      { scroll: false, durationSec: 8 },
    ]);
  });

  it('収まらない文面は(文面幅+縦型の枠幅)/速度を秒に切り上げる', () => {
    expect(telopSchedule([601], [CHIP], 150)).toEqual([
      { scroll: true, durationSec: 10 }, // 1417/150 = 9.45
    ]);
    expect(telopSchedule([834], [CHIP], 150)).toEqual([
      { scroll: true, durationSec: 11 }, // 1650/150 = 11
    ]);
  });

  it('チップが広い件ほど枠が狭まる', () => {
    expect(telopSchedule([600], [CHIP + 1], 150)[0].scroll).toBe(true);
  });

  it('0件は空', () => {
    expect(telopSchedule([], [], 150)).toEqual([]);
  });
});

describe('telopAt', () => {
  const schedule = telopSchedule([100, 1134], [CHIP, CHIP], 150); // 8秒 + 13秒 = 周期21秒

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
    const one = telopSchedule([100], [CHIP], 150);
    expect(telopAt(one, 8_000, 150)?.index).toBe(0);
  });
});
