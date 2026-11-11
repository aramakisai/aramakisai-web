import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FacilityEditorScreen } from '@/components/campus-map/facility-editor-screen';
import { getCampusMapData } from '@/lib/campus-map';

function requireDevelopment() {
  if (process.env.NODE_ENV !== 'development') notFound();
}

export function generateMetadata(): Metadata {
  requireDevelopment();
  return { title: '施設配置確認', robots: { index: false, follow: false } };
}

export default async function FacilityEditorPage() {
  requireDevelopment();
  const data = await getCampusMapData({ edge: true });
  return (
    <FacilityEditorScreen
      areas={data.areas.kind === 'loaded' ? data.areas.value : []}
      points={data.points}
      areasUnavailable={data.areas.kind === 'error'}
    />
  );
}
