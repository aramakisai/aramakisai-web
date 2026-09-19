import { getTopics } from '@/lib/topics';
import { TopicsList } from '@/components/topics-list';
import { TopicSummary } from '@/lib/home-page-types';

export default async function TopicsPage() {
  let topics: TopicSummary[];
  try {
    topics = await getTopics();
  } catch {
    topics = [];
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold border-b border-gray-200 pb-2">
        トピックス
      </h1>
      {topics.length === 0 ? (
        <p>トピックスはありません</p>
      ) : (
        <TopicsList topics={topics} />
      )}
    </main>
  );
}
