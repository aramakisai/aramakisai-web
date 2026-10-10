import { describe, expect, it, vi } from 'vitest';

import { SignageGroups } from './signage-groups';

type F = {
  name: string;
  type: string;
  relationTo?: string;
  hasMany?: boolean;
  required?: boolean;
  maxLength?: number;
  defaultValue?: unknown;
  access?: { create?: () => boolean; update?: (a: { doc?: { is_all?: boolean } }) => boolean };
  admin?: { hidden?: boolean; condition?: (d: Record<string, unknown>) => boolean; components?: Record<string, string> };
};
const f = (name: string) => SignageGroups.fields.find((x) => (x as F).name === name) as F;

describe('SignageGroups', () => {
  it('slug・管理画面名・ナビから外す(admin.hidden は使わない)', () => {
    expect(SignageGroups.slug).toBe('signage_groups');
    expect(SignageGroups.labels).toEqual({ singular: 'サイネージ グループ', plural: 'サイネージ グループ' });
    expect(SignageGroups.admin?.useAsTitle).toBe('name');
    expect(SignageGroups.admin?.group).toBe(false);
    expect(SignageGroups.admin?.hidden).toBeUndefined();
    expect(SignageGroups.access).toBeUndefined();
  });

  it('名前は必須で30字まで、表示の既定は表示', () => {
    expect(f('name').type).toBe('text');
    expect(f('name').required).toBe(true);
    expect(f('name').maxLength).toBe(30);
    expect(f('visible').type).toBe('checkbox');
    expect(f('visible').defaultValue).toBe(true);
  });

  it('所属スライドは signage_slides への hasMany で、左右リストの部品を使う', () => {
    const s = f('slides');
    expect(s.type).toBe('relationship');
    expect(s.relationTo).toBe('signage_slides');
    expect(s.hasMany).toBe(true);
    expect(s.admin?.components?.Field).toBe('./components/SignageGroupSlidesField.tsx');
  });

  it('「すべて」では所属を書き込めず編集画面にも出さない', () => {
    const s = f('slides');
    expect(s.access!.update!({ doc: { is_all: true } })).toBe(false);
    expect(s.access!.update!({ doc: { is_all: false } })).toBe(true);
    expect(s.access!.update!({})).toBe(true);
    expect(s.admin!.condition!({ is_all: true })).toBe(false);
    expect(s.admin!.condition!({ is_all: false })).toBe(true);
  });

  it('is_all は作成も更新もできず、管理画面でも隠す', () => {
    const a = f('is_all');
    expect(a.type).toBe('checkbox');
    expect(a.defaultValue).toBe(false);
    expect(a.access!.create!()).toBe(false);
    expect(a.access!.update!({})).toBe(false);
    expect(a.admin?.hidden).toBe(true);
  });

  it('削除の拒否は access で行い、beforeDelete は持たない', () => {
    expect(SignageGroups.hooks?.beforeDelete).toBeUndefined();
  });

  it('固定の自動解除を afterChange・afterDelete に持つ', () => {
    expect(SignageGroups.hooks?.afterChange).toHaveLength(1);
    expect(SignageGroups.hooks?.afterDelete).toHaveLength(1);
  });
});
