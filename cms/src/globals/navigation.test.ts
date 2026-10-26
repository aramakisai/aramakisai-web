import { describe, expect, it } from 'vitest';

import { Navigation, validateChildLink, validateParentLink } from './navigation';

type F = { name: string; type: string; minRows?: number; required?: boolean; labels?: unknown; admin?: Record<string, unknown>; options?: { label: string; value: string }[]; fields?: F[]; defaultValue?: unknown };
type Tab = { name: string; label: string; fields: F[] };
const tabs = (Navigation.fields[0] as unknown as { tabs: Tab[] }).tabs;
const names = (fs: F[]) => fs.map((f) => f.name);
const run = (v: typeof validateChildLink, siblingData: object) =>
  v(undefined, { siblingData } as never);

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
    expect(names(items.fields!)).toEqual(['page', 'path', 'label', 'color', 'footer_column', 'children']);
    const children = items.fields!.find((f) => f.name === 'children')!;
    expect(names(children.fields!)).toEqual(['page', 'path', 'label', 'hide_in_footer']);
  });

  it('子項目は page か path が必須', () => {
    expect(run(validateChildLink, {})).not.toBe(true);
    expect(run(validateChildLink, { page: 1 })).toBe(true);
    expect(run(validateChildLink, { path: '/faq' })).toBe(true);
  });

  it('親項目はリンクか子項目のどちらか一方', () => {
    expect(run(validateParentLink, {})).not.toBe(true);
    expect(run(validateParentLink, { path: '/map' })).toBe(true);
    expect(run(validateParentLink, { children: [{}] })).toBe(true);
    expect(run(validateParentLink, { page: 1, children: [{}] })).not.toBe(true);
    expect(run(validateParentLink, { path: '/map', children: [{}] })).not.toBe(true);
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

  it('page と path は同時に指定できない', () => {
    expect(run(validateChildLink, { page: 1, path: '/faq' })).not.toBe(true);
    expect(run(validateParentLink, { page: 1, path: '/faq' })).not.toBe(true);
  });

  it('色の選択肢は現在使っている項目名で示し、値は変えない', () => {
    const color = tabs[0].fields[0].fields!.find((f) => f.name === 'color')!;
    expect(color.options!.map((o) => o.value)).toEqual([
      'primary', 'secondary', 'info', 'warning', 'success', 'accent', 'accent-alt',
    ]);
    expect(color.options!.map((o) => o.label)).toEqual([
      '企画一覧・トピックと同じ', '構内マップと同じ', 'タイムテーブルと同じ', 'お知らせと同じ',
      'ご案内と同じ', '協賛と同じ', '荒牧祭についてと同じ',
    ]);
  });
});
