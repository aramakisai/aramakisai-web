import { describe, expect, it } from 'vitest';

import {
  newImageIds,
  validateBoothPlacement,
  validateCategoryBoothPlacements,
  validateCategoryContents,
  validateImageCount,
  validateImageOwnership,
  validateOwnerRole,
  validateOwnerUniqueness,
  toJstDateKey,
  toJstMinuteOfDay,
  toSlotWindow,
  validatePerformanceOverlap,
  validatePerformanceSlot,
  validateSlotEventDate,
  validateSlotRange,
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

describe('validateCategoryBoothPlacements', () => {
  const none = new Set<string>();

  it('配置が未設定なら通す', () => {
    expect(
      validateCategoryBoothPlacements(
        [{ key: 'exhibit', value: { area_id: null, booth_number: 1 } }, { key: 'vendor', value: undefined }],
        { duplicateKeys: none },
      ),
    ).toEqual([]);
  });

  it('他企画と重複したカテゴリのブース番号を違反にする', () => {
    expect(
      validateCategoryBoothPlacements(
        [{ key: 'vendor', value: { area_id: 1, booth_number: 2 } }],
        { duplicateKeys: new Set(['vendor']) },
      ),
    ).toEqual([{ field: 'vendor.booth_number', message: '同じエリア内で既に使われているブース番号' }]);
  });

  it('同一企画内の別カテゴリが同じエリア・番号なら違反にする', () => {
    expect(
      validateCategoryBoothPlacements(
        [
          { key: 'exhibit', value: { area_id: 1, booth_number: 2 } },
          { key: 'vendor', value: { area_id: 1, booth_number: 2 } },
        ],
        { duplicateKeys: none },
      ),
    ).toEqual([{ field: 'vendor.booth_number', message: '同じエリア内で既に使われているブース番号' }]);
  });

  it('同一企画内でもエリアか番号が違えば通す', () => {
    expect(
      validateCategoryBoothPlacements(
        [
          { key: 'exhibit', value: { area_id: 1, booth_number: 2 } },
          { key: 'vendor', value: { area_id: 2, booth_number: 2 } },
        ],
        { duplicateKeys: none },
      ),
    ).toEqual([]);
  });
});

describe('validateCategoryContents', () => {
  const fullContent = { name: '特設ステージ団', description: '紹介文', images: [1] };

  it('実行委員には団体名・企画内容の必須チェックを課さない', () => {
    expect(
      validateCategoryContents(
        { categories: ['stage'], stage: {} },
        { isStudentExhibitor: false },
      ),
    ).toEqual([]);
  });

  it('学生団体は団体名が空なら違反とする', () => {
    expect(
      validateCategoryContents(
        { organization_name: '', categories: [] },
        { isStudentExhibitor: true },
      ),
    ).toEqual([{ field: 'organization_name', message: '団体名の入力が必要' }]);
  });

  it('学生団体は選択したカテゴリの企画名・紹介文・画像が空なら違反とする', () => {
    expect(
      validateCategoryContents(
        { organization_name: '団体', categories: ['stage'], stage: {} },
        { isStudentExhibitor: true },
      ),
    ).toEqual([
      { field: 'stage.name', message: 'ステージを選択した場合は企画名の入力が必要' },
      { field: 'stage.description', message: 'ステージを選択した場合は紹介文の入力が必要' },
      { field: 'stage.images', message: 'ステージを選択した場合は画像が1枚以上必要' },
    ]);
  });

  it('学生団体は選択したカテゴリの企画内容が揃っていれば通す', () => {
    expect(
      validateCategoryContents(
        { organization_name: '団体', categories: ['stage'], stage: fullContent },
        { isStudentExhibitor: true },
      ),
    ).toEqual([]);
  });

  it('学生団体は選択していないカテゴリの企画内容が空でも通す', () => {
    expect(
      validateCategoryContents(
        { organization_name: '団体', categories: ['stage'], stage: fullContent, exhibit: {} },
        { isStudentExhibitor: true },
      ),
    ).toEqual([]);
  });

  it('学生団体は複数カテゴリを選択していれば全カテゴリ分検証する', () => {
    expect(
      validateCategoryContents(
        { organization_name: '団体', categories: ['stage', 'vendor'], stage: {}, vendor: {} },
        { isStudentExhibitor: true },
      ),
    ).toEqual([
      { field: 'stage.name', message: 'ステージを選択した場合は企画名の入力が必要' },
      { field: 'stage.description', message: 'ステージを選択した場合は紹介文の入力が必要' },
      { field: 'stage.images', message: 'ステージを選択した場合は画像が1枚以上必要' },
      { field: 'vendor.name', message: '出店を選択した場合は企画名の入力が必要' },
      { field: 'vendor.description', message: '出店を選択した場合は紹介文の入力が必要' },
      { field: 'vendor.images', message: '出店を選択した場合は画像が1枚以上必要' },
      { field: 'vendor.open_days', message: '出店を選択した場合は出店日の選択が必要' },
    ]);
  });

  it('学生団体は stage 以外のカテゴリで出店日が空なら違反とする', () => {
    const open = { ...fullContent, open_days: [] };
    expect(
      validateCategoryContents(
        { organization_name: '団体', categories: ['exhibit'], exhibit: open },
        { isStudentExhibitor: true },
      ),
    ).toEqual([{ field: 'exhibit.open_days', message: '展示を選択した場合は出店日の選択が必要' }]);
  });

  it('学生団体は出店日を選んでいれば通し、stage には出店日を求めない', () => {
    expect(
      validateCategoryContents(
        {
          organization_name: '団体',
          categories: ['stage', 'other'],
          stage: fullContent,
          other: { ...fullContent, open_days: ['2026-11-01T12:00:00.000Z'] },
        },
        { isStudentExhibitor: true },
      ),
    ).toEqual([]);
  });

  it('実行委員は draft なら出店日が空でも通す', () => {
    expect(
      validateCategoryContents(
        { categories: ['vendor'], vendor: {}, status: 'draft' },
        { isStudentExhibitor: false },
      ),
    ).toEqual([]);
  });

  it('実行委員でも status が published なら欠落を違反とする', () => {
    expect(
      validateCategoryContents(
        { categories: ['stage'], stage: {}, status: 'published' },
        { isStudentExhibitor: false },
      ),
    ).toEqual([
      { field: 'organization_name', message: '団体名の入力が必要' },
      { field: 'stage.name', message: 'ステージを選択した場合は企画名の入力が必要' },
      { field: 'stage.description', message: 'ステージを選択した場合は紹介文の入力が必要' },
      { field: 'stage.images', message: 'ステージを選択した場合は画像が1枚以上必要' },
    ]);
  });

  it('実行委員が status を draft のまま保存するなら欠落を通す', () => {
    expect(
      validateCategoryContents(
        { categories: ['stage'], stage: {}, status: 'draft' },
        { isStudentExhibitor: false },
      ),
    ).toEqual([]);
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

describe('toJstDateKey / toJstMinuteOfDay', () => {
  it('UTC の 15:00 は JST の翌日 0:00', () => {
    expect(toJstDateKey('2026-09-19T15:00:00.000Z')).toBe('2026-09-20');
    expect(toJstMinuteOfDay('2026-09-19T15:00:00.000Z')).toBe(0);
  });

  it('JST の 0 時直前は前日の 1439 分', () => {
    expect(toJstDateKey('2026-09-19T14:59:00.000Z')).toBe('2026-09-19');
    expect(toJstMinuteOfDay('2026-09-19T14:59:00.000Z')).toBe(1439);
  });

  it('UTC 正午は JST の同じ暦日', () => {
    expect(toJstDateKey('2026-09-19T12:00:00.000Z')).toBe('2026-09-19');
  });

  it('解釈できない値は null', () => {
    for (const v of [undefined, null, '', 'abc', 123]) {
      expect(toJstDateKey(v)).toBeNull();
      expect(toJstMinuteOfDay(v)).toBeNull();
    }
  });
});

describe('toSlotWindow', () => {
  it('3項目がそろえば枠になる', () => {
    expect(
      toSlotWindow({
        event_date: '2026-09-19T12:00:00.000Z',
        start_at: '1970-01-01T01:00:00.000Z',
        end_at: '1970-01-01T02:30:00.000Z',
      }),
    ).toEqual({ dateKey: '2026-09-19', startMinute: 600, endMinute: 690 });
  });

  it('欠損があれば null', () => {
    const base = {
      event_date: '2026-09-19T12:00:00.000Z',
      start_at: '2026-09-19T01:00:00.000Z',
      end_at: '2026-09-19T02:00:00.000Z',
    };
    expect(toSlotWindow({ ...base, event_date: null })).toBeNull();
    expect(toSlotWindow({ ...base, start_at: undefined })).toBeNull();
    expect(toSlotWindow({ ...base, end_at: 'x' })).toBeNull();
  });
});

describe('validateSlotRange', () => {
  const doc = (start: string, end: string) => ({
    event_date: '2026-09-19T12:00:00.000Z',
    start_at: start,
    end_at: end,
  });

  it('日付部分が異なっても JST の分で比較する', () => {
    expect(validateSlotRange(doc('2026-01-01T01:00:00.000Z', '2030-05-05T02:00:00.000Z'))).toEqual([]);
  });

  it('等値を拒否する', () => {
    expect(validateSlotRange(doc('2026-09-19T01:00:00.000Z', '2026-09-20T01:00:00.000Z'))).toEqual([
      { field: 'end_at', message: '終了時刻は開始時刻より後にしてください' },
    ]);
  });

  it('逆転を拒否する', () => {
    expect(validateSlotRange(doc('2026-09-19T02:00:00.000Z', '2026-09-19T01:00:00.000Z'))).toHaveLength(1);
  });

  it('未そろいは判定しない', () => {
    expect(validateSlotRange({ start_at: '2026-09-19T02:00:00.000Z' })).toEqual([]);
  });
});

describe('validateSlotEventDate', () => {
  const doc = { event_date: '2026-09-19T12:00:00.000Z' };

  it('開催日程に含まれる暦日は通す', () => {
    expect(validateSlotEventDate(doc, { eventDayKeys: ['2026-09-19', '2026-09-20'] })).toEqual([]);
  });

  it('含まれない暦日を拒否する', () => {
    expect(validateSlotEventDate(doc, { eventDayKeys: ['2026-09-20'] })).toEqual([
      { field: 'event_date', message: '開催日は祭基本情報の開催日程から選んでください' },
    ]);
  });

  it('開催日程が空なら常に拒否する', () => {
    expect(validateSlotEventDate(doc, { eventDayKeys: [] })).toHaveLength(1);
  });

  it('開催日が未入力なら判定しない', () => {
    expect(validateSlotEventDate({}, { eventDayKeys: [] })).toEqual([]);
  });
});

describe('validatePerformanceOverlap', () => {
  const win = (startMinute: number, endMinute: number, dateKey = '2026-09-19') => ({
    dateKey,
    startMinute,
    endMinute,
  });
  const other = (name: string, startMinute: number, endMinute: number, dateKey = '2026-09-19') => ({
    performanceId: name,
    name,
    ...win(startMinute, endMinute, dateKey),
  });

  it('交差する枠を名前と時刻付きで列挙する', () => {
    const result = validatePerformanceOverlap(win(600, 660), {
      others: [other('軽音部', 630, 700), other('演劇部', 540, 601)],
    });
    expect(result).toEqual([
      {
        field: 'start_at',
        message: '同じステージの出演枠と重なっています: 軽音部 10:30〜11:40、演劇部 09:00〜10:01',
      },
    ]);
  });

  it('接する枠は通す', () => {
    expect(
      validatePerformanceOverlap(win(600, 660), { others: [other('a', 540, 600), other('b', 660, 720)] }),
    ).toEqual([]);
  });

  it('別日の同時刻は通す', () => {
    expect(
      validatePerformanceOverlap(win(600, 660), { others: [other('a', 600, 660, '2026-09-20')] }),
    ).toEqual([]);
  });

  it('対象が枠でなければ判定しない', () => {
    expect(validatePerformanceOverlap(null, { others: [other('a', 0, 1439)] })).toEqual([]);
  });
});
