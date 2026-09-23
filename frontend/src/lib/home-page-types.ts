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
}

export interface TopicSummary {
  id: number;
  title: string;
  body: string | null;
  imageId: string | null;
  attachments: Attachment[];
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
