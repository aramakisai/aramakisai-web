import { text } from 'payload/shared';
import { describe, expect, it } from 'vitest';

import { StudentExhibitions } from './student-exhibitions';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const links = fieldOf(StudentExhibitions.fields, 'links');
const linkFields = links.fields as readonly unknown[];
const url = fieldOf(linkFields, 'url');
const platform = fieldOf(linkFields, 'platform');
const categories = fieldOf(StudentExhibitions.fields, 'categories');
const organizationName = fieldOf(StudentExhibitions.fields, 'organization_name');
const stageGroup = fieldOf(StudentExhibitions.fields, 'stage');
const owner = fieldOf(StudentExhibitions.fields, 'owner');
const status = fieldOf(StudentExhibitions.fields, 'status');
const performanceSlots = fieldOf(StudentExhibitions.fields, 'performance_slots');
const areaId = fieldOf(StudentExhibitions.fields, 'area_id');
const boothNumber = fieldOf(StudentExhibitions.fields, 'booth_number');
const boothLabel = fieldOf(StudentExhibitions.fields, 'booth_label');

type FieldAccessFn = (args: { req: { user: unknown } }) => boolean;

const asRole = (role: string) => ({ req: { user: { id: 1, role } } });
const callAccess = (f: NamedField, key: 'read' | 'create' | 'update', role: string) =>
  (f.access as Record<string, FieldAccessFn> | undefined)?.[key]?.(asRole(role));

const validateUrl = (value: unknown) =>
  (url.validate as (v: unknown, o: unknown) => true | string)(value, {});

describe('links フィールド', () => {
  it('行の追加・削除・並べ替えができる array として定義される', () => {
    expect(links.type).toBe('array');
  });

  it('サービス種別と URL を 1 組とする', () => {
    expect(platform.type).toBe('select');
    expect(platform.required).toBe(true);
    expect(url.type).toBe('text');
    expect(url.required).toBe(true);
  });

  it('サービス種別の選択肢は 7 種', () => {
    expect((platform.options as { value: string }[]).map((o) => o.value)).toEqual([
      'x',
      'instagram',
      'facebook',
      'youtube',
      'tiktok',
      'line',
      'website',
    ]);
  });

  it('https:// で始まる URL を受け入れる', () => {
    expect(validateUrl('https://example.com/path?a=1')).toBe(true);
  });

  it.each(['http://example.com', 'example.com', 'ftp://example.com', 'https://'])(
    '%s を理由付きで拒否する',
    (value) => {
      expect(typeof validateUrl(value)).toBe('string');
    },
  );

  it('空の URL を拒否する', () => {
    expect(typeof validateUrl(undefined)).toBe('string');
    expect(typeof validateUrl('')).toBe('string');
  });
});

describe('categories フィールド', () => {
  it('4 択の複数選択かつ 1 つ以上必須', () => {
    expect(categories.type).toBe('select');
    expect(categories.hasMany).toBe(true);
    expect(categories.required).toBe(true);
    expect((categories.options as { value: string }[]).map((o) => o.value)).toEqual([
      'stage',
      'exhibit',
      'vendor',
      'other',
    ]);
  });

  it('読みは制限せず、書きは実行委員だけに許可する', () => {
    expect(callAccess(categories, 'read', 'student_exhibitor')).toBeUndefined();
    expect(callAccess(categories, 'create', 'executive')).toBe(true);
    expect(callAccess(categories, 'create', 'student_exhibitor')).toBe(false);
    expect(callAccess(categories, 'update', 'executive')).toBe(true);
    expect(callAccess(categories, 'update', 'student_exhibitor')).toBe(false);
  });
});

describe('organization_name フィールド', () => {
  it('フィールド定義としては必須にしない (必須チェックは学生団体の保存だけに課す)', () => {
    expect(organizationName.type).toBe('text');
    expect(organizationName.required).toBeFalsy();
  });
});

describe('カテゴリ別企画内容欄 (stage グループを例に検証)', () => {
  const stageFields = stageGroup.fields as readonly unknown[];

  it('企画名 (任意・最大 255 文字) と紹介文と画像を持つ', () => {
    const name = fieldOf(stageFields, 'name');
    const description = fieldOf(stageFields, 'description');
    const images = fieldOf(stageFields, 'images');
    expect(stageGroup.type).toBe('group');
    expect(name.type).toBe('text');
    expect(name.required).toBeFalsy();
    expect(name.maxLength).toBe(255);
    expect(description.type).toBe('textarea');
    expect(images.type).toBe('upload');
    expect(images.hasMany).toBe(true);
  });

  it('カテゴリにステージを含むときだけ表示する', () => {
    const condition = (stageGroup.admin as { condition: (data: unknown) => boolean }).condition;
    expect(condition({ categories: ['stage'] })).toBe(true);
    expect(condition({ categories: ['exhibit', 'stage'] })).toBe(true);
    expect(condition({ categories: ['exhibit'] })).toBe(false);
    expect(condition({})).toBe(false);
  });

  it('一括編集の対象から除外する (admin.condition は複数レコード分の categories を評価できないため)', () => {
    expect((stageGroup.admin as { disableBulkEdit?: boolean }).disableBulkEdit).toBe(true);
  });

  it('画像の説明文はサムネイル・上限の案内にする', () => {
    const images = fieldOf(stageGroup.fields as readonly unknown[], 'images');
    expect((images.admin as { description?: string }).description).toBe(
      '最大5枚まで。1枚目がサムネイルとして表示されます。',
    );
  });
});

describe('owner フィールド', () => {
  it('管理画面に表示し、選択肢を学生団体ロールに絞る', () => {
    expect(owner.admin).toBeUndefined();
    expect(owner.filterOptions).toEqual({ role: { equals: 'student_exhibitor' } });
  });

  it('読み書きとも実行委員だけに許可する', () => {
    expect(callAccess(owner, 'read', 'executive')).toBe(true);
    expect(callAccess(owner, 'read', 'student_exhibitor')).toBe(false);
    expect(callAccess(owner, 'create', 'student_exhibitor')).toBe(false);
    expect(callAccess(owner, 'update', 'student_exhibitor')).toBe(false);
  });
});

describe('割当・公開状態フィールド', () => {
  it('公開状態はサイドバーに置き、説明文を付ける', () => {
    expect((status.admin as { position?: string }).position).toBe('sidebar');
    expect((status.admin as { description?: string }).description).toBe(
      '公開は実行委員が行い、公開後は編集できません。',
    );
  });

  it.each([
    ['status', status],
    ['area_id', areaId],
    ['booth_number', boothNumber],
    ['booth_label', boothLabel],
  ] as const)('%s は実行委員だけが書ける', (_name, field) => {
    expect(callAccess(field, 'create', 'executive')).toBe(true);
    expect(callAccess(field, 'create', 'student_exhibitor')).toBe(false);
    expect(callAccess(field, 'update', 'executive')).toBe(true);
    expect(callAccess(field, 'update', 'student_exhibitor')).toBe(false);
  });

  it('説明文をシステム用語なしの案内にする', () => {
    expect((performanceSlots.admin as { description?: string }).description).toBe('ステージ出演枠');
    expect((areaId.admin as { description?: string }).description).toBe('割り当てられた出店エリア');
    expect((boothNumber.admin as { description?: string }).description).toBe(
      '割り当てられた出店グループ内の番号もしくは教室番号',
    );
    expect((boothLabel.admin as { description?: string }).description).toBe(
      '割り当てられた出店エリア名',
    );
  });
});

describe('links.url の説明文', () => {
  it('入力形式の案内を付ける (エラーメッセージとは別の文言)', () => {
    expect((url.admin as { description?: string }).description).toBe(
      'https://から始まるURLを入力してください。',
    );
  });
});

describe('一覧の既定列', () => {
  it('団体名・カテゴリ・公開状態にする', () => {
    expect((StudentExhibitions.admin as { defaultColumns?: string[] }).defaultColumns).toEqual([
      'organization_name',
      'categories',
      'status',
    ]);
  });
});

describe('hooks の結線', () => {
  it('beforeOperation に guardPublishedExhibition (M-E01) を置く', () => {
    expect(StudentExhibitions.hooks?.beforeOperation).toHaveLength(1);
  });

  it('beforeValidate に owner・画像の検証を含む', () => {
    expect(StudentExhibitions.hooks?.beforeValidate).toHaveLength(5);
  });

  it('afterChange/afterDelete にメディア使用状況の再計算 (syncMediaPublication) を置く', () => {
    expect(StudentExhibitions.hooks?.afterChange).toHaveLength(1);
    expect(StudentExhibitions.hooks?.afterDelete).toHaveLength(1);
  });
});

describe('menu / open_days フィールド', () => {
  const vendorGroup = fieldOf(StudentExhibitions.fields, 'vendor');
const vendorFields = vendorGroup.fields as readonly unknown[];
const menu = fieldOf(vendorFields, 'menu');
  const menuFields = menu.fields as readonly unknown[];
  const name = fieldOf(menuFields, 'name');
  const price = fieldOf(menuFields, 'price');
  const openDays = fieldOf(StudentExhibitions.fields, 'open_days');
  const normalize = (v: unknown) =>
    (price.hooks as { beforeValidate: ((a: { value: unknown }) => unknown)[] }).beforeValidate[0]({
      value: v,
    });

  it('menu は品名(必須)と価格を持つ array で、価格が空の行は非表示と説明する', () => {
    expect(menu.type).toBe('array');
    expect(menu.required).toBeUndefined();
    expect((menu.admin as { description: string }).description).toBe(
      '価格が空の行はサイトに表示されません。',
    );
    expect(name.type).toBe('text');
    expect(name.required).toBe(true);
    expect(price.type).toBe('text');
    expect(price.required).toBeUndefined();
  });

  it('menu は出店グループの最後だけに置き、他カテゴリのグループとトップレベルには置かない', () => {
    expect((vendorFields.at(-1) as NamedField).name).toBe('menu');
    for (const key of ['stage', 'exhibit', 'other']) {
      const fields = fieldOf(StudentExhibitions.fields, key).fields as readonly NamedField[];
      expect(fields.some((f) => f.name === 'menu')).toBe(false);
    }
    expect(StudentExhibitions.fields.some((f) => (f as NamedField).name === 'menu')).toBe(false);
  });

  it('open_days は text の hasMany で EventDayCheckboxes を入力部品にする', () => {
    expect(openDays.type).toBe('text');
    expect(openDays.hasMany).toBe(true);
    expect(openDays.required).toBe(true);
    expect((openDays.admin as { components: { Field: string } }).components.Field).toBe(
      './components/EventDayCheckboxes.tsx',
    );
  });

  it('新フィールドにフィールド単位のアクセス制御を付けない', () => {
    expect(menu.access).toBeUndefined();
    expect(openDays.access).toBeUndefined();
  });

  it('価格は空・空白のみだけ null にし、それ以外はそのまま返す', () => {
    expect(normalize('')).toBeNull();
    expect(normalize('  ')).toBeNull();
    expect(normalize('¥300')).toBe('¥300');
    expect(normalize(' ¥300 ')).toBe(' ¥300 ');
    expect(normalize(null)).toBeNull();
    expect(normalize(undefined)).toBeUndefined();
  });
});

describe('open_days フィールド', () => {
  const openDays = fieldOf(StudentExhibitions.fields, 'open_days');
  const validate = (value: unknown) =>
    text(value as unknown as string, {
      ...(openDays as object),
      req: { t: (k: string) => k, payload: { config: {} } },
    } as unknown as Parameters<typeof text>[1]);

  it('必須項目として定義される', () => {
    expect(openDays.required).toBe(true);
  });

  it.each([[[]], [undefined], [null]])('%j はバリデーションで弾かれる', (v) => {
    expect(validate(v)).not.toBe(true);
  });

  it('1 日以上選ぶと受け入れる', () => {
    expect(validate(['2026-11-01T12:00:00.000Z'])).toBe(true);
  });
});
