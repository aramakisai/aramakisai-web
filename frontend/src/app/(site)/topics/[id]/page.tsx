import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTopicById } from '@/lib/topics';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { RichText } from '@/components/rich-text';
import { RichTextImageViewer } from '@/components/rich-text-image-viewer';
import { BackLink, DetailColumn } from '@/components/detail-column';

export interface TopicPageProps {
  params: Promise<{ id: string }>;
}

function toTopicId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

async function resolveTopic(id: string) {
  const topicId = toTopicId(id);
  if (topicId === null) return null;
  return getTopicById(topicId);
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { id } = await params;
  const topic = await resolveTopic(id);
  return topic ? { title: topic.title } : {};
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const topic = await resolveTopic(id);

  if (!topic) {
    notFound();
  }

  const thumbnailUrl = toAssetUrl(topic.imageId);

  return (
    <DetailColumn>
      <BackLink href="/topics" label="トピック一覧に戻る" />

      <h1 className="w-full text-balance py-0 text-center text-[24px] leading-[130%] text-primary lg:text-[32px] lg:leading-[125%]">
        {topic.title}
      </h1>

      <RichTextImageViewer>
        <div className="flex w-full flex-col gap-6 lg:gap-8">
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- 実ファイルは配信時に解決するため next/image の最適化対象にできない
            <img
              src={thumbnailUrl}
              alt={topic.title}
              data-media-id={topic.imageId}
              className="block h-auto max-h-[358px] w-full rounded-xl object-contain lg:max-h-[768px]"
            />
          )}

          {topic.body && <RichText html={topic.body} />}
        </div>
      </RichTextImageViewer>
    </DetailColumn>
  );
}
