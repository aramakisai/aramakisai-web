import type { Navigation, Page } from '@/cms-types';
import type { FestivalPhase } from '@/lib/phase';

export type NavigationColor =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'warning'
  | 'success'
  | 'accent'
  | 'accent-alt';

export interface NavigationItem {
  readonly label: string;
  /** 現在地インジケーターの色。省略時は primary */
  readonly color?: NavigationColor;
  /** 親項目のフッターでの振り分け先。省略時は site */
  readonly footerColumn?: 'site' | 'guidance';
  /** 子項目をフッターに出さない (サポート列に同じリンクがあるなど) */
  readonly hideInFooter?: boolean;
  // 子項目のみを持つ親 (「お知らせ」「ご案内」「協賛」) は遷移先を持たないため任意にする。
  readonly href?: string;
  readonly children?: readonly NavigationItem[];
}

/** 子項目は現状すべて遷移先を持つ末端項目のため、href を持つものだけを描画対象にする。 */
export function linkableChildren(
  item: NavigationItem,
): readonly (NavigationItem & { href: string })[] {
  return (item.children ?? []).filter(
    (child): child is NavigationItem & { href: string } =>
      child.href !== undefined,
  );
}

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 子項目だけを持つ親は、いずれかの子項目が現在地のとき現在地として扱う。 */
export function isItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.href) return isPathActive(pathname, item.href);
  return (
    item.children?.some(
      (child) => child.href !== undefined && isPathActive(pathname, child.href),
    ) ?? false
  );
}

// secondary・info はいずれも背景色に対してコントラスト比が不足するため、
// ラベルの文字色 (color/text) は変えず下線・インジケーターの色だけで現在地を伝える。
// Tailwind が動的なクラス名を拾えないため、値からクラスへの対応は完全な文字列で持つ
const UNDERLINE_COLOR_CLASS: Readonly<Record<NavigationColor, string>> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  accent: 'bg-accent',
  'accent-alt': 'bg-accent-alt',
};

/** ヘッダー (PC) とハンバーガーメニューの現在地インジケーターが共有する親項目ごとの色。 */
export function underlineColorClassFor(
  item: Pick<NavigationItem, 'color'>,
): string {
  return UNDERLINE_COLOR_CLASS[item.color ?? 'primary'];
}

export interface BottomNavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

const GUIDANCE_CHILDREN: readonly NavigationItem[] = [
  { label: 'アクセス', href: '/access' },
  { label: 'ご来場の際の注意点', href: '/guidelines' },
  { label: '案内所・落とし物・迷子', href: '/info-desk' },
  { label: 'ごみの分別のお願い', href: '/waste' },
  { label: 'よくある質問', href: '/faq' },
  { label: 'お問い合わせ', href: '/contact', hideInFooter: true },
];

const GUIDANCE: NavigationItem = {
  label: 'ご案内',
  color: 'success',
  footerColumn: 'guidance',
  children: GUIDANCE_CHILDREN,
};

export type NavigationByPhase = Readonly<
  Record<FestivalPhase, readonly NavigationItem[]>
>;

/**
 * CMS に接続できず直近の正常値も無いときの最終段。
 * フェーズごとのナビゲーション項目定義 (design.md Requirement 5 の表)。
 * 開催前フェーズの並び・協賛の有無・お知らせの子項目の有無は公開パスの絞り込みだけでは
 * 表現できないため、フェーズごとに別の配列として持つ。
 */
export const navigationItemsByPhase: NavigationByPhase = {
  live: [
    { label: '企画一覧', color: 'primary', href: '/exhibitions' },
    { label: '構内マップ', color: 'secondary', href: '/map' },
    { label: 'タイムテーブル', color: 'info', href: '/timetable' },
    {
      label: 'お知らせ',
      color: 'warning',
      children: [
        { label: 'お知らせ一覧', href: '/announcements' },
        { label: 'トピック', href: '/topics' },
      ],
    },
    GUIDANCE,
  ],
  pre_event: [
    { label: '荒牧祭について', color: 'accent-alt', href: '/#about' },
    { label: 'お知らせ', color: 'warning', href: '/announcements' },
    { label: 'トピック', color: 'primary', href: '/topics' },
    GUIDANCE,
    {
      label: '協賛',
      color: 'accent',
      children: [
        { label: '広告協賛', href: '/sponsors/ad' },
        { label: '地域協賛', href: '/sponsors/local' },
      ],
    },
  ],
};

/**
 * SP のハンバーガーメニュー専用の項目。マイページは下部ナビゲーションが SP 専用のため、
 * PC の横並びナビには出さない。
 */
export function mobileMenuItemsFor(
  phase: FestivalPhase,
  items: readonly NavigationItem[],
): readonly NavigationItem[] {
  return phase === 'live'
    ? [...items, { label: 'マイページ', color: 'accent-alt', href: '/mypage' }]
    : items;
}

type CmsNavigationItems = NonNullable<NonNullable<Navigation['live']>['items']>;
type CmsNavigationItem = CmsNavigationItems[number];
type CmsNavigationChild = NonNullable<CmsNavigationItem['children']>[number];

// 参照先の pages が削除されると page は null か id のままになる。その場合は path に落とし、
// path も無ければ描画対象から外す
function resolveLink(entry: {
  page?: number | Page | null;
  path?: string | null;
  label?: string | null;
}): { label: string; href: string } | undefined {
  const { page } = entry;
  if (page && typeof page === 'object') {
    return { label: page.title, href: `/${page.slug}` };
  }
  if (entry.path && entry.label) {
    return { label: entry.label, href: entry.path };
  }
  return undefined;
}

function childFromCms(child: CmsNavigationChild): NavigationItem | undefined {
  const link = resolveLink(child);
  if (!link) return undefined;
  return child.hide_in_footer ? { ...link, hideInFooter: true } : link;
}

function itemFromCms(item: CmsNavigationItem): NavigationItem | undefined {
  const base = {
    color: item.color,
    footerColumn:
      item.footer_column === 'guidance' ? ('guidance' as const) : undefined,
  };
  if (item.children?.length) {
    const children = item.children.flatMap((child) => {
      const converted = childFromCms(child);
      return converted ? [converted] : [];
    });
    if (!children.length || !item.label) return undefined;
    return { label: item.label, ...base, children };
  }
  const link = resolveLink(item);
  return link ? { ...link, ...base } : undefined;
}

/** Payload の navigation グローバルを、フェーズごとの表示用項目へ変換する。 */
export function navigationFromCms(global: Navigation): NavigationByPhase {
  const convert = (items: CmsNavigationItems | null | undefined) =>
    (items ?? []).flatMap((item) => {
      const converted = itemFromCms(item);
      return converted ? [converted] : [];
    });
  return {
    live: convert(global.live?.items),
    pre_event: convert(global.pre_event?.items),
  };
}

/**
 * 下部ナビゲーション用の項目定義 (design.md Requirement 8)。
 * ヘッダーに無い「マイページ」を含みアイコンという固有の情報を持つため、
 * navigationItemsByPhase とは別の配列として持つ。
 */
export const bottomNavigationItems: readonly BottomNavigationItem[] = [
  { label: '企画', href: '/exhibitions', icon: 'festival' },
  { label: 'マップ', href: '/map', icon: 'map' },
  { label: 'マイページ', href: '/mypage', icon: 'person' },
  { label: 'タイムテーブル', href: '/timetable', icon: 'calendar_clock' },
  { label: '駐車場', href: '/parking', icon: 'parking_sign' },
];
