import type { Topic } from '@/cms-types';
import { publishedFilter } from './announcements';
import { cms } from './cms';
import { toMediaId } from './cms-media';
import { TopicSummary } from './home-page-types';

function formatTopic(topic: Topic): TopicSummary {
  return {
    id: topic.id,
    title: topic.title,
    body: topic.body_html ?? null,
    imageId: toMediaId(topic.image),
    metaDescription: topic.meta_description ?? null,
    updatedAt: topic.updatedAt,
  };
}

export async function getTopics(): Promise<TopicSummary[]> {
  const result = await cms.findMany('topics', {
    where: publishedFilter(),
    sort: ['-published_at'],
    limit: 0,
    depth: 1,
  });
  if (!result.ok) throw new Error('トピックの取得に失敗しました');
  return result.value.docs.map(formatTopic);
}

/** 一覧 (getTopics) と同じ公開済み条件を id 一致と組み合わせる (要件 8.8, 8.9)。announcements.ts と同じ規約 */
export async function getTopicById(id: number): Promise<TopicSummary | null> {
  const result = await cms.findMany('topics', {
    where: { id: { equals: id }, ...publishedFilter() },
    limit: 1,
    depth: 1,
  });
  if (!result.ok) return null;
  const topic = result.value.docs[0];
  return topic ? formatTopic(topic) : null;
}
