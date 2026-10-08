import { describe, expect, it } from 'vitest';

import { LostItems } from './lost-items';
import { Telops } from './telops';

type F = {
  name: string;
  type: string;
  maxLength?: number;
  required?: boolean;
  defaultValue?: unknown;
  validate?: (v: unknown, o: { siblingData: Record<string, unknown> }) => unknown;
  admin?: { condition?: (d: Record<string, unknown>) => boolean };
  [key: string]: unknown;
};
const f = (c: { fields: unknown[] }, name: string) => c.fields.find((x) => (x as F).name === name) as F;

describe('Telops', () => {
  it('slug・並び・access は登録口任せ', () => {
    expect(Telops.slug).toBe('telops');
    expect(Telops.defaultSort).toBe('sort');
    expect(Telops.labels).toEqual({ singular: 'サイネージ テロップ', plural: 'サイネージ テロップ' });
    expect(Telops.access).toBeUndefined();
  });

  it('対象区分は来場者向け/参加団体向け', () => {
    const a = f(Telops, 'audience') as unknown as { options: { value: string }[]; required: boolean };
    expect(a.required).toBe(true);
    expect(a.options.map((o) => o.value)).toEqual(['visitor', 'group']);
  });

  it('文面は200字まで必須、対象は20字まで', () => {
    expect(f(Telops, 'body').maxLength).toBe(200);
    expect(f(Telops, 'body').required).toBe(true);
    expect(f(Telops, 'target').maxLength).toBe(20);
  });

  it('対象は参加団体向けのときだけ表示する', () => {
    const c = f(Telops, 'target').admin!.condition!;
    expect(c({ audience: 'group' })).toBe(true);
    expect(c({ audience: 'visitor' })).toBe(false);
  });

  it('参加団体向けで対象が空だと保存できない', async () => {
    const v = f(Telops, 'target').validate!;
    expect(await v('', { siblingData: { audience: 'group' } })).not.toBe(true);
    expect(await v(null, { siblingData: { audience: 'group' } })).not.toBe(true);
    expect(await v('  ', { siblingData: { audience: 'group' } })).not.toBe(true);
    expect(await v('出店団体へ', { siblingData: { audience: 'group' } })).toBe(true);
    expect(await v('', { siblingData: { audience: 'visitor' } })).toBe(true);
  });

  it('有効の既定は true', () => {
    expect(f(Telops, 'enabled').defaultValue).toBe(true);
  });
});

describe('LostItems', () => {
  it('slug・拾得時刻の新しい順', () => {
    expect(LostItems.slug).toBe('lost_items');
    expect(LostItems.defaultSort).toBe('-found_at');
    expect(LostItems.access).toBeUndefined();
  });

  it('品名は50字・拾得場所は30字まで', () => {
    expect(f(LostItems, 'name').maxLength).toBe(50);
    expect(f(LostItems, 'found_place').maxLength).toBe(30);
  });

  it('品名・拾得場所・拾得時刻は必須、写真は media、返却済みは既定 false', () => {
    expect(f(LostItems, 'name').required).toBe(true);
    expect(f(LostItems, 'found_place').required).toBe(true);
    const at = f(LostItems, 'found_at');
    expect(at.type).toBe('date');
    expect(at.required).toBe(true);
    expect(f(LostItems, 'photo').relationTo).toBe('media');
    expect(f(LostItems, 'returned').defaultValue).toBe(false);
  });
});
