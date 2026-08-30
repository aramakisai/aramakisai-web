import type { Topic } from '@/cms-types';
import { publishedFilter } from './announcements';
import { cms } from './cms';
import { toAttachments, toMediaId } from './cms-media';
import { TopicSummary } from './home-page-types';

function formatTopic(topic: Topic): TopicSummary {
  return {
    id: topic.id,
    title: topic.title,
    body: topic.body_html ?? null,
    imageId: toMediaId(topic.image),
    attachments: toAttachments(topic.attachments),
  };
}

export async function getTopics(): Promise<TopicSummary[]> {
  const result = await cms.findMany('topics', {
    where: publishedFilter(),
    sort: ['sort'],
    limit: 0,
    depth: 1,
  });
  if (!result.ok) throw new Error('トピックの取得に失敗しました');
  return result.value.docs.map(formatTopic);
}

export async function getTopicById(id: number): Promise<TopicSummary | null> {
  const result = await cms.findById('topics', id, { depth: 1 });
  return result.ok ? formatTopic(result.value) : null;
}
