import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CampusMapPoint } from '@/lib/campus-map';
import { renderCampusMapPage } from '../map-page-content';

function requireDevelopment() {
  if (process.env.NODE_ENV !== 'development') notFound();
}

export function generateMetadata(): Metadata {
  requireDevelopment();
  return {
    title: '施設マーカープレビュー',
    robots: { index: false, follow: false },
  };
}

export default async function FacilityPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ testData?: string }>;
}) {
  requireDevelopment();
  const testData = (await searchParams).testData === '1';
  const { default: confirmed } =
    await import('../../../../../../cms/data/campus-map-facilities.json');
  const previewPoints = confirmed.map((point): Omit<CampusMapPoint, 'id'> => {
    const kind = point.kind;
    if (kind !== 'reception' && kind !== 'garbage_station') {
      throw new Error('プレビュー地点の種別が不正です');
    }
    const comedy = 'label' in point && point.label?.includes('お笑いライブ');
    const poster =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="400" height="560" fill="#eaf4e1"/><text x="200" y="270" text-anchor="middle" font-size="28">TEST POSTER</text></svg>';
    return {
      ...point,
      kind,
      ...(testData && kind === 'reception'
        ? {
            testData: true,
            ...(comedy
              ? {
                  posterUrl: `data:image/svg+xml,${encodeURIComponent(poster)}`,
                }
              : {}),
          }
        : {}),
    };
  });
  return renderCampusMapPage({
    previewPoints,
    basePath: testData
      ? '/map/facility-preview?testData=1'
      : '/map/facility-preview',
    ...(testData
      ? { testPamphletUrl: '/map/facility-preview/test-pamphlet' }
      : {}),
  });
}
