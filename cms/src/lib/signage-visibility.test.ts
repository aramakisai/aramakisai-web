import { describe, expect, it } from 'vitest';

import { visibleMemberIds, type VisibilityGroup } from './signage-visibility';

const all = (visible: boolean): VisibilityGroup => ({ is_all: true, visible, slides: [], telops: [] });
const group = (visible: boolean, slides: number[], telops: number[] = []): VisibilityGroup => ({
  is_all: false,
  visible,
  slides,
  telops,
});

describe('visibleMemberIds (slides)', () => {
  const enabled = [1, 2, 3, 4];

  it('「すべて」が表示中なら有効なスライドを全部返す', () => {
    expect(visibleMemberIds(enabled, [all(true), group(false, [1])], 'slides')).toEqual([1, 2, 3, 4]);
  });

  it('「すべて」が非表示なら表示中の通常のグループの所属だけを返す', () => {
    expect(visibleMemberIds(enabled, [all(false), group(true, [2, 3]), group(false, [4])], 'slides')).toEqual([2, 3]);
  });

  it('表示中のグループに属さないスライドは出ない', () => {
    expect(visibleMemberIds(enabled, [all(false), group(true, [1])], 'slides')).toEqual([1]);
    expect(visibleMemberIds(enabled, [all(false)], 'slides')).toEqual([]);
  });

  it('表示中と非表示の両方に属するスライドは出続ける', () => {
    expect(visibleMemberIds(enabled, [all(false), group(true, [2]), group(false, [2])], 'slides')).toEqual([2]);
  });

  it('無効なスライドは所属があっても出ない', () => {
    expect(visibleMemberIds([1, 3], [all(false), group(true, [1, 2])], 'slides')).toEqual([1]);
  });

  it('有効なスライドの並びを保つ', () => {
    expect(visibleMemberIds([4, 1, 3], [all(false), group(true, [1, 3, 4])], 'slides')).toEqual([4, 1, 3]);
  });

  it('「すべて」の所属は参照しない', () => {
    expect(visibleMemberIds(enabled, [{ is_all: true, visible: false, slides: [1], telops: [] }], 'slides')).toEqual([]);
  });
});

describe('visibleMemberIds (telops)', () => {
  const enabled = [1, 2, 3];

  it('「すべて」が表示中なら有効なテロップを全部返す', () => {
    expect(visibleMemberIds(enabled, [all(true)], 'telops')).toEqual([1, 2, 3]);
  });

  it('「すべて」が非表示なら表示中の通常グループの所属だけを、元の並びで返す', () => {
    const groups = [all(false), group(true, [], [3, 1]), group(false, [], [2])];
    expect(visibleMemberIds(enabled, groups, 'telops')).toEqual([1, 3]);
  });

  it('未所属・非表示グループのみ所属は出ない', () => {
    expect(visibleMemberIds(enabled, [all(false), group(false, [], [1])], 'telops')).toEqual([]);
  });

  it('スライドの所属はテロップの判定に影響しない', () => {
    expect(visibleMemberIds(enabled, [all(false), group(true, [1], [])], 'telops')).toEqual([]);
  });
});
