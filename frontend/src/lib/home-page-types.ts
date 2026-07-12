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

export interface HomePageContent {
  heroImageId: string | null;
  heroMessageHtml: string;
  embedUrl: string | null;
  snsLinks: SnsLink[];
}

export interface PreEventHomeContent extends HomePageContent {
  notices: NoticeSummary[];
  topics: TopicSummary[];
}

export type HomePageResult =
  | { variant: 'pre_event'; content: PreEventHomeContent }
  | { variant: 'live'; content: HomePageContent };
