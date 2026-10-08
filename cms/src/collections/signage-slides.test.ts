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
  it('slug・管理画面名・並び', () => {
    expect(SignageSlides.slug).toBe('signage_slides');
    expect(SignageSlides.labels).toEqual({ singular: 'サイネージ スライド', plural: 'サイネージ スライド' });
    expect(SignageSlides.defaultSort).toBe('sort');
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
    const d = f('duration_sec');
    expect(d.defaultValue).toBe(10);
    expect(d.min).toBe(5);
    expect(d.max).toBe(120);
    expect(d.admin?.description).toContain('QR・表・タイムテーブル・落とし物は15秒を推奨');
  });

  it('固定表示の説明に先頭1枚だけ表示と書く', () => {
    expect(f('pinned').admin?.description).toContain('先頭の1枚だけが表示される');
  });

  it('有効の既定は true、固定表示の既定は false', () => {
    expect(f('enabled').defaultValue).toBe(true);
    expect(f('pinned').defaultValue).toBe(false);
  });

  it('レイアウト関連はレイアウト種別のときだけ表示する', () => {
    for (const n of ['layout', 'tone', 'subtext', 'content1', 'content2']) {
      const c = f(n).admin!.condition!;
      expect(c({ kind: 'layout' })).toBe(true);
      expect(c({ kind: 'image' })).toBe(false);
    }
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
    expect(f('title').required).toBeFalsy();
    expect(f('layout').required).toBeFalsy();
    expect(f('image').required).toBeFalsy();
    expect(await check('title', '', { kind: 'layout' })).not.toBe(true);
    expect(await check('title', 'x', { kind: 'layout' })).toBe(true);
    expect(await check('title', '', { kind: 'parking' })).toBe(true);
    expect(await check('layout', null, { kind: 'layout' })).not.toBe(true);
    expect(await check('layout', 'section', { kind: 'layout' })).toBe(true);
    expect(await check('layout', null, { kind: 'sponsors' })).toBe(true);
    expect(await check('image', null, { kind: 'image' })).not.toBe(true);
    expect(await check('image', null, { kind: 'campus_map' })).not.toBe(true);
    expect(await check('image', 3, { kind: 'image' })).toBe(true);
    expect(await check('image', null, { kind: 'timetable' })).toBe(true);
  });
});
