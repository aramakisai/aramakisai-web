import type { Metadata } from 'next';
import { getTopics } from '@/lib/topics';
import { TopicsList } from '@/components/topics-list';
import { TopicSummary } from '@/lib/home-page-types';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/topics'];

  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/topics',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function TopicsPage() {
  let topics: TopicSummary[];
  try {
    topics = await getTopics();
  } catch {
    topics = [];
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-12 lg:gap-6 lg:px-20 lg:pt-12 lg:pb-20">
      <h1 className="text-center">トピック</h1>
      {topics.length === 0 ? (
        <p>トピックはありません</p>
      ) : (
        <TopicsList topics={topics} />
      )}
    </div>
  );
}
