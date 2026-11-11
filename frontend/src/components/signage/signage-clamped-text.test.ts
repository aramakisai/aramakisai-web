import { describe, expect, it } from 'vitest';
import { fitPrefixLength } from './signage-clamped-text';

describe('fitPrefixLength', () => {
  it('収まる最大の文字数を返す', () => {
    expect(fitPrefixLength(10, (n) => n <= 6)).toBe(6);
    expect(fitPrefixLength(10, () => true)).toBe(10);
    expect(fitPrefixLength(10, () => false)).toBe(0);
  });
});
