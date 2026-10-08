import { describe, expect, it } from 'vitest';
import {
  TELOP_FIT_MS,
  TELOP_SPEED_PX_PER_SEC,
  nextTelopIndex,
  telopPlan,
} from './signage-telop';

describe('telopPlan', () => {
  it('幅に収まる文面は静止して8秒', () => {
    expect(telopPlan(500, 600)).toEqual({ scroll: false, durationMs: 8000 });
    expect(telopPlan(600, 600)).toEqual({ scroll: false, durationMs: 8000 });
    expect(TELOP_FIT_MS).toBe(8000);
  });

  it('収まらない文面は枠の右端から文面の末尾が左端を抜けるまでの距離を一定速度で流す', () => {
    const plan = telopPlan(1500, 600);
    expect(plan.scroll).toBe(true);
    expect(plan.durationMs).toBeCloseTo(
      ((1500 + 600) / TELOP_SPEED_PX_PER_SEC) * 1000,
    );
  });

  it('速度を渡せる', () => {
    expect(telopPlan(1000, 500, 300).durationMs).toBeCloseTo(5000);
  });
});

describe('nextTelopIndex', () => {
  it('並び順に進み末尾から先頭へ戻る', () => {
    expect(nextTelopIndex(0, 3)).toBe(1);
    expect(nextTelopIndex(2, 3)).toBe(0);
  });

  it('件数が減って範囲外になっても先頭へ収める', () => {
    expect(nextTelopIndex(5, 2)).toBe(0);
    expect(nextTelopIndex(0, 0)).toBe(0);
  });
});
