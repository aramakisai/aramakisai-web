import { createDirectus, rest } from '@directus/sdk';
import { env } from '@/env';

type PageHome = {
  id: number;
  hero_image: string | null;
  hero_message: string | null;
  embed_url: string | null;
  blocks: unknown;
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
  event_days: unknown;
  admission_fee: string | null;
  payment_note: string | null;
  parking_capacity: number | null;
  parking_map: string | null;
  home_active_variant: string | null;
  sns_links: { platform: string; url: string }[] | null;
};

type Announcement = {
  id: number;
  title: string;
  body: string | null;
  published_at: string | null;
};

type Topic = {
  id: number;
  title: string;
  body: string | null;
  image: string | null;
  link_url: string | null;
  attachment: string | null;
  sort: number | null;
};

export type Schema = {
  page_home: PageHome;
  page_home_live: PageHomeLive;
  festival_meta: FestivalMeta;
  announcements: Announcement[];
  topics: Topic[];
};

export const directus = createDirectus<Schema>(
  env.NEXT_PUBLIC_DIRECTUS_URL,
).with(rest());
