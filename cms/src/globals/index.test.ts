import { describe, expect, it } from 'vitest';

import { globals } from './index';

type Hidden = (a: { user: unknown }) => boolean;
const hiddenFor = (slug: string) => globals.find((g) => g.slug === slug)!.admin!.hidden as Hidden;

describe('globals 登録口', () => {
  it('admin.hidden: true のグローバルは実行委員にも隠す', () => {
    expect(hiddenFor('signage_settings')({ user: { id: 1, role: 'executive' } })).toBe(true);
  });
  it('サイト設定は実行委員に見せる', () => {
    expect(hiddenFor('site_settings')({ user: { id: 1, role: 'executive' } })).toBe(false);
  });
  it('祭基本情報・トップページは管理画面で隠す', () => {
    for (const slug of ['festival_meta', 'page_home']) {
      expect(hiddenFor(slug)({ user: { id: 1, role: 'executive' } })).toBe(true);
    }
  });
});
