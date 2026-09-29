import type { Metadata } from 'next';
import { getFaqItems } from '@/lib/faq';
import type { FaqEntry } from '@/lib/faq';
import { FaqList } from '@/components/faq-list';
import { SectionHeading } from '@/components/section-heading';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/json-ld';
import { env } from '@/env';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/faq'];

  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/faq',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function FaqPage() {
  let items: FaqEntry[];
  try {
    items = await getFaqItems();
  } catch {
    items = [];
  }

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: 'よくある質問', path: '/faq' },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-12 lg:px-20 lg:pt-12 lg:pb-20">
      <JsonLd data={breadcrumb} />
      <div
        className={
          items.length === 0
            ? 'mx-auto flex w-full max-w-[768px] flex-col gap-4'
            : 'mx-auto flex w-full max-w-[768px] flex-col gap-6 lg:gap-8'
        }
      >
        <SectionHeading
          level="h1"
          className="mb-0! text-center text-[32px] leading-[1.25] tracking-[0.02em] text-text"
        >
          よくある質問
        </SectionHeading>
        {items.length === 0 ? (
          <p className="text-[16px] leading-[1.7] text-gray-500">
            よくある質問はありません
          </p>
        ) : (
          <FaqList items={items} />
        )}
      </div>
    </div>
  );
}
