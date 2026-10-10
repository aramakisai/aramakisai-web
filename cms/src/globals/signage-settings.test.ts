import { describe, expect, it, vi } from 'vitest';

import { SignageSettings } from './signage-settings';

type F = { name: string; type: string; relationTo?: string; hasMany?: boolean; required?: boolean; filterOptions?: unknown; admin?: { description?: string } };

describe('SignageSettings', () => {
  const fields = SignageSettings.fields as F[];
  const pinned = fields.find((x) => x.name === 'pinned_slide')!;

  it('slug とラベル', () => {
    expect(SignageSettings.slug).toBe('signage_settings');
    expect(SignageSettings.label).toBe('サイネージ設定');
  });

  it('ナビには出さず、操作はスライド画面で行う', () => {
    expect(SignageSettings.admin?.hidden).toBe(true);
  });

  it('固定表示するスライドは任意の単一参照で、表示対象のスライドだけ選べる', async () => {
    expect(fields).toHaveLength(1);
    expect(pinned.type).toBe('relationship');
    expect(pinned.relationTo).toBe('signage_slides');
    expect(pinned.hasMany).toBeFalsy();
    expect(pinned.required).toBeFalsy();
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ docs: [{ id: 10, is_all: true, visible: false, slides: [] }, { id: 11, visible: true, slides: [2] }] });
    const opts = pinned.filterOptions as (a: { req: unknown }) => Promise<unknown>;
    expect(await opts({ req: { payload: { find } } })).toEqual({ id: { in: [2] } });
    expect(pinned.admin?.description).toBe(
      '選んだスライドだけを全画面に表示し続けます。空にすると通常の巡回に戻ります。',
    );
  });
});
