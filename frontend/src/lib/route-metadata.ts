export type CodeRoutePath =
  '/' | '/announcements' | '/exhibitions' | '/topics' | '/map';

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
};
