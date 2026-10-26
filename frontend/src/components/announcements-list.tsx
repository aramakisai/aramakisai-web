import Link from 'next/link';
import { formatFullDate } from '@/lib/format-date';
import { AnnouncementSummary } from '@/lib/home-page-types';
import { HoverLineText } from './hover-line';
import { TextLink } from './text-link';

export interface AnnouncementsListProps {
  announcements: AnnouncementSummary[];
  /** 呼び出し側が指定する表示件数の上限。超過分があるとき「お知らせ一覧へ」を添える (要件 13.4) */
  limit?: number;
}

export function AnnouncementsList({
  announcements,
  limit,
}: AnnouncementsListProps) {
  if (announcements.length === 0) {
    return (
      <p className="text-base leading-[1.7] text-gray-600">
        お知らせはありません
      </p>
    );
  }

  const visibleAnnouncements = limit
    ? announcements.slice(0, limit)
    : announcements;

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {visibleAnnouncements.map((announcement) => (
          <li key={announcement.id} className="border-b border-gray-200">
            <Link
              href={`/announcements/${announcement.id}`}
              className="group/row flex items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <time
                dateTime={announcement.publishedAt}
                className="w-[120px] shrink-0 text-sm leading-[1.6] text-gray-600"
              >
                {formatFullDate(announcement.publishedAt)}
              </time>
              <span className="min-w-0 flex-1 text-base leading-[1.7] text-text">
                <HoverLineText gap={3}>{announcement.title}</HoverLineText>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {limit && announcements.length > limit && (
        <div className="flex justify-end pt-6">
          <TextLink href="/announcements">お知らせ一覧へ</TextLink>
        </div>
      )}
    </div>
  );
}
