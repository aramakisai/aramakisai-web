export interface SnsLink {
  platform: string;
  url: string;
}

export interface Attachment {
  id: string;
  filenameDownload: string;
  type: string | null;
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
  label: string;
  open: string;
  close: string;
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

export interface SponsorSummary {
  id: number;
  type: readonly SponsorType[];
  name: string;
  logoId: string | null;
  url: string | null;
  tier: string | null;
}

export interface HomePageContent {
  heroImages: Attachment[];
  heroMessageHtml: string;
  snsLinks: SnsLink[];
  festival: FestivalOverview;
  theme: FestivalTheme;
  venueName: string | null;
  campusMapUrl: string | null;
  contactFormUrl: string | null;
  sponsors: SponsorSummary[];
  announcements: AnnouncementSummary[];
  topics: TopicSummary[];
}
