import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const metadata = buildPageMetadata({
    site,
    title: '準備中',
    description: 'このページは現在準備中です。公開までお待ちください。',
    path: null,
    ogType: 'website',
    imageCandidates: [],
  });

  // ステータスは 404 のまま返すため、準備中ページが検索に載らないようにする
  return { ...metadata, robots: { index: false, follow: false } };
}

export default async function SponsorsComingSoon() {
  const site = await getSiteMetadata();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="space-y-6 text-center">
        <title>{`準備中 | ${site.siteTitle}`}</title>
        <h1 className="text-3xl font-bold">準備中です</h1>
        <p className="text-gray-600">
          このページは現在準備中です。公開までお待ちください。
        </p>
        <Link href="/" className="text-text hover:underline">
          トップページに戻る
        </Link>
      </div>
    </div>
  );
}
