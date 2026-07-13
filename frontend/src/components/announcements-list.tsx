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
            <th className="py-2 px-4 font-bold text-gray-700 whitespace-nowrap">
              公開日時
            </th>
            <th className="py-2 px-4 font-bold text-gray-700">タイトル</th>
          </tr>
        </thead>
        <tbody>
          {announcements.map((announcement) => (
            <tr key={announcement.id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                {announcement.publishedAt}
              </td>
              <td className="py-3 px-4">
                <Link
                  href={`/announcements/${announcement.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {announcement.title}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
