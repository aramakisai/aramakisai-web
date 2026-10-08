import { describe, expect, it } from 'vitest';

import { SignageSettings } from './signage-settings';

type F = { name: string; type: string; relationTo?: string; hasMany?: boolean; required?: boolean; filterOptions?: unknown; admin?: { description?: string } };

describe('SignageSettings', () => {
  const fields = SignageSettings.fields as F[];
  const pinned = fields.find((x) => x.name === 'pinned_slide')!;

  it('slug とラベル', () => {
    expect(SignageSettings.slug).toBe('signage_settings');
    expect(SignageSettings.label).toBe('サイネージ設定');
  });

  it('固定表示するスライドは任意の単一参照で、有効なスライドだけ選べる', () => {
    expect(fields).toHaveLength(1);
    expect(pinned.type).toBe('relationship');
    expect(pinned.relationTo).toBe('signage_slides');
    expect(pinned.hasMany).toBeFalsy();
    expect(pinned.required).toBeFalsy();
    expect(pinned.filterOptions).toEqual({ enabled: { equals: true } });
    expect(pinned.admin?.description).toBe(
      '選んだスライドだけを全画面に表示し続けます。空にすると通常の巡回に戻ります。',
    );
  });
});
