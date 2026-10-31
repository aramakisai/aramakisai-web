export type CodeRoutePath =
  | '/'
  | '/announcements'
  | '/exhibitions'
  | '/topics'
  | '/map'
  | '/sponsors/local'
  | '/faq'
  | '/timetable'
  | '/parking'
  | '/access'
  | '/mypage';

export interface RouteMetadataEntry {
  /** null はサイトタイトルそのものを使うページ ('/') */
  readonly title: string | null;
  readonly description: string;
}

// '/' の description は getSiteMetadata の既定値が使われるため実質的に参照されない
// (design.md 参照)。型を一様に保つため値は持たせておく。
export const ROUTE_METADATA: Readonly<
  Record<CodeRoutePath, RouteMetadataEntry>
> = {
  '/': {
    title: null,
    description:
      '荒牧祭の開催情報・企画一覧・お知らせをまとめた公式サイトです。',
  },
  '/announcements': {
    title: 'お知らせ',
    description:
      '荒牧祭実行委員会からのお知らせを一覧で掲載しています。開催に関する最新情報はこちらでご確認いただけます。',
  },
  '/exhibitions': {
    title: '企画一覧',
    description:
      '荒牧祭で行われる企画の一覧です。カテゴリやエリアから絞り込んで、気になる企画を探せます。',
  },
  '/topics': {
    title: 'トピック',
    description: '荒牧祭にまつわる特集記事やコラムをまとめたトピック一覧です。',
  },
  '/map': {
    title: '構内マップ',
    description:
      '荒牧祭の会場となる構内マップです。企画やステージの場所を検索できます。',
  },
  '/sponsors/local': {
    title: '地域協賛マップ',
    description:
      '荒牧祭を支える地域の協賛企業・店舗を、地図やカテゴリから探せます。',
  },
  '/faq': {
    title: 'よくある質問',
    description: '荒牧祭についてよくある質問と回答をまとめています。',
  },
  '/timetable': {
    title: 'タイムテーブル',
    description:
      '荒牧祭のステージ出演スケジュールです。開催日とステージごとの出演時間を確認できます。',
  },
  '/parking': {
    title: '駐車場空き情報',
    description:
      '荒牧祭の駐車場の空き状況を確認できます。混雑状況を見てご来場の際の参考にしてください。',
  },
  '/access': {
    title: 'アクセス',
    description:
      '荒牧祭の会場への行き方と、前橋駅行・群馬大学行のバス時刻表です。',
  },
  '/mypage': {
    title: 'マイページ',
    description:
      'QRコードで集めたスタンプとブックマークした企画を確認できます。スマートフォンでご利用ください。',
  },
};
