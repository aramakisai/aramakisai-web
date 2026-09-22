import type { FestivalPhase } from '@/lib/phase';

export interface NavigationItem {
  readonly label: string;
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

export interface BottomNavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

// タイムテーブル・駐車場空き情報は別 spec (timetable-page / parking-availability) が
// 実装するまで未実装で、本 spec の時点では 404 でよい。パス自体は他の一覧ページ
// (/exhibitions 等) と同じ命名規則に揃えて先に確定しておく。
const GUIDANCE_CHILDREN: readonly NavigationItem[] = [
  { label: 'アクセス', href: '/access' },
  { label: 'ご来場の際の注意点', href: '/guidelines' },
  { label: '案内所・落とし物・迷子', href: '/info-desk' },
  { label: 'ごみの分別のお願い', href: '/waste' },
  { label: 'よくある質問', href: '/faq' },
  { label: 'お問い合わせ', href: '/contact' },
];

/**
 * フェーズごとのナビゲーション項目定義 (design.md Requirement 5 の表)。
 * 開催前フェーズの並び・協賛の有無・お知らせの子項目の有無は公開パスの絞り込みだけでは
 * 表現できないため、フェーズごとに別の配列として持つ。
 */
export const navigationItemsByPhase: Readonly<
  Record<FestivalPhase, readonly NavigationItem[]>
> = {
  live: [
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
    { label: 'ご案内', children: GUIDANCE_CHILDREN },
  ],
  pre_event: [
    { label: '荒牧祭について', href: '/#about' },
    { label: 'お知らせ', href: '/announcements' },
    { label: 'ご案内', children: GUIDANCE_CHILDREN },
    {
      label: '協賛',
      children: [
        { label: '広告協賛', href: '/sponsors/ad' },
        { label: '地域協賛', href: '/sponsors/local' },
      ],
    },
  ],
};

/**
 * 下部ナビゲーション用の項目定義 (design.md Requirement 8)。
 * ヘッダーに無い「ホーム」を含みアイコンという固有の情報を持つため、
 * navigationItemsByPhase とは別の配列として持つ。
 */
export const bottomNavigationItems: readonly BottomNavigationItem[] = [
  { label: '企画', href: '/exhibitions', icon: 'festival' },
  { label: 'マップ', href: '/map', icon: 'map' },
  { label: 'ホーム', href: '/', icon: 'home' },
  { label: 'タイムテーブル', href: '/timetable', icon: 'calendar_clock' },
  { label: '駐車場', href: '/parking', icon: 'parking_sign' },
];
