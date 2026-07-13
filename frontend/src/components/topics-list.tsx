import React from 'react';
import { TopicCard, TopicCardProps } from './topic-card';

export interface TopicsListProps {
  topics: TopicCardProps[];
}

export function TopicsList({ topics }: TopicsListProps) {
  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {topics.map((topic) => (
        <TopicCard key={topic.id} {...topic} />
      ))}
    </div>
  );
}
