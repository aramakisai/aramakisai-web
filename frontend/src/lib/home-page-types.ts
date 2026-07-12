export type HomeActiveVariant = 'pre_event' | 'live';

export interface SnsLink {
  platform: string;
  url: string;
}

export interface NoticeSummary {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
}

export interface TopicSummary {
  id: number;
  title: string;
  body: string | null;
  imageId: string | null;
  linkUrl: string | null;
}

export interface EventDay {
  label: string;
  open: string;
  close: string;
}

export interface FestivalOverview {
  name: string;
  eventDays: EventDay[];
  admissionFee: string | null;
  paymentNote: string | null;
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
}

export interface PreEventHomeContent extends HomePageContent {
  notices: NoticeSummary[];
  topics: TopicSummary[];
}

export type HomePageResult =
  | { variant: 'pre_event'; content: PreEventHomeContent }
  | { variant: 'live'; content: HomePageContent };
