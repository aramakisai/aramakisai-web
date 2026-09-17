import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical';
import { JSDOM } from 'jsdom';
import { getPayload } from 'payload';

import configPromise from '../src/payload.config';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(dirname, '../seed');

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(seedDir, name), 'utf-8'));
}

async function main() {
  const payload = await getPayload({ config: configPromise });
  const editorConfig = await editorConfigFactory.default({ config: payload.config });
  const toLexical = (html: string | null | undefined) =>
    convertHTMLToLexical({ editorConfig, html: html ?? '', JSDOM });

  const idMap: Record<string, number> = {};

  // 1. media
  const files = readJson<{ data: { id: string; type: string; filename_download: string; title: string | null }[] }>(
    'files.json',
  ).data;
  for (const f of files) {
    const buffer = fs.readFileSync(path.join(seedDir, 'files', f.id));
    const created = await payload.create({
      collection: 'media',
      data: { alt: f.title ?? f.filename_download },
      file: { data: buffer, mimetype: f.type, name: f.filename_download, size: buffer.length },
    });
    idMap[f.id] = created.id as number;
    console.log(`media: ${f.id} -> ${created.id} (${f.filename_download})`);
  }

  // 2. announcements
  const announcement = readJson<{
    data: { id: number; title: string; body: string; published_at: string; attachments: number[] }[];
  }>('announcements.json').data[0];
  const announcementFiles = readJson<{
    data: { announcements_id: number; directus_files_id: string; sort: number }[];
  }>('announcements_files.json')
    .data.filter((r) => r.announcements_id === announcement.id)
    .sort((a, b) => a.sort - b.sort)
    .map((r) => idMap[r.directus_files_id]);

  const createdAnnouncement = await payload.create({
    collection: 'announcements',
    data: {
      title: announcement.title,
      body: toLexical(announcement.body),
      published_at: announcement.published_at,
      attachments: announcementFiles,
    },
  });
  console.log(`announcement created: ${createdAnnouncement.id}`);

  // 3. festival_meta global
  type JsonValue = string | number | boolean | JsonValue[] | { [x: string]: JsonValue } | null;
  const festivalMeta = readJson<{
    data: {
      name: string;
      event_days: JsonValue;
      sns_links: JsonValue;
      overview: string;
      theme_word: string | null;
      theme_description: string;
      venue_name: string | null;
      campus_map_url: string | null;
      contact_form_url: string | null;
      theme_image: string | null;
    };
  }>('festival_meta.json').data;
  await payload.updateGlobal({
    slug: 'festival_meta',
    data: {
      name: festivalMeta.name,
      event_days: festivalMeta.event_days,
      sns_links: festivalMeta.sns_links,
      overview: toLexical(festivalMeta.overview),
      theme_word: festivalMeta.theme_word,
      theme_description: toLexical(festivalMeta.theme_description),
      venue_name: festivalMeta.venue_name,
      campus_map_url: festivalMeta.campus_map_url,
      contact_form_url: festivalMeta.contact_form_url,
      theme_image: festivalMeta.theme_image ? idMap[festivalMeta.theme_image] : undefined,
    },
  });
  console.log('festival_meta updated');

  // 4. page_home global
  const pageHome = readJson<{ data: { hero_message: string | null; hero_images: number[] } }>(
    'page_home.json',
  ).data;
  const pageHomeFiles = readJson<{
    data: { page_home_id: number; directus_files_id: string; sort: number }[];
  }>('page_home_files.json')
    .data.sort((a, b) => a.sort - b.sort)
    .map((r) => idMap[r.directus_files_id]);
  await payload.updateGlobal({
    slug: 'page_home',
    data: {
      hero_message: pageHome.hero_message ? toLexical(pageHome.hero_message) : undefined,
      hero_images: pageHomeFiles,
    },
  });
  console.log('page_home updated');

  // 5. pages
  const pages = readJson<{
    data: {
      slug: string;
      title: string;
      content: string;
      embed_url: string | null;
      embed_height: number | null;
      sort: number | null;
    }[];
  }>('pages.json').data;
  for (const p of pages) {
    const created = await payload.create({
      collection: 'pages',
      data: {
        slug: p.slug,
        title: p.title,
        content: toLexical(p.content),
        embed_url: p.embed_url,
        embed_height: p.embed_height,
        sort: p.sort,
      },
    });
    console.log(`page created: ${p.slug} -> ${created.id}`);
  }

  fs.writeFileSync(path.join(seedDir, 'id-map.json'), JSON.stringify(idMap, null, 2));
  console.log('id-map.json written');

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
