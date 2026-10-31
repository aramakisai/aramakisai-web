import { describe, expect, test } from 'vitest';
import { stickyOffset } from './sticky-offset';

describe('stickyOffset', () => {
  test('見出しの下端に届くまでは 0、越えた分だけ動き、カードの下端で止まり、中身が収まらないカードは動かない', () => {
    expect(stickyOffset(200, 400, 80, 130)).toBe(0);
    expect(stickyOffset(100, 400, 80, 130)).toBe(30);
    expect(stickyOffset(-500, 400, 80, 130)).toBe(320);
    expect(stickyOffset(100, 80, 80, 130)).toBe(0);
    expect(stickyOffset(100, 60, 80, 130)).toBe(0);
  });
});
