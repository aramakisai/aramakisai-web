'use client';

import { useState } from 'react';
import { divIcon, latLngBounds } from 'leaflet';
import type { FitBoundsOptions, Marker as LeafletMarker } from 'leaflet';
import { Marker, useMapEvents } from 'react-leaflet';
import {
  clusterProjectedSponsors,
  locationIdsOf,
  type MarkerGroup,
} from '@/lib/regional-sponsor-clustering';
import { getRegionalSponsorCategoryPresentation } from '@/lib/regional-sponsor-categories';
import { prefersReducedMotion } from '@/lib/use-motion-preference';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

// Leaflet はマーカーの z-index を「画面の y 座標 + zIndexOffset」にする。順位差が
// y の差(パン後は数万pxに達しうる)に負けないよう、順位1つぶんを十分大きく取る。
// z-index はマーカーペイン(z-index 600)内で完結し、他ペインとは衝突しない
const RANK_STEP = 100_000;

interface RegionalSponsorMarkerLayerProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly maxZoom: number;
  readonly markerSize: 32 | 48;
  readonly visibleAreaOptions: (container: HTMLElement) => FitBoundsOptions;
  readonly onSelectSponsor: (sponsorId: number) => void;
  readonly onSelectLocation: (sponsorIds: readonly number[]) => void;
}

function icon(src: string, size: number, className: string) {
  return divIcon({
    className,
    html: `<img aria-hidden="true" alt="" src="${src}">`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function applyAccessibility(
  marker: LeafletMarker,
  label: string,
  current = false,
  onActivate?: () => void,
) {
  const element = marker.getElement();
  if (!element) return;
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', label);
  element.tabIndex = 0;
  if (current) element.setAttribute('aria-current', 'true');
  else element.removeAttribute('aria-current');
  element.onkeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    onActivate?.();
  };
}

export function RegionalSponsorMarkerLayer({
  sponsors,
  selectedSponsorId,
  maxZoom,
  markerSize,
  visibleAreaOptions,
  onSelectSponsor,
  onSelectLocation,
}: RegionalSponsorMarkerLayerProps) {
  const [revision, setRevision] = useState(0);
  const map = useMapEvents({
    zoomend: () => setRevision((value) => value + 1),
    moveend: () => setRevision((value) => value + 1),
    resize: () => setRevision((value) => value + 1),
  });
  const zoom = map.getZoom();
  void revision;
  const projectedSponsors = sponsors.map((sponsor) => {
    const projected = map.project([sponsor.latitude, sponsor.longitude], zoom);
    return { sponsor, x: projected.x, y: projected.y };
  });
  const groups = clusterProjectedSponsors(projectedSponsors, {
    radius: markerSize,
    zoom,
    maxZoom,
    selectedSponsorId,
  });
  // 重なったピンは一覧の並びで後のものを前面に出す。選択中は常に最前面
  const rankById = new Map(sponsors.map(({ id }, index) => [id, index]));
  const rankOf = (group: MarkerGroup) =>
    RANK_STEP *
    Math.max(
      ...(group.kind === 'single' ? [group.sponsor] : group.sponsors).map(
        ({ id }) => rankById.get(id) ?? 0,
      ),
    );
  const selectedOffset = RANK_STEP * (sponsors.length + 1);

  const openCluster = (group: Exclude<MarkerGroup, { kind: 'single' }>) => {
    const { paddingTopLeft, paddingBottomRight } = visibleAreaOptions(
      map.getContainer(),
    );
    map.fitBounds(
      latLngBounds(
        group.sponsors.map(({ latitude, longitude }) => [latitude, longitude]),
      ),
      {
        paddingTopLeft,
        paddingBottomRight,
        maxZoom,
        ...(prefersReducedMotion() ? { animate: false } : {}),
      },
    );
  };

  return (
    <>
      {groups.map((group) => {
        const single = group.kind === 'single';
        const members = single ? [group.sponsor] : group.sponsors;
        const label = single
          ? `${group.sponsor.name}、${getRegionalSponsorCategoryPresentation(group.sponsor.category).label}`
          : `${members.length}件の地域協賛：${members
              .map(
                (sponsor) =>
                  `${sponsor.name}（${getRegionalSponsorCategoryPresentation(sponsor.category).label}）`,
              )
              .join(
                '、',
              )}。${group.kind === 'cluster' ? '選択して拡大' : '選択して一覧を表示'}`;
        const selected = single && group.selected;
        const activate = single
          ? () => onSelectSponsor(group.sponsor.id)
          : group.kind === 'cluster'
            ? () => openCluster(group)
            : () => onSelectLocation(locationIdsOf(group.sponsors));
        const position: [number, number] = single
          ? [group.sponsor.latitude, group.sponsor.longitude]
          : [group.anchor.latitude, group.anchor.longitude];
        return (
          <Marker
            key={group.id}
            ref={(marker) => {
              if (marker) applyAccessibility(marker, label, selected, activate);
            }}
            position={position}
            icon={
              single
                ? icon(
                    getRegionalSponsorCategoryPresentation(
                      group.sponsor.category,
                    ).pinAsset,
                    markerSize,
                    `regional-sponsor-pin ${selected ? 'regional-sponsor-pin--selected' : ''}`,
                  )
                : icon(
                    '/images/regional-sponsor-map/pin-neutral.svg',
                    markerSize,
                    'regional-sponsor-cluster',
                  )
            }
            keyboard={false}
            alt={label}
            title={label}
            zIndexOffset={selected ? selectedOffset : rankOf(group)}
            eventHandlers={{
              add: (event) =>
                applyAccessibility(
                  event.target as LeafletMarker,
                  label,
                  selected,
                  activate,
                ),
              click: activate,
            }}
          />
        );
      })}
    </>
  );
}
