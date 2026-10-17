import { describe, expect, it } from 'vitest';

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
  fields?: F[];
  filterOptions?: (a: { data: Record<string, unknown> }) => unknown;
  admin?: {
    hidden?: boolean;
    condition?: (d: Record<string, unknown>) => boolean;
    components?: { Field?: { path: string; clientProps: Record<string, string> } };
  };
};
const f = (name: string) => SignageGroups.fields.find((x) => (x as F).name === name) as F;

describe('SignageGroups', () => {
  it('slug・管理画面名・ナビに出す(group 指定なし、admin.hidden は使わない)', () => {
    expect(SignageGroups.slug).toBe('signage_groups');
    expect(SignageGroups.labels).toEqual({ singular: 'サイネージ グループ', plural: 'サイネージ グループ' });
    expect(SignageGroups.admin?.useAsTitle).toBe('name');
    expect(SignageGroups.admin?.group).toBeUndefined();
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
    expect(s.admin?.components?.Field).toEqual({
      path: './components/SignageGroupMembersField.tsx',
      clientProps: { collection: 'signage_slides', titleField: 'title', groupField: 'slides' },
    });
  });

  it('所属テロップは telops への hasMany で、スライドと同じ部品を使う', () => {
    const t = f('telops');
    expect(t.type).toBe('relationship');
    expect(t.relationTo).toBe('telops');
    expect(t.hasMany).toBe(true);
    expect(t.admin?.components?.Field).toEqual({
      path: './components/SignageGroupMembersField.tsx',
      clientProps: { collection: 'telops', titleField: 'body', groupField: 'telops' },
    });
  });

  it.each(['slides', 'telops'])('「すべて」では%sの所属を書き込めず編集画面にも出さない', (name) => {
    const s = f(name);
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
    expect(SignageGroups.hooks?.afterChange).toHaveLength(2);
    expect(SignageGroups.hooks?.afterDelete).toHaveLength(2);
  });

  it('is_quake は作成も更新もできず、管理画面でも隠す', () => {
    const a = f('is_quake');
    expect(a.type).toBe('checkbox');
    expect(a.defaultValue).toBe(false);
    expect(a.access!.create!()).toBe(false);
    expect(a.access!.update!({})).toBe(false);
    expect(a.admin?.hidden).toBe(true);
  });

  it('緊急地震速報のグループでだけ4つの段階のスライドを出し、表示の切り替えを隠す', () => {
    const q = f('quake_slides');
    expect(q.type).toBe('group');
    expect(q.admin!.condition!({ is_quake: true })).toBe(true);
    expect(q.admin!.condition!({ is_quake: false })).toBe(false);
    expect(q.fields!.map((x) => x.name)).toEqual(['warning', 'calm', 'evacuate', 'cancelled']);
    expect(q.fields!.every((x) => x.type === 'relationship' && x.relationTo === 'signage_slides' && !x.required)).toBe(true);
    expect(f('visible').admin!.condition!({ is_quake: true })).toBe(false);
    expect(f('visible').admin!.condition!({ is_quake: false })).toBe(true);
  });

  it('段階のスライドの選択肢は、そのグループの所属のスライドに限る', () => {
    const opts = f('quake_slides').fields![0].filterOptions!;
    expect(opts({ data: { slides: [3, { id: 4 }] } })).toEqual({ id: { in: [3, 4] } });
    expect(opts({ data: { slides: [] } })).toEqual({ id: { exists: false } });
  });
});
