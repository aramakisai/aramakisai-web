import type { Metadata } from 'next';
import { ErrorPageContent } from '@/components/error-page-content';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const metadata = buildPageMetadata({
    site,
    title: 'ページが見つかりません',
    description: 'お探しのページは移動または削除された可能性があります。',
    path: null,
    ogType: 'website',
    imageCandidates: [],
  });

  return { ...metadata, robots: { index: false, follow: false } };
}

export default async function NotFound() {
  const site = await getSiteMetadata();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorPageContent
        variant="not-found"
        pageTitle={`ページが見つかりません | ${site.siteTitle}`}
      />
    </div>
  );
}
