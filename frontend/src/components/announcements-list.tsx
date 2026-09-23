import Link from 'next/link';
import { formatFullDate } from '@/lib/format-date';
import { AnnouncementSummary } from '@/lib/home-page-types';
import { ChevronRightIcon } from './icons';

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
      <p className="text-base leading-[1.7] text-gray-500">
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
              className="flex items-center gap-4 py-3 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <time
                dateTime={announcement.publishedAt}
                className="w-[120px] shrink-0 text-sm leading-[1.6] text-gray-500"
              >
                {formatFullDate(announcement.publishedAt)}
              </time>
              <span className="min-w-0 flex-1 text-base leading-[1.7] text-text">
                {announcement.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {limit && announcements.length > limit && (
        <Link
          href="/announcements"
          className="flex items-center justify-end gap-2 pt-6 text-sm leading-[1.4] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="text-primary">お知らせ一覧へ</span>
          <ChevronRightIcon size={20} className="text-text" />
        </Link>
      )}
    </div>
  );
}
