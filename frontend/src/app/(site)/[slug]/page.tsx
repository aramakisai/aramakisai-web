import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageBySlug } from '@/lib/static-page';
import { StaticPageView } from '@/components/static-page-view';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { toMetaDescription } from '@/lib/meta-description';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/json-ld';
import { env } from '@/env';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [page, site] = await Promise.all([
    getPageBySlug(slug),
    getSiteMetadata(),
  ]);

  return buildPageMetadata({
    site,
    title: page?.title ?? site.siteTitle,
    description: toMetaDescription(
      [page?.metaDescription, page?.contentHtml],
      site.description,
    ),
    path: `/${slug}`,
    ogType: 'article',
    imageCandidates: [page?.ogImageId ?? null],
  });
}

export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: page.title, path: `/${slug}` },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <>
      <JsonLd data={breadcrumb} />
      <StaticPageView
        title={page.title}
        contentHtml={page.contentHtml}
        embedUrl={page.embedUrl}
        embedHeight={page.embedHeight}
        embedTitle={page.title}
      />
    </>
  );
}
