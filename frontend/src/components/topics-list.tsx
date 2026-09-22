import { TopicCard, TopicCardProps } from './topic-card';

export interface TopicsListProps {
  readonly topics: readonly TopicCardProps[];
}

export function TopicsList({ topics }: TopicsListProps) {
  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
      {topics.map((topic) => (
        <TopicCard key={topic.id} {...topic} />
      ))}
    </div>
  );
}
