import Link from 'next/link';
import { TopicCard, TopicCardProps } from './topic-card';
import { ChevronRightIcon } from './icons';

const HOME_VISIBLE_COUNT = 4;

export interface TopicsListProps {
  readonly topics: readonly TopicCardProps[];
  /**
   * 既定は 'grid' (`/topics` 一覧向け、全件をグリッドで並べる)。'scroll' はトップページ向けで、
   * 4 枚までに絞り SP を横スクロールにし、末尾に「トピック一覧へ」を添える (design.md Requirement 3)
   */
  readonly variant?: 'grid' | 'scroll';
}

export function TopicsList({ topics, variant = 'grid' }: TopicsListProps) {
  if (!topics || topics.length === 0) {
    return null;
  }

  if (variant === 'scroll') {
    const visible = topics.slice(0, HOME_VISIBLE_COUNT);

    return (
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex gap-6 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible">
          {visible.map((topic) => (
            <div key={topic.id} className="w-[260px] shrink-0 lg:w-auto">
              <TopicCard {...topic} />
            </div>
          ))}
        </div>
        <Link
          href="/topics"
          className="flex items-center justify-end gap-2 self-end text-sm font-bold"
        >
          <span className="text-primary">トピック一覧へ</span>
          <ChevronRightIcon size={20} className="text-text" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
      {topics.map((topic) => (
        <TopicCard key={topic.id} {...topic} />
      ))}
    </div>
  );
}
