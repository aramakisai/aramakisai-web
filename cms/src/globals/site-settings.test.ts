import { describe, expect, it } from 'vitest';

import { SiteSettings } from './site-settings';

type Tab = { label: string; fields: { name: string }[] };
const tabs = (SiteSettings.fields[0] as unknown as { tabs: Tab[] }).tabs;
const names = (t: Tab) => t.fields.map((f) => f.name);

describe('SiteSettings', () => {
  it('slug とラベル', () => {
    expect(SiteSettings.slug).toBe('site_settings');
    expect(SiteSettings.label).toBe('サイト設定');
  });

  it('名前なしの tabs 1 つで、タブの順序が固定されている', () => {
    expect(SiteSettings.fields).toHaveLength(1);
    expect(tabs.map((t) => t.label)).toEqual(['基本', 'トップページ', 'About', '連絡先', 'SEO']);
  });

  it('各タブの項目名と順序', () => {
    expect(tabs.map(names)).toEqual([
      ['name', 'event_days', 'theme_word', 'theme_description', 'theme_description_html'],
      ['hero_images'],
      ['overview', 'overview_html'],
      ['contact_form_url', 'exhibitor_contact_url', 'sns_links'],
      ['og_image'],
    ]);
  });

  it('削除項目を持たない', () => {
    const all = tabs.flatMap(names);
    for (const n of [
      'parking_map', 'hero_image', 'theme_image', 'hero_message', 'hero_message_html', 'site_title',
      'meta_description', 'venue_name', 'venue_address', 'campus_map_url', 'access_summary',
    ]) {
      expect(all).not.toContain(n);
    }
  });

  it('hero_images は複数の media', () => {
    const f = tabs[1].fields[0] as unknown as { type: string; hasMany: boolean; relationTo: string };
    expect(f).toMatchObject({ type: 'upload', hasMany: true, relationTo: 'media' });
  });

  it('exhibitor_contact_url は https のみ許可する', () => {
    const f = tabs[3].fields[1] as unknown as { validate: (v: unknown) => true | string };
    expect(f.validate(undefined)).toBe(true);
    expect(f.validate('https://aramakisai.com/c')).toBe(true);
    expect(f.validate('http://aramakisai.com/c')).not.toBe(true);
  });

  it('保存時にサイネージへ通知するフックが付いている', () => {
    expect(SiteSettings.hooks?.afterChange).toHaveLength(1);
  });
});
