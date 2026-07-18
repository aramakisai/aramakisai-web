import { createDirectus, rest } from '@directus/sdk';
import { env } from '@/env';

export type DirectusFileRef = {
  id: string;
  type: string | null;
  filename_download: string;
};

export type PageHomeFile = {
  id: number;
  page_home_id: number;
  directus_files_id: string | DirectusFileRef;
  sort: number | null;
};

type PageHome = {
  id: number;
  hero_message: string | null;
  hero_images: PageHomeFile[];
};

type FestivalMeta = {
  id: number;
  name: string;
  event_days: { label: string; open: string; close: string }[] | null;
  parking_map: string | null;
  sns_links: { platform: string; url: string }[] | null;
  overview: string | null;
  hero_image: string | null;
  site_title: string | null;
};

export type AnnouncementFile = {
  id: number;
  announcements_id: number;
  directus_files_id: string | DirectusFileRef;
  sort: number | null;
};

type Announcement = {
  id: number;
  title: string;
  body: string | null;
  published_at: string | null;
  attachments: AnnouncementFile[];
};

export type TopicFile = {
  id: number;
  topics_id: number;
  directus_files_id: string | DirectusFileRef;
  sort: number | null;
};

type Topic = {
  id: number;
  title: string;
  body: string | null;
  image: string | null;
  attachment: string | null;
  sort: number | null;
  attachments: TopicFile[];
};

type Sponsor = {
  id: number;
  type: 'ad' | 'sponsor' | 'food_truck' | 'other';
  name: string;
  logo: string | null;
  url: string | null;
  tier: string | null;
  sort: number | null;
};

type Page = {
  id: number;
  slug: string;
  title: string;
  content: string | null;
  embed_url: string | null;
  embed_height: number | null;
  sort: number | null;
};

export type Schema = {
  page_home: PageHome;
  festival_meta: FestivalMeta;
  announcements: Announcement[];
  topics: Topic[];
  sponsors: Sponsor[];
  pages: Page[];
  topics_files: TopicFile[];
  announcements_files: AnnouncementFile[];
  page_home_files: PageHomeFile[];
};

export const directus = createDirectus<Schema>(
  env.NEXT_PUBLIC_DIRECTUS_URL,
).with(rest());
