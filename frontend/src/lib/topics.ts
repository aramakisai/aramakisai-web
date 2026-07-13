import { readItems, readItem } from '@directus/sdk';
import { directus, type TopicFile } from './directus';
import { TopicSummary, Attachment } from './home-page-types';

// Directus SDKの型付きfieldsはドット区切りのdeep-fields文字列を表現できないため、
// このリテラル配列のみ許容してキャストする。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOPIC_FIELDS: any = [
  '*',
  'attachments.sort',
  'attachments.directus_files_id.id',
  'attachments.directus_files_id.filename_download',
  'attachments.directus_files_id.type',
];

type RawTopic = {
  id: number;
  title: string;
  body: string | null;
  image: string | null;
  link_url: string | null;
  attachments?: TopicFile[];
};

function formatTopic(topicData: RawTopic): TopicSummary {
  const sortedAttachments = [...(topicData.attachments || [])].sort(
    (a, b) => (a.sort ?? 9999) - (b.sort ?? 9999),
  );

  const attachments: Attachment[] = sortedAttachments
    .filter((att) => att.directus_files_id != null)
    .map((att) => {
      const fileRef = att.directus_files_id;
      if (typeof fileRef === 'string') {
        return { id: fileRef, filenameDownload: '', type: null };
      }
      return {
        id: fileRef.id,
        filenameDownload: fileRef.filename_download,
        type: fileRef.type,
      };
    });

  return {
    id: topicData.id,
    title: topicData.title,
    body: topicData.body ?? null,
    imageId: topicData.image ?? null,
    linkUrl: topicData.link_url ?? null,
    attachments,
  };
}

export async function getTopics(): Promise<TopicSummary[]> {
  const topicsData = await directus.request(
    readItems('topics', {
      sort: ['sort'],
      fields: TOPIC_FIELDS,
    }),
  );

  return ((topicsData || []) as unknown as RawTopic[]).map(formatTopic);
}

export async function getTopicById(id: number): Promise<TopicSummary | null> {
  try {
    const topicData = await directus.request(
      readItem('topics', id, {
        fields: TOPIC_FIELDS,
      }),
    );

    if (!topicData) return null;

    return formatTopic(topicData as unknown as RawTopic);
  } catch {
    return null;
  }
}
