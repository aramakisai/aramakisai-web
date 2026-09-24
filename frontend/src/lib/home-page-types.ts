export interface SnsLink {
  platform: string;
  url: string;
}

export interface Attachment {
  id: string;
  filenameDownload: string;
  type: string | null;
  filesize: number | null;
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
  heroImageId: string | null;
}

/** getFestivalMeta() の戻り値。SEO 既定値の解決 (getSiteMetadata) と構造化データ生成が使う */
export interface FestivalMeta extends FestivalOverview {
  siteTitle: string | null;
  metaDescription: string | null;
  ogImageId: string | null;
  venueName: string | null;
  venueAddress: string | null;
  snsLinks: SnsLink[];
}

export interface FestivalTheme {
  word: string | null;
  imageId: string | null;
  descriptionHtml: string | null;
}

export type SponsorType = 'ad' | 'local' | 'vendor' | 'other';

export interface HomePageContent {
  heroImages: Attachment[];
  heroMessageHtml: string | null;
  snsLinks: SnsLink[];
  festival: FestivalOverview | null;
  theme: FestivalTheme | null;
  venueName: string | null;
  campusMapUrl: string | null;
  contactFormUrl: string | null;
  /** 最寄駅・バス等からの行き方 (`festival_meta.access_summary`)。未設定は null */
  accessSummary: string | null;
  announcements: AnnouncementSummary[];
  topics: TopicSummary[];
}
