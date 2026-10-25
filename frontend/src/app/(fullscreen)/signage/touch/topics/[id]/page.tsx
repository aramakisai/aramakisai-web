import { notFound } from 'next/navigation';
import { getTopicById } from '@/lib/topics';
import { TopicDetailBody } from '@/components/topic-detail-body';

export function generateStaticParams() {
  return [];
}

export default async function TouchTopicPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const topicId = Number(id);
  const topic = Number.isInteger(topicId) ? await getTopicById(topicId) : null;
  if (!topic) notFound();

  return (
    <main className="min-h-dvh bg-background px-6 pt-6 pb-[240px]">
      <TopicDetailBody topic={topic} variant="signage" />
    </main>
  );
}
