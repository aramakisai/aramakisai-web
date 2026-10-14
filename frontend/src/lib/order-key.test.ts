import { describe, it, expect } from 'vitest';
import { compareOrderKey } from './order-key';

describe('compareOrderKey', () => {
  it('文字列の大小で比べ、未設定は末尾に置く', () => {
    const keys = ['b00', null, 'a1', 'a0', undefined, 'B0'];
    expect([...keys].sort(compareOrderKey)).toEqual([
      'B0',
      'a0',
      'a1',
      'b00',
      null,
      undefined,
    ]);
  });
});
