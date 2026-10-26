import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  navigationItemsByPhase,
  navigationFromCms,
  bottomNavigationItems,
  mobileMenuItemsFor,
  underlineColorClassFor,
} from './navigation';
import type { Navigation, Page } from '@/cms-types';

type CmsItem = NonNullable<NonNullable<Navigation['live']>['items']>[number];

const path = (label: string, href: string) => ({
  link_type: 'path' as const,
  label,
  path: href,
});
const parent = (
  label: string,
  color: CmsItem['color'],
  extra: Partial<CmsItem> = {},
): CmsItem => ({
  link_type: 'path',
  label,
  color,
  footer_column: 'site',
  ...extra,
});

const guidanceChildren = [
  path('アクセス', '/access'),
  path('ご来場の際の注意点', '/guidelines'),
  path('案内所・落とし物・迷子', '/info-desk'),
  path('ごみの分別のお願い', '/waste'),
  path('よくある質問', '/faq'),
  { ...path('お問い合わせ', '/contact'), hide_in_footer: true },
];

// 現行のコード定数と同じ内容を CMS の応答形で表したもの
const cmsFixture = {
  id: 1,
  live: {
    items: [
      parent('企画一覧', 'primary', path('企画一覧', '/exhibitions')),
      parent('構内マップ', 'secondary', path('構内マップ', '/map')),
      parent('タイムテーブル', 'info', path('タイムテーブル', '/timetable')),
      parent('お知らせ', 'warning', {
        link_type: 'group',
        children: [
          path('お知らせ一覧', '/announcements'),
          path('トピック', '/topics'),
        ],
      }),
      parent('ご案内', 'success', {
        link_type: 'group',
        footer_column: 'guidance',
        children: guidanceChildren,
      }),
    ],
  },
  pre_event: {
    items: [
      parent('荒牧祭について', 'accent-alt', path('荒牧祭について', '/#about')),
      parent('お知らせ', 'warning', path('お知らせ', '/announcements')),
      parent('トピック', 'primary', path('トピック', '/topics')),
      parent('ご案内', 'success', {
        link_type: 'group',
        footer_column: 'guidance',
        children: guidanceChildren,
      }),
      parent('協賛', 'accent', {
        link_type: 'group',
        children: [
          path('広告協賛', '/sponsors/ad'),
          path('地域協賛', '/sponsors/local'),
        ],
      }),
    ],
  },
  updatedAt: '',
  createdAt: '',
} as unknown as Navigation;

describe('navigationFromCms', () => {
  it('CMS の応答を現行のコード定数と同じ項目・順序・色・フッター振り分けに変換する', () => {
    expect(navigationFromCms(cmsFixture)).toEqual(navigationItemsByPhase);
  });

  it('pages を指す項目は /slug と title を使う', () => {
    const result = navigationFromCms({
      id: 1,
      live: {
        items: [
          parent('', 'primary', {
            link_type: 'page',
            page: { id: 1, slug: 'faq', title: 'よくある質問' } as Page,
          }),
        ],
      },
    } as unknown as Navigation);
    expect(result.live).toEqual([
      {
        label: 'よくある質問',
        href: '/faq',
        color: 'primary',
      },
    ]);
  });

  it('参照先が消えた固定ページ項目と、子が 0 件になったグループは出さない', () => {
    const result = navigationFromCms({
      id: 1,
      live: {
        items: [
          parent('', 'primary', { link_type: 'page', page: null }),
          parent('グループ', 'info', {
            link_type: 'group',
            children: [
              { link_type: 'page', page: null },
              { link_type: 'page', page: 3 },
            ],
          }),
          parent('残る', 'info', path('残る', '/ok')),
        ],
      },
    } as unknown as Navigation);
    expect(result.live.map((item) => item.label)).toEqual(['残る']);
  });

  it('link_type が path のとき page の残骸は使わず、page のとき path は使わない', () => {
    const page = { id: 1, slug: 'faq', title: 'FAQ' } as Page;
    const result = navigationFromCms({
      id: 1,
      live: {
        items: [
          parent('', 'primary', {
            link_type: 'path',
            page,
            path: '/a',
            label: 'A',
          }),
          parent('', 'info', {
            link_type: 'page',
            page,
            path: '/b',
            label: 'B',
          }),
        ],
      },
    } as unknown as Navigation);
    expect(result.live.map((i) => i.href)).toEqual(['/a', '/faq']);
  });

  it('色は Tailwind が拾える完全なクラス名に対応する', () => {
    expect(underlineColorClassFor({ color: 'accent-alt' })).toBe(
      'bg-accent-alt',
    );
    expect(underlineColorClassFor({})).toBe('bg-primary');
  });
});

describe('navigationItemsByPhase', () => {
  it('フッターのサポート列と重複するお問い合わせは hideInFooter を持つ', () => {
    const guidance = navigationItemsByPhase.live.find(
      (item) => item.footerColumn === 'guidance',
    );
    expect(guidance?.children?.filter((child) => child.hideInFooter)).toEqual([
      { label: 'お問い合わせ', href: '/contact', hideInFooter: true },
    ]);
  });

  it('子項目のみを持つ親は href を持たない', () => {
    for (const items of Object.values(navigationItemsByPhase)) {
      for (const item of items) {
        if (item.children) expect(item.href).toBeUndefined();
      }
    }
  });
});

describe('bottomNavigationItems', () => {
  it('マイページを含む 5 項目を表のとおりの順序・アイコンで持つ', () => {
    expect(bottomNavigationItems).toEqual([
      { label: '企画', href: '/exhibitions', icon: 'festival' },
      { label: 'マップ', href: '/map', icon: 'map' },
      { label: 'マイページ', href: '/mypage', icon: 'person' },
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

describe('mobileMenuItemsFor', () => {
  it('live はハンバーガーメニュー用に末尾へマイページを足す', () => {
    const items = mobileMenuItemsFor('live', navigationItemsByPhase.live);
    expect(items.slice(0, -1)).toEqual(navigationItemsByPhase.live);
    expect(items.at(-1)).toEqual({
      label: 'マイページ',
      color: 'accent-alt',
      href: '/mypage',
    });
  });

  it('pre_event は変えない', () => {
    expect(
      mobileMenuItemsFor('pre_event', navigationItemsByPhase.pre_event),
    ).toEqual(navigationItemsByPhase.pre_event);
  });

  it('PC の横並びナビが読む navigationItemsByPhase.live にはマイページを含めない', () => {
    expect(
      navigationItemsByPhase.live.some((item) => item.href === '/mypage'),
    ).toBe(false);
  });
});
