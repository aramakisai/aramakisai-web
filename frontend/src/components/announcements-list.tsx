import React from 'react';
import { AnnouncementSummary } from '../lib/home-page-types';
import { RichText } from './rich-text';

export interface AnnouncementsListProps {
  announcements: AnnouncementSummary[];
}

export function AnnouncementsList({ announcements }: AnnouncementsListProps) {
  if (!announcements || announcements.length === 0) {
    return <p className="text-gray-500">お知らせはありません</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {announcements.map((announcement) => (
        <article key={announcement.id} className="border p-4 rounded">
          <h3 className="text-lg font-bold">{announcement.title}</h3>
          <time className="text-sm text-gray-600">
            {announcement.publishedAt}
          </time>
          <RichText html={announcement.body} className="mt-2" />
        </article>
      ))}
    </div>
  );
}
