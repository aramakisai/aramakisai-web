import React from 'react';
import { NoticeSummary } from '../lib/home-page-types';
import { RichText } from './rich-text';

export interface NoticesListProps {
  notices: NoticeSummary[];
}

export function NoticesList({ notices }: NoticesListProps) {
  if (!notices || notices.length === 0) {
    return <p className="text-gray-500">お知らせはありません</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {notices.map((notice) => (
        <article key={notice.id} className="border p-4 rounded">
          <h3 className="text-lg font-bold">{notice.title}</h3>
          <time className="text-sm text-gray-600">{notice.publishedAt}</time>
          <RichText html={notice.body} className="mt-2" />
        </article>
      ))}
    </div>
  );
}
