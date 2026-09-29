import { describe, it, expect } from 'vitest';
import {
  clampDisplacement,
  clampFrameDt,
  computeEntryOffsets,
  computeRepulsionAccel,
  deriveShapeMotionParams,
  entryDurationMs,
  findSectionCenter,
  infRingEntryOffsets,
  isOffscreenVertically,
  isSettled,
  RING_SECOND_ENTRY_DELAY_MS,
  scrollVelocityImpulse,
  stepSpring,
  type SectionRect,
} from './background-shapes-motion';
import type { PlacedShape } from './background-shapes/types';

interface SolidOverrides {
  cx?: number;
  cy?: number;
  rot?: number;
  size?: number;
}

function lShape(overrides: SolidOverrides = {}): PlacedShape {
  return {
    tier: 'L',
    kind: 'circle',
    size: 300,
    cx: 100,
    cy: 100,
    rot: 0,
    texture: 'L1',
    colors: null,
    ...overrides,
  };
}

function sShape(overrides: SolidOverrides = {}): PlacedShape {
  return {
    tier: 'S',
    kind: 'circle',
    size: 90,
    cx: 100,
    cy: 100,
    rot: 0,
    texture: 'S1',
    colors: null,
    ...overrides,
  };
}

function infShape(overrides: SolidOverrides = {}): PlacedShape {
  return {
    tier: 'Inf',
    kind: 'ring',
    size: 140,
    cx: 100,
    cy: 100,
    rot: 0,
    texture: null,
    colors: ['ochre', 'olive'],
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
    expect(findSectionCenter(120, sections)).toEqual({ x: 10, y: 50 });
  });

  it('セクションが無ければ undefined を返す', () => {
    expect(findSectionCenter(50, [])).toBeUndefined();
  });
});

describe('entryDurationMs', () => {
  it('S は 1000ms、L と Inf は 1400ms (要件 10.1)', () => {
    expect(entryDurationMs('S')).toBe(1000);
    expect(entryDurationMs('L')).toBe(1400);
    expect(entryDurationMs('Inf')).toBe(1400);
  });
});

describe('computeEntryOffsets', () => {
  it('同じ入力に対して常に同じ結果を返す (決定性)', () => {
    const shapes = [lShape({ cx: 300, cy: 300 }), sShape({ cx: 50, cy: 50 })];
    expect(computeEntryOffsets(shapes, [section])).toEqual(
      computeEntryOffsets(shapes, [section]),
    );
  });

  it('S はセクション中心と反対方向へ 120〜280px ずれた位置になる', () => {
    const [offset] = computeEntryOffsets(
      [sShape({ cx: 300, cy: 300 })],
      [section],
    );
    const distance = Math.hypot(offset.dx, offset.dy);
    expect(distance).toBeGreaterThanOrEqual(120);
    expect(distance).toBeLessThanOrEqual(280);
    expect(offset.dx).toBeGreaterThan(0);
    expect(offset.dy).toBeGreaterThan(0);
    expect(offset.delayMs).toBe(0);
  });

  it('L はセクション中心と反対方向へ 80〜160px ずれた位置になる', () => {
    const [offset] = computeEntryOffsets(
      [lShape({ cx: 300, cy: 300 })],
      [section],
    );
    const distance = Math.hypot(offset.dx, offset.dy);
    expect(distance).toBeGreaterThanOrEqual(80);
    expect(distance).toBeLessThanOrEqual(160);
  });

  it('∞ の外側要素は入場の移動を持たない (輪だけが動く)', () => {
    const [offset] = computeEntryOffsets([infShape()], [section]);
    expect(offset).toEqual({ dx: 0, dy: 0, delayMs: 0 });
  });
});

describe('infRingEntryOffsets', () => {
  it('1 つ目は局所 -x 側、2 つ目は局所 +x 側から寄せ、2 つ目は 150ms 遅延する', () => {
    const [a, b] = infRingEntryOffsets(0);

    expect(a.dx).toBeLessThan(0);
    expect(a.dy).toBe(0);
    expect(a.delayMs).toBe(0);

    expect(b.dx).toBeGreaterThan(0);
    expect(b.dy).toBe(0);
    expect(b.delayMs).toBe(RING_SECOND_ENTRY_DELAY_MS);
  });

  it('距離は L と同じ 80〜160px の範囲に収まり、決定的である', () => {
    const [a, b] = infRingEntryOffsets(3);
    expect(Math.abs(a.dx)).toBeGreaterThanOrEqual(80);
    expect(Math.abs(a.dx)).toBeLessThanOrEqual(160);
    expect(Math.abs(b.dx)).toBeGreaterThanOrEqual(80);
    expect(Math.abs(b.dx)).toBeLessThanOrEqual(160);
    expect(infRingEntryOffsets(3)).toEqual([a, b]);
  });
});

describe('deriveShapeMotionParams', () => {
  it('S の変位上限は 24〜40px、反発半径は 160〜240px (要件 10.3)', () => {
    const p = deriveShapeMotionParams(sShape(), 0);
    expect(p.displacementClamp).toBeGreaterThanOrEqual(24);
    expect(p.displacementClamp).toBeLessThanOrEqual(40);
    expect(p.repulseRadius).toBeGreaterThanOrEqual(160);
    expect(p.repulseRadius).toBeLessThanOrEqual(240);
  });

  it('L の変位上限は 8〜16px', () => {
    const p = deriveShapeMotionParams(lShape(), 0);
    expect(p.displacementClamp).toBeGreaterThanOrEqual(8);
    expect(p.displacementClamp).toBeLessThanOrEqual(16);
  });

  it('∞ は L と同じ変位上限 (8〜16px) を使う', () => {
    const p = deriveShapeMotionParams(infShape(), 0);
    expect(p.displacementClamp).toBeGreaterThanOrEqual(8);
    expect(p.displacementClamp).toBeLessThanOrEqual(16);
  });

  it('決定的である', () => {
    const s = sShape();
    expect(deriveShapeMotionParams(s, 0)).toEqual(
      deriveShapeMotionParams(s, 0),
    );
  });

  it('index が異なれば値も変わりうる', () => {
    const s = sShape();
    expect(deriveShapeMotionParams(s, 0)).not.toEqual(
      deriveShapeMotionParams(s, 1),
    );
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
    const { x, y } = clampDisplacement(6, 8, 5);
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
