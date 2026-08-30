import type { Announcement } from '@/cms-types';
import { cms } from './cms';
import { toAttachments } from './cms-media';
import { AnnouncementSummary } from './home-page-types';

function mapAnnouncement(a: Announcement): AnnouncementSummary {
  return {
    id: a.id,
    title: a.title,
    body: a.body_html || '',
    publishedAt: a.published_at as string,
    attachments: toAttachments(a.attachments),
  };
}

export function publishedFilter() {
  return {
    published_at: { less_than_equal: new Date().toISOString(), exists: true },
  } as const;
}

export async function getAnnouncements(): Promise<AnnouncementSummary[]> {
  const result = await cms.findMany('announcements', {
    where: publishedFilter(),
    sort: ['-published_at'],
    limit: 0,
    depth: 1,
  });
  if (!result.ok) throw new Error('お知らせの取得に失敗しました');
  return result.value.docs.map(mapAnnouncement);
}

export async function getAnnouncementById(
  id: number,
): Promise<AnnouncementSummary | null> {
  const result = await cms.findById('announcements', id, { depth: 1 });
  return result.ok ? mapAnnouncement(result.value) : null;
}
