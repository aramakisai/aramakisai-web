import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTopicById } from '@/lib/topics';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { RichText } from '@/components/rich-text';
import { RichTextImageViewer } from '@/components/rich-text-image-viewer';
import { BackLink, DetailColumn } from '@/components/detail-column';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { toMetaDescription } from '@/lib/meta-description';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/json-ld';
import { env } from '@/env';

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
  const [topic, site] = await Promise.all([
    resolveTopic(id),
    getSiteMetadata(),
  ]);

  return buildPageMetadata({
    site,
    title: topic?.title ?? site.siteTitle,
    description: toMetaDescription(
      [topic?.metaDescription, topic?.body],
      site.description,
    ),
    // '1.0' や '01' 等の非正規表記が別 URL として canonical 宣言されるのを防ぐため、
    // 解決できた場合は正規化済みの topic.id を使う
    path: `/topics/${topic?.id ?? id}`,
    ogType: 'article',
    imageCandidates: [topic?.imageId ?? null],
  });
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const topic = await resolveTopic(id);

  if (!topic) {
    notFound();
  }

  const thumbnailUrl = toAssetUrl(topic.imageId);
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: 'トピック', path: '/topics' },
      { name: topic.title, path: `/topics/${topic.id}` },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <DetailColumn>
      <JsonLd data={breadcrumb} />
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
