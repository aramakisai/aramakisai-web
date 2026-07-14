import React from 'react';
import Link from 'next/link';
import { AnnouncementSummary } from '../lib/home-page-types';

export interface AnnouncementsListProps {
  announcements: AnnouncementSummary[];
}

export function AnnouncementsList({ announcements }: AnnouncementsListProps) {
  if (!announcements || announcements.length === 0) {
    return <p className="text-gray-500">お知らせはありません</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="py-2 px-4 font-bold text-gray-700 whitespace-nowrap w-36">
              公開日時
            </th>
            <th className="py-2 px-4 font-bold text-gray-700">タイトル</th>
          </tr>
        </thead>
        <tbody>
          {announcements.slice(0, 5).map((announcement) => {
            const d = new Date(announcement.publishedAt);
            const published = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;

            return (
              <tr
                key={announcement.id}
                className="border-b hover:bg-gray-50 hover:underline"
              >
                <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap w-36">
                  <Link
                    href={`/announcements/${announcement.id}`}
                    className="block"
                  >
                    {published}
                  </Link>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/announcements/${announcement.id}`}
                    className="block font-medium"
                  >
                    {announcement.title}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Link href="/announcements" className="block hover:underline">
        すべてのお知らせを見る
      </Link>
    </div>
  );
}
