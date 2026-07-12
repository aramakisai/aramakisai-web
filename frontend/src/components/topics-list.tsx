/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { RichText } from './rich-text';

export interface TopicItem {
  id: number;
  title: string;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
}

export interface TopicsListProps {
  topics: TopicItem[];
}

export function TopicsList({ topics }: TopicsListProps) {
  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {topics.map((topic) => (
        <article key={topic.id} className="border p-4 rounded flex flex-col gap-2">
          {topic.imageUrl && (
            <img src={topic.imageUrl} alt={topic.title} className="w-full h-auto object-cover rounded" />
          )}
          <h3 className="text-xl font-bold">{topic.title}</h3>
          {topic.body && <RichText html={topic.body} />}
          {topic.linkUrl && (
            <a href={topic.linkUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              詳細を見る
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
