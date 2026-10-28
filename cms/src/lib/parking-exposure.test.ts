import { describe, expect, it } from 'vitest';

import { nextExposure, type ExposureBasis } from './parking-exposure';

const CAPTURED = '2026-09-27T01:00:00.000Z';
const at = (min: number) => new Date(Date.parse(CAPTURED) + min * 60_000);
const basis = (quality: ExposureBasis['quality'], exposure = 0): ExposureBasis => ({
  quality,
  exposure,
  capturedAt: CAPTURED,
});

describe('nextExposure', () => {
  it('起点が無ければ null', () => {
    expect(nextExposure(null, at(0))).toBeNull();
  });

  it('起点の撮影から 30 分ちょうどまでは使い、超えたら null', () => {
    expect(nextExposure(basis('ok', 1), at(30))).toBe(1);
    expect(nextExposure(basis('ok', 1), new Date(at(30).getTime() + 1))).toBeNull();
  });

  it('写り具合ごとに増減する', () => {
    expect(nextExposure(basis('too_dark', 0), at(5))).toBe(1);
    expect(nextExposure(basis('too_bright', 0), at(5))).toBe(-1);
    expect(nextExposure(basis('ok', 1), at(5))).toBe(1);
    expect(nextExposure(basis('color_cast', -1), at(5))).toBe(-1);
  });

  it('-2〜2 で頭打ちになる', () => {
    expect(nextExposure(basis('too_dark', 2), at(5))).toBe(2);
    expect(nextExposure(basis('too_bright', -2), at(5))).toBe(-2);
  });
});
