import { describe, expect, it } from 'vitest';

import { SignageSlides } from './signage-slides';

type F = {
  name: string;
  type: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  validate?: (v: unknown, o: { siblingData: Record<string, unknown> }) => unknown;
  admin?: { condition?: (d: Record<string, unknown>) => boolean; description?: string };
  [key: string]: unknown;
};
const f = (name: string) => SignageSlides.fields.find((x) => (x as F).name === name) as F;
const check = (name: string, value: unknown, siblingData: Record<string, unknown>) =>
  f(name).validate!(value, { siblingData });

describe('SignageSlides', () => {
  it('固定の操作部品を一覧の列・サイドバー・一覧上部の帯に置く', () => {
    const pin = f('pin') as unknown as { type: string; admin: { position: string; components: Record<string, string> } };
    expect(pin.type).toBe('ui');
    expect(pin.admin.position).toBe('sidebar');
    expect(pin.admin.components.Cell).toBe('./components/SignagePinCell.tsx');
    expect(pin.admin.components.Field).toBe('./components/SignagePinButton.tsx');
    expect(SignageSlides.admin?.defaultColumns).toContain('pin');
    expect(SignageSlides.admin?.components?.beforeListTable).toEqual(['./components/SignagePinBanner.tsx']);
  });

  it('slug・管理画面名・ドラッグ並び', () => {
    expect(SignageSlides.slug).toBe('signage_slides');
    expect(SignageSlides.labels).toEqual({ singular: 'サイネージ スライド', plural: 'サイネージ スライド' });
    expect(SignageSlides.orderable).toBe(true);
    expect(f('sort')).toBeUndefined();
    expect(SignageSlides.access).toBeUndefined();
  });

  it('種別は7種', () => {
    const kind = f('kind') as unknown as { options: { value: string }[]; required: boolean };
    expect(kind.required).toBe(true);
    expect(kind.options.map((o) => o.value)).toEqual([
      'sponsors', 'lost_items', 'campus_map', 'image', 'parking', 'timetable', 'layout',
    ]);
  });

  it('表示秒数は既定10・5〜120で、説明に推奨値を書く', () => {
    const d = f('duration_seconds');
    expect(d.defaultValue).toBe(10);
    expect(d.min).toBe(5);
    expect(d.max).toBe(120);
    expect(d.admin?.description).toContain('QR・表・タイムテーブル・落とし物は15秒を推奨');
  });

  it('有効の既定は true、固定表示の項目は持たない', () => {
    expect(f('enabled').defaultValue).toBe(true);
    expect(f('pinned')).toBeUndefined();
  });

  it('レイアウト関連はレイアウト種別のときだけ表示する', () => {
    for (const n of ['layout', 'tone']) {
      const c = f(n).admin!.condition!;
      expect(c({ kind: 'layout' })).toBe(true);
      expect(c({ kind: 'image' })).toBe(false);
    }
  });

  it('サブテキスト・本文枠はそれを使うレイアウトのときだけ表示する', () => {
    const shown = (n: string) =>
      ['title', 'title-content', 'section', 'two-content'].filter((layout) =>
        f(n).admin!.condition!({ kind: 'layout', layout }),
      );
    expect(shown('subtext')).toEqual(['title', 'section']);
    expect(shown('content1')).toEqual(['title-content', 'two-content']);
    expect(shown('content2')).toEqual(['two-content']);
    expect(f('subtext').admin!.condition!({ kind: 'image', layout: 'title' })).toBe(false);
  });

  it('タイトルは全種別で必須・100字まで、サブテキストは複数行200字まで', () => {
    expect(f('title').required).toBe(true);
    expect(f('title').maxLength).toBe(100);
    expect(f('subtext').type).toBe('textarea');
    expect(f('subtext').maxLength).toBe(200);
  });

  it('画像は登録画像・構内マップのときだけ表示する', () => {
    const c = f('image').admin!.condition!;
    expect(c({ kind: 'image' })).toBe(true);
    expect(c({ kind: 'campus_map' })).toBe(true);
    expect(c({ kind: 'layout' })).toBe(false);
    expect(c({ kind: 'parking' })).toBe(false);
  });

  it('本文枠は本文HTMLを併せて持つ', () => {
    const names = SignageSlides.fields.map((x) => (x as F).name);
    expect(names).toContain('content1_html');
    expect(names).toContain('content2_html');
  });

  it('種別に依存する必須は項目ごとの検証で判定する', async () => {
    expect(f('layout').required).toBeFalsy();
    expect(f('image').required).toBeFalsy();
    expect(await check('layout', null, { kind: 'layout' })).not.toBe(true);
    expect(await check('layout', 'section', { kind: 'layout' })).toBe(true);
    expect(await check('layout', null, { kind: 'sponsors' })).toBe(true);
    expect(await check('image', null, { kind: 'image' })).not.toBe(true);
    expect(await check('image', null, { kind: 'campus_map' })).not.toBe(true);
    expect(await check('image', 3, { kind: 'image' })).toBe(true);
    expect(await check('image', null, { kind: 'timetable' })).toBe(true);
  });
});
