export type HomeActiveVariant = 'pre_event' | 'live';

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

export interface SponsorSummary {
  id: number;
  type: 'ad' | 'sponsor' | 'food_truck' | 'other';
  name: string;
  logoId: string | null;
  url: string | null;
  tier: string | null;
}

export interface HomePageContent {
  heroImageId: string | null;
  heroMessageHtml: string;
  embedUrl: string | null;
  snsLinks: SnsLink[];
  festival: FestivalOverview;
  sponsors: SponsorSummary[];
  announcements: AnnouncementSummary[];
}

export interface LiveHomeContent extends HomePageContent {
  topics: TopicSummary[];
}

export type HomePageResult =
  | { variant: 'pre_event'; content: HomePageContent }
  | { variant: 'live'; content: LiveHomeContent };
