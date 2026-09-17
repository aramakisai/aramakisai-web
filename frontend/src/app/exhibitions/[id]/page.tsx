import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CATEGORY_LABELS,
  getExhibitionDetail,
  type ExhibitionDetailResult,
} from '@/lib/exhibitions';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { env } from '@/env';
import { ExhibitionGallery } from '@/components/exhibition-gallery';
import { ExhibitionLinks } from '@/components/exhibition-links';
import { ShareButton } from '@/components/share-button';
import { ArrowBackIcon, PlaceIcon } from '@/components/icons';

export interface ExhibitionPageProps {
  readonly params: Promise<{ id: string }>;
}

async function resolveExhibition(id: string): Promise<ExhibitionDetailResult> {
  const exhibitionId = Number(id);
  if (!Number.isInteger(exhibitionId)) {
    return { kind: 'missing' };
  }
  return getExhibitionDetail(exhibitionId);
}

export async function generateMetadata({
  params,
}: ExhibitionPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await resolveExhibition(id);
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
    title: exhibition.name,
    description,
    openGraph: {
      title: exhibition.name,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: exhibition.name,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

function BackLink() {
  return (
    <Link
      href="/exhibitions"
      className="inline-flex items-center gap-1 text-text hover:text-primary"
    >
      <ArrowBackIcon size={20} />
      企画一覧へ戻る
    </Link>
  );
}

export default async function ExhibitionPage({ params }: ExhibitionPageProps) {
  const { id } = await params;
  const result = await resolveExhibition(id);

  if (result.kind === 'missing') {
    notFound();
  }

  if (result.kind === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
        <BackLink />
        <p role="alert">
          企画情報の取得に失敗しました。しばらくしてから再度お試しください。
        </p>
      </main>
    );
  }

  const exhibition = result.value;
  const shareUrl = `${env.NEXT_PUBLIC_SITE_URL}/exhibitions/${exhibition.id}`;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <BackLink />

      <ExhibitionGallery
        images={exhibition.images}
        fallbackAlt={exhibition.name}
      />

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2 text-sm text-gray-600">
          {exhibition.categories.map((category) => (
            <span key={category}>{CATEGORY_LABELS[category]}</span>
          ))}
        </div>
        <h1 className="text-2xl font-bold">{exhibition.name}</h1>
        <p className="text-gray-600">{exhibition.organizationName}</p>
        {exhibition.location && (
          <p className="flex items-center gap-1 text-gray-600">
            <PlaceIcon size={16} />
            {exhibition.location}
          </p>
        )}
      </header>

      {exhibition.description && (
        <p className="whitespace-pre-wrap">{exhibition.description}</p>
      )}

      <ExhibitionLinks links={exhibition.links} />

      <ShareButton title={exhibition.name} url={shareUrl} />
    </main>
  );
}
