import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageBySlug } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  return page ? { title: page.title } : {};
}

export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  return (
    <StaticPageView
      title={page.title}
      contentHtml={page.contentHtml}
      embedUrl={page.embedUrl}
      embedHeight={page.embedHeight}
      embedTitle={page.title}
    />
  );
}
