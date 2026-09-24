import { describe, expect, it } from 'vitest';

import {
  newImageIds,
  validateBoothPlacement,
  validateCategoryContents,
  validateImageCount,
  validateImageOwnership,
  validateOwnerRole,
  validateOwnerUniqueness,
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

describe('validateOwnerRole', () => {
  it('owner 未指定なら判定の対象外', () => {
    expect(validateOwnerRole({ owner: null }, { ownerIsStudentExhibitor: false })).toEqual([]);
  });

  it('学生団体ロールなら通す', () => {
    expect(validateOwnerRole({ owner: 1 }, { ownerIsStudentExhibitor: true })).toEqual([]);
  });

  it('学生団体ロールでなければ (未検出も含め) 違反とする', () => {
    expect(validateOwnerRole({ owner: 1 }, { ownerIsStudentExhibitor: false })).toEqual([
      { field: 'owner', message: '所有者に学生団体のアカウントを選んでください。' },
    ]);
  });
});

describe('validateOwnerUniqueness', () => {
  it('owner 未指定なら判定の対象外', () => {
    expect(validateOwnerUniqueness({ owner: null }, { duplicateOwner: null })).toEqual([]);
  });

  it('重複が無ければ通す', () => {
    expect(validateOwnerUniqueness({ owner: 1 }, { duplicateOwner: null })).toEqual([]);
  });

  it('重複があればメールアドレスと相手の団体名を差し込んで違反とする', () => {
    expect(
      validateOwnerUniqueness(
        { owner: 1 },
        { duplicateOwner: { email: 'owner@test.local', organizationName: '既存団体' } }, // confidential:allow
      ),
    ).toEqual([
      { field: 'owner', message: 'owner@test.localは既に既存団体の所有者です。' }, // confidential:allow
    ]);
  });
});

describe('validateImageCount', () => {
  const imagesOf = (count: number) => ({ images: Array.from({ length: count }, (_, i) => i + 1) });

  it('5 枚以下は通す', () => {
    expect(validateImageCount({ stage: imagesOf(5) })).toEqual([]);
  });

  it('6 枚以上は違反とする', () => {
    expect(validateImageCount({ stage: imagesOf(6) })).toEqual([
      { field: 'stage.images', message: '画像は最大5枚です。' },
    ]);
  });

  it('複数カテゴリで超過していれば両方を報告する', () => {
    expect(validateImageCount({ stage: imagesOf(6), vendor: imagesOf(6) })).toEqual([
      { field: 'stage.images', message: '画像は最大5枚です。' },
      { field: 'vendor.images', message: '画像は最大5枚です。' },
    ]);
  });
});

describe('newImageIds', () => {
  it('originalDoc に無い ID だけを新規として集める', () => {
    expect(
      newImageIds(
        { stage: { images: [1, 2, 3] } },
        { stage: { images: [1] } },
      ),
    ).toEqual([2, 3]);
  });

  it('originalDoc が無い (create) 場合は全件が新規', () => {
    expect(newImageIds({ stage: { images: [1, 2] } }, {})).toEqual([1, 2]);
  });

  it('populate 済みオブジェクト ({ id }) の値も ID として扱う', () => {
    expect(newImageIds({ stage: { images: [{ id: 1 }] } }, {})).toEqual([1]);
  });

  it('複数カテゴリ分をまとめて重複なく返す', () => {
    expect(
      newImageIds({ stage: { images: [1] }, vendor: { images: [1, 2] } }, {}),
    ).toEqual([1, 2]);
  });
});

describe('validateImageOwnership', () => {
  it('unauthorizedImageIds が空なら通す', () => {
    expect(
      validateImageOwnership({ stage: { images: [1] } }, { unauthorizedImageIds: new Set() }),
    ).toEqual([]);
  });

  it('対象カテゴリに未許可の画像 ID があれば違反とする', () => {
    expect(
      validateImageOwnership(
        { stage: { images: [1, 2] } },
        { unauthorizedImageIds: new Set(['2']) },
      ),
    ).toEqual([
      { field: 'stage.images', message: '【仮】自分がアップロードした画像だけを選べます。' },
    ]);
  });

  it('未許可の画像を含まないカテゴリは通す', () => {
    expect(
      validateImageOwnership(
        { stage: { images: [1] }, vendor: { images: [2] } },
        { unauthorizedImageIds: new Set(['2']) },
      ),
    ).toEqual([{ field: 'vendor.images', message: '【仮】自分がアップロードした画像だけを選べます。' }]);
  });
});
