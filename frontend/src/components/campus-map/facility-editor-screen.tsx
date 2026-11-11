'use client';

import dynamic from 'next/dynamic';
import type { CampusMapArea, CampusMapPoint } from '@/lib/campus-map';

const FacilityEditorMap = dynamic(
  () =>
    import('./facility-editor-map').then((module) => module.FacilityEditorMap),
  { ssr: false, loading: () => <p>地図を読み込んでいます…</p> },
);

export function FacilityEditorScreen(props: {
  readonly areas: readonly CampusMapArea[];
  readonly points: readonly CampusMapPoint[];
  readonly areasUnavailable: boolean;
}) {
  return <FacilityEditorMap {...props} />;
}
