import { describe, expect, it } from 'vitest';

import { performanceSlotName } from './performance-slot-name';

describe('performanceSlotName', () => {
  it('団体名を表示名より優先する', () => {
    expect(performanceSlotName('団体A', 'ライブ')).toBe('団体A');
  });
  it('団体名が無ければ表示名', () => {
    expect(performanceSlotName(null, 'ライブ')).toBe('ライブ');
    expect(performanceSlotName('', 'ライブ')).toBe('ライブ');
  });
  it('どちらも無ければ空文字', () => {
    expect(performanceSlotName(undefined, undefined)).toBe('');
  });
});
