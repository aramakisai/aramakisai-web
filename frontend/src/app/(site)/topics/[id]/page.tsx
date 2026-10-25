import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTopicById } from '@/lib/topics';
import { TopicDetailBody } from '@/components/topic-detail-body';
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

// ビルド時には何も生成せず、初回アクセスで生成して以後キャッシュする
// (generateStaticParams が無いと revalidate が効かず毎回 SSR になる)
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { id } = await params;
  const [topic, site] = await Promise.all([
    resolveTopic(id),
    getSiteMetadata(),
  ]);

  if (!topic) {
    notFound();
  }

  return buildPageMetadata({
    site,
    title: topic.title,
    description: toMetaDescription(
      [topic.metaDescription, topic.body],
      site.description,
    ),
    // '1.0' や '01' 等の非正規表記が別 URL として canonical 宣言されるのを防ぐため、
    // 解決できた場合は正規化済みの topic.id を使う
    path: `/topics/${topic.id}`,
    ogType: 'article',
    imageCandidates: [topic.imageId ?? null],
  });
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { id } = await params;
  const topic = await resolveTopic(id);

  if (!topic) {
    notFound();
  }

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

      <TopicDetailBody topic={topic} />
    </DetailColumn>
  );
}
