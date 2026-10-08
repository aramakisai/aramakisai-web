import { describe, expect, it } from 'vitest';
import { telopAt, telopSchedule } from './signage-telop';

describe('telopSchedule', () => {
  it('収まる文面は8秒、幅ちょうども収まる扱い', () => {
    expect(telopSchedule([100, 600], 600, 150)).toEqual([
      { scroll: false, durationSec: 8 },
      { scroll: false, durationSec: 8 },
    ]);
  });

  it('収まらない文面は(文面幅+枠幅)/速度を秒に切り上げる', () => {
    expect(telopSchedule([601], 600, 150)).toEqual([
      { scroll: true, durationSec: 9 }, // 1201/150 = 8.007
    ]);
    expect(telopSchedule([900], 600, 150)).toEqual([
      { scroll: true, durationSec: 10 },
    ]);
  });

  it('0件は空', () => {
    expect(telopSchedule([], 600, 150)).toEqual([]);
  });
});

describe('telopAt', () => {
  const schedule = telopSchedule([100, 900], 600, 150); // 8秒 + 10秒 = 周期18秒

  it('0件・周期0ではnull', () => {
    expect(telopAt([], 600, 5000, 150)).toBeNull();
    expect(
      telopAt([{ scroll: false, durationSec: 0 }], 600, 5000, 150),
    ).toBeNull();
  });

  it('周期の境目で次の件へ進み、周期の終わりで先頭へ戻る', () => {
    expect(telopAt(schedule, 600, 7_999, 150)?.index).toBe(0);
    expect(telopAt(schedule, 600, 8_000, 150)?.index).toBe(1);
    expect(telopAt(schedule, 600, 17_999, 150)?.index).toBe(1);
    expect(telopAt(schedule, 600, 18_000, 150)?.index).toBe(0);
    expect(telopAt(schedule, 600, 18_000 * 1000 + 8_000, 150)?.index).toBe(1);
  });

  it('流さない件は位置0', () => {
    expect(telopAt(schedule, 600, 3_000, 150)?.translateX).toBe(0);
  });

  it('流す件は枠の右端から始まり、時刻に比例して左へ動く', () => {
    expect(telopAt(schedule, 600, 8_000, 150)?.translateX).toBe(600);
    expect(telopAt(schedule, 600, 10_000, 150)?.translateX).toBe(300);
    // 流し切った後は文面が枠の左外に出たまま(文面幅900にほぼ達する)
    expect(telopAt(schedule, 600, 17_999, 150)?.translateX).toBeLessThan(-890);
  });

  it('1件だけでも周期で繰り返す', () => {
    const one = telopSchedule([100], 600, 150);
    expect(telopAt(one, 600, 8_000, 150)?.index).toBe(0);
  });
});
