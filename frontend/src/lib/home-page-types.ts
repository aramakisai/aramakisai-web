export interface SnsLink {
  platform: string;
  url: string;
}

export interface Attachment {
  id: string;
  filenameDownload: string;
  type: string | null;
  filesize: number | null;
  /** REST の相対 URL (原本 / card / hero)。ID のみの参照や未生成サイズでは無い */
  url?: string | null;
  cardUrl?: string | null;
  heroUrl?: string | null;
}

export interface AnnouncementSummary {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
  attachments: Attachment[];
  /**
   * 既存呼び出し側 (home-page.ts) がこのフィールドを持たないオブジェクトを
   * 組み立てているため任意にしている (SEO メタデータ合成側のみ使用)。
   */
  metaDescription?: string | null;
  ogImageId?: string | null;
  updatedAt?: string;
}

export interface TopicSummary {
  id: number;
  title: string;
  body: string | null;
  imageId: string | null;
  /** 既存呼び出し側 (home-page.ts) との互換のため任意にしている */
  metaDescription?: string | null;
  updatedAt?: string;
}

export interface EventDay {
  label: string | null;
  startAt: string;
  endAt: string;
}

export interface FestivalOverview {
  name: string;
  eventDays: EventDay[];
  overviewHtml: string | null;
}

/** getFestivalMeta() の戻り値。SEO 既定値の解決 (getSiteMetadata) と構造化データ生成が使う */
export interface FestivalMeta extends FestivalOverview {
  ogImageId: string | null;
  snsLinks: SnsLink[];
}

export interface FestivalTheme {
  word: string | null;
  descriptionHtml: string | null;
}

export type SponsorType = 'ad' | 'local' | 'vendor' | 'other';

export interface HomePageContent {
  heroImages: Attachment[];
  snsLinks: SnsLink[];
  festival: FestivalOverview | null;
  theme: FestivalTheme | null;
  contactFormUrl: string | null;
  announcements: AnnouncementSummary[];
  topics: TopicSummary[];
}
