import { readItems } from '@directus/sdk';
import { directus } from './directus';
import { AnnouncementSummary } from './home-page-types';

export async function getAnnouncements(): Promise<AnnouncementSummary[]> {
  const announcements = await directus.request(
    readItems('announcements', {
      filter: { published_at: { _lte: '$NOW', _nnull: true } },
      sort: ['-published_at'],
      limit: -1,
    }),
  );

  return announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body || '',
    publishedAt: a.published_at as string,
  }));
}
