import { getTopics } from '@/lib/topics';
import { TopicsList } from '@/components/topics-list';
import type { TopicSummary } from '@/lib/home-page-types';

export default async function TouchTopicsPage() {
  let topics: TopicSummary[];
  try {
    topics = await getTopics();
  } catch {
    topics = [];
  }

  return (
    <main className="min-h-dvh bg-background px-6 pt-6 pb-[240px]">
      {topics.length === 0 ? (
        <p className="text-signage-body">トピックはありません</p>
      ) : (
        <TopicsList topics={topics} cardVariant="signage" />
      )}
    </main>
  );
}
