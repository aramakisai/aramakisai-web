import type { Announcement } from '@/cms-types';
import { cms } from './cms';
import { toAttachments, toMediaId } from './cms-media';
import { AnnouncementSummary } from './home-page-types';

function mapAnnouncement(a: Announcement): AnnouncementSummary {
  return {
    id: a.id,
    title: a.title,
    body: a.body_html || '',
    publishedAt: a.published_at as string,
    attachments: toAttachments(a.attachments),
    metaDescription: a.meta_description ?? null,
    ogImageId: toMediaId(a.og_image),
    updatedAt: a.updatedAt,
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

/**
 * 一覧 (getAnnouncements) と同じ公開済み条件を id 一致と組み合わせて 1 回の取得で判定する。
 * 未公開・不在・取得失敗をいずれも null に潰すことで、詳細ページの notFound() と
 * メタデータ生成の既定値退避が呼び出し側で区別なく動く (要件 8.8, 8.9)。
 */
export async function getAnnouncementById(
  id: number,
): Promise<AnnouncementSummary | null> {
  const result = await cms.findMany('announcements', {
    where: { id: { equals: id }, ...publishedFilter() },
    limit: 1,
    depth: 1,
  });
  if (!result.ok) return null;
  const announcement = result.value.docs[0];
  return announcement ? mapAnnouncement(announcement) : null;
}
