import { describe, expect, it } from 'vitest';

import { validateBoothPlacement, validatePerformanceSlot } from './constraints';

describe('validatePerformanceSlot', () => {
  it('exhibition_id があれば通す', () => {
    expect(validatePerformanceSlot({ exhibition_id: 1, title: null })).toEqual([]);
  });

  it('title があれば通す', () => {
    expect(validatePerformanceSlot({ exhibition_id: null, title: '特別公演' })).toEqual([]);
  });

  it('両方あれば通す', () => {
    expect(validatePerformanceSlot({ exhibition_id: 1, title: '特別公演' })).toEqual([]);
  });

  it('両方 NULL は違反とする', () => {
    expect(validatePerformanceSlot({ exhibition_id: null, title: null })).toEqual([
      {
        field: 'title',
        message: 'exhibition_id か title の少なくとも一方が必要',
      },
    ]);
  });

  it('空文字の title は値なしとして扱う', () => {
    expect(validatePerformanceSlot({ exhibition_id: null, title: '' })).toHaveLength(1);
  });
});

describe('validateBoothPlacement', () => {
  it('area_id と booth_number の組が重複していなければ通す', () => {
    expect(
      validateBoothPlacement({ area_id: 1, booth_number: 1 }, { duplicateExists: false }),
    ).toEqual([]);
  });

  it('組が重複していれば違反とする', () => {
    expect(
      validateBoothPlacement({ area_id: 1, booth_number: 1 }, { duplicateExists: true }),
    ).toEqual([
      {
        field: 'booth_number',
        message: '同じエリア内で既に使われているブース番号',
      },
    ]);
  });

  it('area_id が NULL なら重複判定の対象外', () => {
    expect(
      validateBoothPlacement({ area_id: null, booth_number: 1 }, { duplicateExists: true }),
    ).toEqual([]);
  });

  it('booth_number が NULL なら重複判定の対象外', () => {
    expect(
      validateBoothPlacement({ area_id: 1, booth_number: null }, { duplicateExists: true }),
    ).toEqual([]);
  });
});
