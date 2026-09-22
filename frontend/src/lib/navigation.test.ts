import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  navigationItemsByPhase,
  bottomNavigationItems,
  type NavigationItem,
} from './navigation';

describe('navigationItemsByPhase', () => {
  it('live (開催中) は表のとおりの項目・順序・子項目を持つ', () => {
    const expected: readonly NavigationItem[] = [
      { label: '企画一覧', href: '/exhibitions' },
      { label: '構内マップ', href: '/map' },
      { label: 'タイムテーブル', href: '/timetable' },
      {
        label: 'お知らせ',
        children: [
          { label: 'お知らせ一覧', href: '/announcements' },
          { label: 'トピック', href: '/topics' },
        ],
      },
      {
        label: 'ご案内',
        children: [
          { label: 'アクセス', href: '/access' },
          { label: 'ご来場の際の注意点', href: '/guidelines' },
          { label: '案内所・落とし物・迷子', href: '/info-desk' },
          { label: 'ごみの分別のお願い', href: '/waste' },
          { label: 'よくある質問', href: '/faq' },
          { label: 'お問い合わせ', href: '/contact' },
        ],
      },
    ];
    expect(navigationItemsByPhase.live).toEqual(expected);
  });

  it('pre_event (開催前) は表のとおりの項目・順序・子項目を持つ', () => {
    const expected: readonly NavigationItem[] = [
      { label: '荒牧祭について', href: '/#about' },
      { label: 'お知らせ', href: '/announcements' },
      {
        label: 'ご案内',
        children: navigationItemsByPhase.live[4].children,
      },
      {
        label: '協賛',
        children: [
          { label: '広告協賛', href: '/sponsors/ad' },
          { label: '地域協賛', href: '/sponsors/local' },
        ],
      },
    ];
    expect(navigationItemsByPhase.pre_event).toEqual(expected);
  });

  it('live と pre_event の「ご案内」は同一の子項目を持つ (design.md 「during と同一の6項目」)', () => {
    const live = navigationItemsByPhase.live.find(
      (item) => item.label === 'ご案内',
    );
    const preEvent = navigationItemsByPhase.pre_event.find(
      (item) => item.label === 'ご案内',
    );
    expect(preEvent?.children).toEqual(live?.children);
  });

  it('「ご案内」など子項目のみを持つ親は href を持たない', () => {
    const parents = ['お知らせ', 'ご案内', '協賛'];
    for (const phase of [
      navigationItemsByPhase.live,
      navigationItemsByPhase.pre_event,
    ]) {
      for (const item of phase) {
        if (parents.includes(item.label) && item.children) {
          expect(item.href).toBeUndefined();
        }
      }
    }
  });

  it('フッターの「サイト案内」「ご案内」振り分けは「ご案内」の子項目とそれ以外から導出できる', () => {
    const live = navigationItemsByPhase.live;
    const guidance = live.find((item) => item.label === 'ご案内');
    const siteInfo = live.filter((item) => item.label !== 'ご案内');
    expect(guidance?.children?.length).toBeGreaterThan(0);
    expect(siteInfo.map((item) => item.label)).toEqual([
      '企画一覧',
      '構内マップ',
      'タイムテーブル',
      'お知らせ',
    ]);
  });
});

describe('bottomNavigationItems', () => {
  it('ホームを含む 5 項目を表のとおりの順序・アイコンで持つ', () => {
    expect(bottomNavigationItems).toEqual([
      { label: '企画', href: '/exhibitions', icon: 'festival' },
      { label: 'マップ', href: '/map', icon: 'map' },
      { label: 'ホーム', href: '/', icon: 'home' },
      { label: 'タイムテーブル', href: '/timetable', icon: 'calendar_clock' },
      { label: '駐車場', href: '/parking', icon: 'parking_sign' },
    ]);
  });

  it('企画・マップ・タイムテーブルの遷移先はヘッダーの同名項目と一致する (要件 8.8)', () => {
    const live = navigationItemsByPhase.live;
    const exhibitions = live.find((item) => item.label === '企画一覧');
    const map = live.find((item) => item.label === '構内マップ');
    const timetable = live.find((item) => item.label === 'タイムテーブル');
    expect(bottomNavigationItems[0].href).toBe(exhibitions?.href);
    expect(bottomNavigationItems[1].href).toBe(map?.href);
    expect(bottomNavigationItems[3].href).toBe(timetable?.href);
  });
});

describe('lib/navigation.ts は表示部品を参照しない (要件 19.4)', () => {
  const source = readFileSync(require.resolve('./navigation.ts'), 'utf-8');

  it("'use client' を持たない", () => {
    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it('react や components を import しない', () => {
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/from ['"]@\/components/);
  });
});
