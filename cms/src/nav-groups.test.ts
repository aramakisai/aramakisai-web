import { describe, expect, it } from 'vitest';

import { collections } from './collections';
import { globals } from './globals';
import { NAV_GROUPS } from './nav-groups';

const HIDDEN = ['signage_settings'];

describe('NAV_GROUPS', () => {
  it('非表示の定義を除く全 slug を分類する', () => {
    const slugs = [...collections, ...globals].map((c) => c.slug).filter((s) => !HIDDEN.includes(s));
    expect(Object.keys(NAV_GROUPS).sort()).toEqual([...slugs].sort());
  });

  it('非表示の定義は分類しない', () => {
    for (const slug of HIDDEN) expect(NAV_GROUPS[slug]).toBeUndefined();
  });

  it('登録口が admin.group を付け、表示名は変えない', () => {
    for (const def of [...collections, ...globals]) {
      expect(def.admin?.group).toBe(NAV_GROUPS[def.slug]);
    }
    expect(collections.find((c) => c.slug === 'sponsors')!.labels).toEqual({
      singular: '協賛・出店',
      plural: '協賛・出店',
    });
  });

  it('分類が要件の表どおり', () => {
    const by = (g: string) => Object.keys(NAV_GROUPS).filter((s) => NAV_GROUPS[s] === g);
    expect(by('サイト掲載')).toEqual(['announcements', 'topics', 'pages', 'faq_items', 'sponsors']);
    expect(by('企画・ステージ')).toEqual(['student_exhibitions', 'stages', 'performance_slots']);
    expect(by('会場・マップ')).toEqual(['map_areas', 'map_points', 'parking_lots']);
    expect(by('当日運営')).toEqual(['parking_statuses', 'lost_items']);
    expect(by('サイネージ')).toEqual(['signage_slides', 'signage_groups', 'telops']);
    expect(by('管理')).toEqual(['site_settings', 'navigation', 'users', 'media']);
  });
});
