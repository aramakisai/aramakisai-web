import { TopicCard, TopicCardProps } from './topic-card';
import { TextLink } from './text-link';

const HOME_VISIBLE_COUNT = 4;

export interface TopicsListProps {
  readonly topics: readonly TopicCardProps[];
  /**
   * 既定は 'grid' (`/topics` 一覧向け、全件をグリッドで並べる)。'scroll' はトップページ向けで、
   * 4 枚までに絞り SP を横スクロールにし、末尾に「トピック一覧へ」を添える (design.md Requirement 3)
   */
  readonly variant?: 'grid' | 'scroll';
  /** 各カードの文字・色。`variant` は並べ方なので別名にしている */
  readonly cardVariant?: TopicCardProps['variant'];
}

export function TopicsList({
  topics,
  variant = 'grid',
  cardVariant,
}: TopicsListProps) {
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
              <TopicCard {...topic} variant={cardVariant} />
            </div>
          ))}
        </div>
        <TextLink href="/topics" className="self-end">
          トピック一覧へ
        </TextLink>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {topics.map((topic) => (
        <TopicCard key={topic.id} {...topic} variant={cardVariant} />
      ))}
    </div>
  );
}
