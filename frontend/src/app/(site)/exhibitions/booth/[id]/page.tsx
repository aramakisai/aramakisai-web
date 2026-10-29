import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/env';
import { BackLink } from '@/components/detail-column';
import { ExhibitionDetailBody } from '@/components/exhibition-detail-body';
import { JsonLd } from '@/components/json-ld';
import { getCampusMapAreas } from '@/lib/campus-map';
import { getCorporateBoothDetail } from '@/lib/corporate-booths';
import { listingHref } from '@/lib/exhibitions';
import { toMetaDescription } from '@/lib/meta-description';
import { buildPageMetadata } from '@/lib/page-metadata';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { formatOpenDays, getEventDayList } from '@/lib/timetable';

export function generateStaticParams() {
  return [];
}

// 学生企画の詳細と同じ値。実効値はルート layout の revalidate (60) との最小値になる
export const revalidate = 300;

export interface CorporateBoothPageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CorporateBoothPageProps): Promise<Metadata> {
  const { id } = await params;
  const [result, site] = await Promise.all([
    getCorporateBoothDetail(id),
    getSiteMetadata(),
  ]);
  if (result.kind === 'missing') notFound();
  const booth = result.kind === 'found' ? result.value : null;

  return buildPageMetadata({
    site,
    title: booth?.displayName ?? site.siteTitle,
    description: toMetaDescription([booth?.description], site.description),
    // '007' 等の非正規表記が別 URL として canonical 宣言されるのを防ぐ
    path: booth ? listingHref(booth) : `/exhibitions/booth/${id}`,
    ogType: 'article',
    imageCandidates: [booth?.thumbnail?.id ?? null],
  });
}

export default async function CorporateBoothPage({
  params,
}: CorporateBoothPageProps) {
  const { id } = await params;
  const [result, areasResult, eventDays] = await Promise.all([
    getCorporateBoothDetail(id),
    getCampusMapAreas(),
    getEventDayList(),
  ]);

  if (result.kind === 'missing') notFound();
  // 取得失敗の描画は再検証までキャッシュされ古い正常なページを上書きするため、
  // 例外にして古いページを保つ
  if (
    result.kind === 'error' ||
    areasResult.kind === 'error' ||
    eventDays === null
  ) {
    throw new Error('企業ブース詳細の取得に失敗しました');
  }

  const booth = result.value;
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: '企画一覧', path: '/exhibitions' },
      { name: booth.displayName, path: listingHref(booth) },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-4 pb-12 lg:gap-8 lg:px-20 lg:pt-8 lg:pb-20">
      <JsonLd data={breadcrumb} />
      <BackLink href="/exhibitions" label="企画一覧へ戻る" />

      <ExhibitionDetailBody
        exhibition={booth}
        areas={areasResult.value}
        performances={null}
        openDays={formatOpenDays(booth.openDayKeys, eventDays)}
      />
    </div>
  );
}
