import { createDirectus, rest } from '@directus/sdk';
import { env } from '@/env';

type PageHome = {
  id: number;
  hero_image: string | null;
  hero_message: string | null;
  embed_url: string | null;
};

type PageHomeLive = {
  id: number;
  hero_image: string | null;
  hero_message: string | null;
  embed_url: string | null;
};

type FestivalMeta = {
  id: number;
  name: string;
  event_days: { label: string; open: string; close: string }[] | null;
  admission_fee: string | null;
  payment_note: string | null;
  parking_capacity: number | null;
  parking_map: string | null;
  home_active_variant: string | null;
  sns_links: { platform: string; url: string }[] | null;
  overview: string | null;
  hero_image: string | null;
};

export type DirectusFileRef = {
  id: string;
  type: string | null;
  filename_download: string;
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
  link_url: string | null;
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
  page_home_live: PageHomeLive;
  festival_meta: FestivalMeta;
  announcements: Announcement[];
  topics: Topic[];
  sponsors: Sponsor[];
  pages: Page[];
  topics_files: TopicFile[];
  announcements_files: AnnouncementFile[];
};

export const directus = createDirectus<Schema>(
  env.NEXT_PUBLIC_DIRECTUS_URL,
).with(rest());
