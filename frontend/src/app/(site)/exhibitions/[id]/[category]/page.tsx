import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/env';
import { BackLink } from '@/components/detail-column';
import { ExhibitionDetailBody } from '@/components/exhibition-detail-body';
import {
  loadExhibitionDetailPage,
  resolveExhibition,
} from '@/lib/exhibition-detail-page';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { toMetaDescription } from '@/lib/meta-description';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/json-ld';
import { StampCollector } from '@/components/stamp-collector';
import { isStampCategory } from '@/lib/stamp-signature';

// ビルド時には何も生成せず、初回アクセスで生成して以後キャッシュする
export function generateStaticParams() {
  return [];
}

// 実効値はルート layout の revalidate (60) との最小値になる。layout 側を伸ばさない限り 60 秒
export const revalidate = 300;

export interface ExhibitionPageProps {
  readonly params: Promise<{ id: string; category: string }>;
}

export async function generateMetadata({
  params,
}: ExhibitionPageProps): Promise<Metadata> {
  const { id, category } = await params;
  const [result, site] = await Promise.all([
    resolveExhibition(id, category),
    getSiteMetadata(),
  ]);

  // ページ本体は result.kind === 'error' のとき notFound() を呼ばず専用のエラー表示に
  // するため、ここも 'missing' だけを notFound() の対象にする
  if (result.kind === 'missing') {
    notFound();
  }
  const exhibition = result.kind === 'found' ? result.value : null;

  // student_exhibitions に専用の meta description フィールドは無いため、本文 (description) →
  // サイト既定値の2段のみ (announcements/topics/pages とは異なり、ページ固有の CMS フィールドが無い)
  return buildPageMetadata({
    site,
    title: exhibition?.displayName ?? site.siteTitle,
    description: toMetaDescription([exhibition?.description], site.description),
    // '1.0' や '01' 等の非正規表記が別 URL として canonical 宣言されるのを防ぐため、
    // 解決できた場合は正規化済みの exhibition.id を使う
    path: `/exhibitions/${exhibition?.id ?? id}/${category}`,
    ogType: 'article',
    imageCandidates: [exhibition?.thumbnail?.id ?? null],
  });
}

export default async function ExhibitionPage({ params }: ExhibitionPageProps) {
  const { id, category } = await params;
  const { exhibition, areas, performances, openDays } =
    await loadExhibitionDetailPage(id, category);
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: '企画一覧', path: '/exhibitions' },
      {
        name: exhibition.displayName,
        path: `/exhibitions/${exhibition.id}/${exhibition.category}`,
      },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-4 pb-12 lg:gap-8 lg:px-20 lg:pt-8 lg:pb-20">
      <JsonLd data={breadcrumb} />
      {isStampCategory(exhibition.category) && (
        <StampCollector
          exhibitionId={exhibition.id}
          category={exhibition.category}
        />
      )}
      <BackLink href="/exhibitions" label="企画一覧へ戻る" />

      <ExhibitionDetailBody
        exhibition={exhibition}
        areas={areas}
        performances={performances}
        openDays={openDays}
      />
    </div>
  );
}
