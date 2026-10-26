import { describe, expect, it } from 'vitest';

import { Navigation } from './navigation';

type F = { name: string; type: string; minRows?: number; required?: boolean; labels?: unknown; admin?: Record<string, unknown>; options?: { label: string; value: string }[]; fields?: F[]; defaultValue?: unknown };
type Tab = { name: string; label: string; fields: F[] };
const tabs = (Navigation.fields[0] as unknown as { tabs: Tab[] }).tabs;
const names = (fs: F[]) => fs.map((f) => f.name);
type Fn = (...a: never[]) => unknown;
const field = (fs: F[], name: string) =>
  fs.find((f) => f.name === name) as unknown as {
    validate: Fn; admin: { condition: Fn }; hooks: { beforeChange: Fn[] };
  };
const validate = (fs: F[], name: string, value: unknown, siblingData: object) =>
  field(fs, name).validate(value as never, { siblingData } as never);
const parentFields = () => tabs[0].fields[0].fields!;
const childFields = () => parentFields().find((f) => f.name === 'children')!.fields!;

describe('Navigation', () => {
  it('slug とラベル', () => {
    expect(Navigation.slug).toBe('navigation');
    expect(Navigation.label).toBe('ナビゲーション');
  });

  it('タブの順序は 開催中 → 開催前', () => {
    expect(tabs.map((t) => [t.name, t.label])).toEqual([
      ['live', '開催中'],
      ['pre_event', '開催前'],
    ]);
  });

  it.each([0, 1])('タブ %i は items を 1 件以上必須とし、項目名と順序が固定されている', (i) => {
    const items = tabs[i].fields[0];
    expect(items).toMatchObject({ name: 'items', type: 'array', minRows: 1, required: true });
    expect(names(items.fields!)).toEqual(['link_type', 'page', 'path', 'label', 'color', 'footer_column', 'children']);
    const children = items.fields!.find((f) => f.name === 'children')!;
    expect(names(children.fields!)).toEqual(['link_type', 'page', 'path', 'label', 'hide_in_footer']);
  });

  it('リンク先の選択肢は親が 3 種、子が 2 種で既定は固定ページ', () => {
    const vals = (fs: F[]) => field0(fs).options!.map((o) => o.value);
    const field0 = (fs: F[]) => fs.find((f) => f.name === 'link_type')!;
    expect(vals(parentFields())).toEqual(['page', 'path', 'group']);
    expect(vals(childFields())).toEqual(['page', 'path']);
    expect(field0(parentFields())).toMatchObject({ type: 'radio', required: true, defaultValue: 'page' });
  });

  it('種別ごとの必須検証', () => {
    const p = parentFields();
    expect(validate(p, 'page', null, { link_type: 'page' })).not.toBe(true);
    expect(validate(p, 'page', 1, { link_type: 'page' })).toBe(true);
    expect(validate(p, 'path', '', { link_type: 'path' })).not.toBe(true);
    expect(validate(p, 'label', '', { link_type: 'path' })).not.toBe(true);
    expect(validate(p, 'label', '', { link_type: 'group' })).not.toBe(true);
    expect(validate(p, 'label', '', { link_type: 'page' })).toBe(true);
    expect(validate(p, 'children', [], { link_type: 'group' })).not.toBe(true);
    expect(validate(p, 'children', [{}], { link_type: 'group' })).toBe(true);
    expect(validate(p, 'children', [], { link_type: 'page' })).toBe(true);
    expect(validate(childFields(), 'label', '', { link_type: 'group' })).toBe(true);
  });

  it('欄の表示条件は種別で決まる', () => {
    const p = parentFields();
    const show = (n: string, t: string) => field(p, n).admin.condition({} as never, { link_type: t } as never);
    expect([show('page', 'page'), show('page', 'path')]).toEqual([true, false]);
    expect([show('path', 'path'), show('path', 'group')]).toEqual([true, false]);
    expect([show('label', 'path'), show('label', 'group'), show('label', 'page')]).toEqual([true, true, false]);
    expect([show('children', 'group'), show('children', 'path')]).toEqual([true, false]);
  });

  it('隠れた欄の値は保存時に消す', () => {
    const p = parentFields();
    const run = (n: string, t: string, value: unknown) =>
      field(p, n).hooks.beforeChange[0]({ value, siblingData: { link_type: t } } as never);
    expect(run('path', 'page', '/x')).toBeNull();
    expect(run('path', 'path', '/x')).toBe('/x');
    expect(run('page', 'path', 1)).toBeNull();
    expect(run('label', 'page', 'a')).toBeNull();
    expect(run('label', 'group', 'a')).toBe('a');
    expect(run('children', 'page', [{}])).toEqual([]);
    expect(run('children', 'group', [{}])).toEqual([{}]);
  });

  it.each([0, 1])('タブ %i の配列は日本語ラベルで初期折りたたみ・行見出し付き', (i) => {
    const items = tabs[i].fields[0];
    const children = items.fields!.find((f) => f.name === 'children')!;
    expect(items.labels).toEqual({ singular: '項目', plural: '項目' });
    expect(children.labels).toEqual({ singular: '子項目', plural: '子項目' });
    for (const a of [items, children]) {
      expect(a.admin).toMatchObject({ initCollapsed: true, components: { RowLabel: './components/NavigationRowLabel.tsx' } });
    }
  });

  it('色の選択肢は現在使っている項目名で示し、値は変えない', () => {
    const color = tabs[0].fields[0].fields!.find((f) => f.name === 'color')!;
    expect(color.options!.map((o) => o.value)).toEqual([
      'primary', 'secondary', 'info', 'warning', 'success', 'accent', 'accent-alt',
    ]);
    expect(color.options!.map((o) => o.label)).toEqual([
      '企画一覧・トピック', '構内マップ', 'タイムテーブル', 'お知らせ',
      'ご案内', '協賛', '荒牧祭について',
    ]);
  });
});
