import { describe, it, expect } from 'vitest';
import {
  clampDisplacement,
  clampFrameDt,
  computeEntryOffsets,
  computeRepulsionAccel,
  deriveShapeMotionParams,
  ENTRY_MAX_OFFSET,
  ENTRY_MIN_OFFSET,
  findSectionCenter,
  isOffscreenVertically,
  isSettled,
  scrollVelocityImpulse,
  stepSpring,
  type SectionRect,
} from './background-shapes-motion';
import type { PlacedShape } from './background-shapes';

function shape(overrides: Partial<PlacedShape>): PlacedShape {
  return {
    kind: 'circle',
    size: 40,
    x: 100,
    y: 100,
    rotation: 0,
    color: 'bansai-ochre',
    texture: 'none',
    ...overrides,
  };
}

const section: SectionRect = {
  top: 0,
  bottom: 400,
  centerX: 200,
  centerY: 200,
};

describe('findSectionCenter', () => {
  it('y を含むセクションの中心を返す', () => {
    const sections: SectionRect[] = [
      { top: 0, bottom: 100, centerX: 10, centerY: 50 },
      { top: 100, bottom: 300, centerX: 20, centerY: 200 },
    ];
    expect(findSectionCenter(150, sections)).toEqual({ x: 20, y: 200 });
  });

  it('直下のセクションが無ければ最も近いセクションで代用する', () => {
    const sections: SectionRect[] = [
      { top: 0, bottom: 100, centerX: 10, centerY: 50 },
      { top: 200, bottom: 300, centerX: 20, centerY: 250 },
    ];
    // 100〜200 のすき間: 120 は 1 つ目 (bottom=100 との距離 20) に近い
    expect(findSectionCenter(120, sections)).toEqual({ x: 10, y: 50 });
  });

  it('セクションが無ければ undefined を返す', () => {
    expect(findSectionCenter(50, [])).toBeUndefined();
  });
});

describe('computeEntryOffsets', () => {
  it('同じ入力に対して常に同じ結果を返す (決定性)', () => {
    const shapes = [shape({ x: 300, y: 300 }), shape({ x: 50, y: 50 })];
    expect(computeEntryOffsets(shapes, [section])).toEqual(
      computeEntryOffsets(shapes, [section]),
    );
  });

  it('起点はセクション中心と反対方向へ 40〜120px ずれた位置になる', () => {
    // 図形はセクション中心 (200,200) から見て右下 (300,300) にある。
    // 「反対方向」= 中心から図形への向きにさらに離れる方向なので dx,dy は正になる
    const [offset] = computeEntryOffsets(
      [shape({ x: 300, y: 300 })],
      [section],
    );
    const distance = Math.hypot(offset.dx, offset.dy);
    expect(distance).toBeGreaterThanOrEqual(ENTRY_MIN_OFFSET);
    expect(distance).toBeLessThanOrEqual(ENTRY_MAX_OFFSET);
    expect(offset.dx).toBeGreaterThan(0);
    expect(offset.dy).toBeGreaterThan(0);
    expect(offset.delayMs).toBe(0);
  });

  it('リングの組は互いに異なる、ほぼ反対の方向から寄せ、2つ目は遅延を持つ', () => {
    const primary = shape({
      kind: 'ring',
      ringVariant: 'primary',
      x: 300,
      y: 300,
    });
    const secondary = shape({
      kind: 'ring',
      ringVariant: 'secondary',
      x: 321.76,
      y: 321.76,
      size: 27.2,
    });
    const [a, b] = computeEntryOffsets([primary, secondary], [section]);

    expect(a.delayMs).toBe(0);
    expect(b.delayMs).toBe(100);

    const angleA = Math.atan2(a.dy, a.dx);
    const angleB = Math.atan2(b.dy, b.dx);
    let diff = Math.abs(angleA - angleB);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    // 基準角度から独立に ±0.7rad ばらけるため、完全な反対 (π) からは
    // 最大で 2×0.7rad ずれうるが、それでも「ほぼ反対」の範囲に収まる
    expect(diff).toBeGreaterThan(Math.PI - 2 * 0.7);
  });
});

describe('deriveShapeMotionParams', () => {
  it('各値が想定レンジに収まり、決定的である', () => {
    const s = shape({});
    const a = deriveShapeMotionParams(s, 0);
    const b = deriveShapeMotionParams(s, 0);
    expect(a).toEqual(b);
    expect(a.stiffness).toBeGreaterThanOrEqual(70);
    expect(a.stiffness).toBeLessThanOrEqual(130);
    expect(a.damping).toBeGreaterThanOrEqual(10);
    expect(a.damping).toBeLessThanOrEqual(16);
    expect(a.scrollCoeff).toBeGreaterThanOrEqual(0.5);
    expect(a.scrollCoeff).toBeLessThanOrEqual(1.3);
    expect(a.repulseRadius).toBeGreaterThanOrEqual(120);
    expect(a.repulseRadius).toBeLessThanOrEqual(180);
    expect(a.displacementClamp).toBeGreaterThanOrEqual(8);
    expect(a.displacementClamp).toBeLessThanOrEqual(16);
  });

  it('index が異なれば値も変わりうる', () => {
    const s = shape({});
    const a = deriveShapeMotionParams(s, 0);
    const b = deriveShapeMotionParams(s, 1);
    expect(a).not.toEqual(b);
  });
});

describe('stepSpring', () => {
  it('外力が無ければ原点に留まる', () => {
    const state = { x: 0, y: 0, vx: 0, vy: 0 };
    const next = stepSpring(state, { ax: 0, ay: 0 }, 100, 12, 1 / 60);
    expect(next).toEqual({ x: 0, y: 0, vx: 0, vy: 0 });
  });

  it('変位を復元力によって時間とともに 0 へ収束させる', () => {
    let state = { x: 20, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 300; i++) {
      state = stepSpring(state, { ax: 0, ay: 0 }, 100, 12, 1 / 60);
    }
    expect(Math.abs(state.x)).toBeLessThan(0.1);
  });
});

describe('computeRepulsionAccel', () => {
  it('半径の外では 0 を返す', () => {
    const accel = computeRepulsionAccel(
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      150,
      1600,
    );
    expect(accel).toEqual({ ax: 0, ay: 0 });
  });

  it('最接近点では最大の加速度をポインターと反対向きに返す', () => {
    const accel = computeRepulsionAccel(
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      150,
      1600,
    );
    expect(accel.ax).toBeCloseTo(1600 * (1 - 10 / 150));
    expect(accel.ay).toBeCloseTo(0);
  });
});

describe('scrollVelocityImpulse', () => {
  it('下方向のスクロールでは負 (上へ取り残す) の値を返す', () => {
    expect(scrollVelocityImpulse(100, 1)).toBeLessThan(0);
  });

  it('上方向のスクロールでは正の値を返す', () => {
    expect(scrollVelocityImpulse(-100, 1)).toBeGreaterThan(0);
  });
});

describe('clampDisplacement', () => {
  it('上限以内ならそのまま返す', () => {
    expect(clampDisplacement(3, 4, 10)).toEqual({ x: 3, y: 4 });
  });

  it('上限を超えたら向きを保ったまま縮める', () => {
    const { x, y } = clampDisplacement(6, 8, 5); // 距離 10 → 上限 5 に縮める
    expect(Math.hypot(x, y)).toBeCloseTo(5);
    expect(x / y).toBeCloseTo(6 / 8);
  });
});

describe('isSettled', () => {
  it('変位・速度がいずれも閾値未満なら true', () => {
    expect(isSettled({ x: 0.01, y: 0.01, vx: 0.01, vy: 0.01 })).toBe(true);
  });

  it('いずれかが閾値以上なら false', () => {
    expect(isSettled({ x: 1, y: 0, vx: 0, vy: 0 })).toBe(false);
    expect(isSettled({ x: 0, y: 0, vx: 1, vy: 0 })).toBe(false);
  });
});

describe('clampFrameDt', () => {
  it('上限を超えた経過時間を上限に切り詰める', () => {
    expect(clampFrameDt(200)).toBe(50);
    expect(clampFrameDt(10)).toBe(10);
  });
});

describe('isOffscreenVertically', () => {
  it('ビューポート内では false', () => {
    expect(isOffscreenVertically(100, 200, 800)).toBe(false);
  });

  it('上下の余白を超えたら true', () => {
    expect(isOffscreenVertically(-200, -100, 800)).toBe(true);
    expect(isOffscreenVertically(900, 1000, 800)).toBe(true);
  });

  it('余白の内側ぎりぎりでは false', () => {
    expect(isOffscreenVertically(-50, 0, 800)).toBe(false);
    expect(isOffscreenVertically(800, 850, 800)).toBe(false);
  });
});
