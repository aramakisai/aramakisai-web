import { describe, expect, it } from 'vitest';

import {
  validateBoothPlacement,
  validateCategoryContents,
  validatePerformanceSlot,
  validateStageAssignment,
  validateStageCategoryRemoval,
} from './constraints';

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

describe('validateCategoryContents', () => {
  it('選択したカテゴリの企画名が空なら違反とする', () => {
    expect(
      validateCategoryContents({ categories: ['stage'], stage: { name: '' } }),
    ).toEqual([{ field: 'stage.name', message: 'ステージを選択した場合は企画名の入力が必要' }]);
  });

  it('選択したカテゴリの企画名が入っていれば通す', () => {
    expect(
      validateCategoryContents({ categories: ['stage'], stage: { name: '特設ステージ団' } }),
    ).toEqual([]);
  });

  it('選択していないカテゴリの企画名が空でも通す', () => {
    expect(
      validateCategoryContents({ categories: ['stage'], stage: { name: '特設ステージ団' }, exhibit: { name: '' } }),
    ).toEqual([]);
  });

  it('複数カテゴリを選択していれば全カテゴリ分検証する', () => {
    expect(
      validateCategoryContents({ categories: ['stage', 'vendor'], stage: { name: '' }, vendor: { name: '' } }),
    ).toEqual([
      { field: 'stage.name', message: 'ステージを選択した場合は企画名の入力が必要' },
      { field: 'vendor.name', message: '出店を選択した場合は企画名の入力が必要' },
    ]);
  });
});

describe('validateStageAssignment', () => {
  it('ステージ未選択の企画への割り当ては拒否する', () => {
    expect(
      validateStageAssignment({ exhibition_id: 1 }, { exhibitionCategories: ['exhibit'] }),
    ).toEqual([
      { field: 'exhibition_id', message: 'ステージを選択していない企画は出演枠に割り当てられません' },
    ]);
  });

  it('ステージ選択済みの企画への割り当ては通す', () => {
    expect(
      validateStageAssignment({ exhibition_id: 1 }, { exhibitionCategories: ['stage'] }),
    ).toEqual([]);
  });

  it('企画を指定しない出演枠は拒否しない', () => {
    expect(
      validateStageAssignment({ exhibition_id: null }, { exhibitionCategories: null }),
    ).toEqual([]);
  });
});

describe('validateStageCategoryRemoval', () => {
  it('出演枠がある状態でステージを外すと拒否する', () => {
    expect(
      validateStageCategoryRemoval({ categories: ['exhibit'] }, { hasPerformanceSlots: true }),
    ).toEqual([
      { field: 'categories', message: '出演枠が割り当てられているためステージの選択を外せません' },
    ]);
  });

  it('出演枠がある状態でステージを維持していれば通す', () => {
    expect(
      validateStageCategoryRemoval({ categories: ['stage'] }, { hasPerformanceSlots: true }),
    ).toEqual([]);
  });

  it('出演枠がなければステージを外しても通す', () => {
    expect(
      validateStageCategoryRemoval({ categories: ['exhibit'] }, { hasPerformanceSlots: false }),
    ).toEqual([]);
  });
});
