import { describe, expect, it } from 'vitest';
import {
  NOTICE_MOTION,
  NOTICE_SHAPES,
  beatDelaySec,
  noticeBpm,
} from './signage-stage-notice-shapes';

describe('noticeBpm', () => {
  it('60秒より多いと100、60秒ちょうどは120', () => {
    expect(noticeBpm(180)).toBe(100);
    expect(noticeBpm(60.001)).toBe(100);
    expect(noticeBpm(60)).toBe(120);
  });
  it('30秒ちょうどは120、30秒未満は140', () => {
    expect(noticeBpm(30)).toBe(120);
    expect(noticeBpm(29.999)).toBe(140);
    expect(noticeBpm(0)).toBe(140);
  });
});

describe('beatDelaySec', () => {
  it('周期内の負の値になる', () => {
    const periodSec = 60 / 120;
    const d = beatDelaySec(new Date(1_700_000_000_123), 120);
    expect(d).toBeLessThanOrEqual(0);
    expect(d).toBeGreaterThan(-periodSec);
  });
  it('同じ時刻なら同じ値', () => {
    const t = 1_700_000_000_123;
    expect(beatDelaySec(new Date(t), 100)).toBe(beatDelaySec(new Date(t), 100));
  });
  it('8拍の周期内の負の値になる', () => {
    const d = beatDelaySec(new Date(1_700_000_000_123), 100, 8);
    expect(d).toBeLessThanOrEqual(0);
    expect(d).toBeGreaterThan(-(60 / 100) * 8);
  });
  it('周期の境界で0', () => {
    expect(beatDelaySec(new Date(600 * 5), 100)).toBeCloseTo(0);
  });
});

describe('定数', () => {
  it('図形は9個でリングが1つ', () => {
    expect(NOTICE_SHAPES).toHaveLength(9);
    expect(NOTICE_SHAPES.filter((s) => s.kind === 'ring')).toHaveLength(1);
  });
  it('退場の合計は900ms', () => {
    expect(NOTICE_MOTION.leave.totalMs).toBe(900);
  });
});
