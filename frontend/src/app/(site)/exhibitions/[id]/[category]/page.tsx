import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  getExhibitionDetail,
  type ExhibitionCategory,
  type ExhibitionDetailResult,
} from '@/lib/exhibitions';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { env } from '@/env';
import { getCampusMapAreas, type CampusMapArea } from '@/lib/campus-map';
import { ExhibitionGallery } from '@/components/exhibition-gallery';
import { ExhibitionLinks } from '@/components/exhibition-links';
import { ExhibitionLocationSection } from '@/components/exhibition-location-map/exhibition-location-section';
import { ShareButton } from '@/components/share-button';
import { ArrowBackIcon, PlaceIcon } from '@/components/icons';

export interface ExhibitionPageProps {
  readonly params: Promise<{ id: string; category: string }>;
}

function isExhibitionCategory(value: string): value is ExhibitionCategory {
  return (CATEGORY_VALUES as readonly string[]).includes(value);
}

async function resolveExhibition(
  id: string,
  category: string,
): Promise<ExhibitionDetailResult> {
  const exhibitionId = Number(id);
  // category を先に検証することで、未知のカテゴリでは不要な取得を発生させない
  if (!Number.isInteger(exhibitionId) || !isExhibitionCategory(category)) {
    return { kind: 'missing' };
  }
  return getExhibitionDetail(exhibitionId, category);
}

export async function generateMetadata({
  params,
}: ExhibitionPageProps): Promise<Metadata> {
  const { id, category } = await params;
  const result = await resolveExhibition(id, category);
  if (result.kind !== 'found') {
    return {};
  }

  const exhibition = result.value;
  const description =
    exhibition.description || `${exhibition.organizationName} の企画`;
  const imageUrl = exhibition.thumbnail
    ? toAssetUrl(exhibition.thumbnail.id, 960)
    : null;

  return {
    title: exhibition.displayName,
    description,
    openGraph: {
      title: exhibition.displayName,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: exhibition.displayName,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

function BackLink() {
  return (
    <Link
      href="/exhibitions"
      className="inline-flex items-center gap-1 text-sm leading-[140%] font-medium text-gray-500 hover:text-primary"
    >
      <ArrowBackIcon size={18} className="text-text" />
      企画一覧へ戻る
    </Link>
  );
}

// Figma は stage/exhibit/other のみ定義。vendor は未定義色のため既存トークンから
// 他カテゴリと重複しない secondary を割り当てる (ponytail: Figma 追加時に差し替え)
const CATEGORY_BADGE_COLORS: Readonly<Record<ExhibitionCategory, string>> = {
  stage: 'bg-accent',
  exhibit: 'bg-info',
  vendor: 'bg-secondary',
  other: 'bg-accent-alt',
};

function CategoryBadge({
  category,
}: {
  readonly category: ExhibitionCategory;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs leading-[140%] font-medium text-text ${CATEGORY_BADGE_COLORS[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export default async function ExhibitionPage({ params }: ExhibitionPageProps) {
  const { id, category } = await params;
  const [result, areasResult] = await Promise.all([
    resolveExhibition(id, category),
    getCampusMapAreas(),
  ]);

  if (result.kind === 'missing') {
    notFound();
  }

  if (result.kind === 'error') {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 lg:px-20 lg:py-12">
        <BackLink />
        <p role="alert">
          企画情報の取得に失敗しました。しばらくしてから再度お試しください。
        </p>
      </div>
    );
  }

  const exhibition = result.value;
  const shareUrl = `${env.NEXT_PUBLIC_SITE_URL}/exhibitions/${exhibition.id}/${exhibition.category}`;
  // 区画取得失敗をページ全体のエラーへ昇格させないため、ここで空区画へ縮退させる
  const areas: readonly CampusMapArea[] =
    areasResult.kind === 'loaded' ? areasResult.value : [];

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-4 pb-12 lg:gap-8 lg:px-20 lg:pt-8 lg:pb-20">
      <BackLink />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
        <div className="lg:w-[640px] lg:shrink-0">
          <ExhibitionGallery
            images={exhibition.images}
            fallbackAlt={exhibition.displayName}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-1 lg:gap-4">
          <div className="flex flex-wrap gap-2">
            {exhibition.categories.map((c) => (
              <CategoryBadge key={c} category={c} />
            ))}
          </div>
          <h1 className="py-0 text-[24px] leading-[130%] text-primary lg:text-[32px] lg:leading-[125%]">
            {exhibition.displayName}
          </h1>
          <p className="text-base leading-[170%] text-text">
            {exhibition.organizationName}
          </p>
          {exhibition.location && (
            <p className="flex items-center gap-1 text-sm leading-[140%] font-medium text-gray-500">
              <PlaceIcon size={20} className="text-text" />
              {exhibition.location}
            </p>
          )}

          <ExhibitionLinks links={exhibition.links} />

          <ShareButton title={exhibition.displayName} url={shareUrl} />
        </div>
      </div>

      {exhibition.description && (
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-6 lg:pt-8">
          <h2 className="py-0 text-[20px] leading-[140%] text-primary lg:text-[24px] lg:leading-[130%]">
            紹介
          </h2>
          <p className="text-base leading-[170%] whitespace-pre-wrap text-text">
            {exhibition.description}
          </p>
        </div>
      )}

      <ExhibitionLocationSection exhibition={exhibition} areas={areas} />
    </div>
  );
}
