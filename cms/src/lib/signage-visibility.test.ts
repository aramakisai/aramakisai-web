import { describe, expect, it } from 'vitest';

import { visibleSlideIds, type VisibilityGroup } from './signage-visibility';

const all = (visible: boolean): VisibilityGroup => ({ is_all: true, visible, slides: [] });
const group = (visible: boolean, slides: number[]): VisibilityGroup => ({ is_all: false, visible, slides });

describe('visibleSlideIds', () => {
  const enabled = [1, 2, 3, 4];

  it('「すべて」が表示中なら有効なスライドを全部返す', () => {
    expect(visibleSlideIds(enabled, [all(true), group(false, [1])])).toEqual([1, 2, 3, 4]);
  });

  it('「すべて」が非表示なら表示中の通常のグループの所属だけを返す', () => {
    expect(visibleSlideIds(enabled, [all(false), group(true, [2, 3]), group(false, [4])])).toEqual([2, 3]);
  });

  it('表示中のグループに属さないスライドは出ない', () => {
    expect(visibleSlideIds(enabled, [all(false), group(true, [1])])).toEqual([1]);
    expect(visibleSlideIds(enabled, [all(false)])).toEqual([]);
  });

  it('表示中と非表示の両方に属するスライドは出続ける', () => {
    expect(visibleSlideIds(enabled, [all(false), group(true, [2]), group(false, [2])])).toEqual([2]);
  });

  it('無効なスライドは所属があっても出ない', () => {
    expect(visibleSlideIds([1, 3], [all(false), group(true, [1, 2])])).toEqual([1]);
  });

  it('有効なスライドの並びを保つ', () => {
    expect(visibleSlideIds([4, 1, 3], [all(false), group(true, [1, 3, 4])])).toEqual([4, 1, 3]);
  });

  it('「すべて」の所属は参照しない', () => {
    expect(visibleSlideIds(enabled, [{ is_all: true, visible: false, slides: [1] }])).toEqual([]);
  });
});
