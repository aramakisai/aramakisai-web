'use client';

import { useEffect, useState } from 'react';
import { divIcon, latLngBounds } from 'leaflet';
import type { FitBoundsOptions, Marker as LeafletMarker } from 'leaflet';
import { Marker, useMapEvents } from 'react-leaflet';
import {
  clusterProjectedSponsors,
  createSpiderfyLayout,
  type MarkerGroup,
} from '@/lib/regional-sponsor-clustering';
import { getRegionalSponsorCategoryPresentation } from '@/lib/regional-sponsor-categories';
import type { RegionalMapConfig } from '@/lib/regional-map-config';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

interface RegionalSponsorMarkerLayerProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly spiderfiedClusterId: string | null;
  readonly profile: RegionalMapConfig;
  readonly markerSize: 32 | 48;
  readonly fitOptions: FitBoundsOptions;
  readonly onSelectSponsor: (sponsorId: number) => void;
  readonly onSpiderfyChange: (clusterId: string | null) => void;
}

function pinIcon(sponsor: RegionalSponsor, size: number, selected: boolean) {
  const { pinAsset } = getRegionalSponsorCategoryPresentation(sponsor.category);
  return divIcon({
    className: `regional-sponsor-pin ${selected ? 'regional-sponsor-pin--selected' : ''}`,
    html: `<img aria-hidden="true" alt="" src="${pinAsset}">`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function clusterIcon(size: number) {
  return divIcon({
    className: 'regional-sponsor-cluster',
    html: '<img aria-hidden="true" alt="" src="/images/regional-sponsor-map/pin-neutral.svg">',
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
  spiderfiedClusterId,
  profile,
  markerSize,
  fitOptions,
  onSelectSponsor,
  onSpiderfyChange,
}: RegionalSponsorMarkerLayerProps) {
  const [revision, setRevision] = useState(0);
  const map = useMapEvents({
    zoomend: () => {
      setRevision((value) => value + 1);
    },
    moveend: () => {
      setRevision((value) => value + 1);
    },
    dragstart: () => onSpiderfyChange(null),
    resize: () => setRevision((value) => value + 1),
    click: () => onSpiderfyChange(null),
  });
  const zoom = map.getZoom();
  void revision;
  const projectedSponsors = sponsors.map((sponsor) => {
    const projected = map.project([sponsor.latitude, sponsor.longitude], zoom);
    return { sponsor, x: projected.x, y: projected.y };
  });
  const groups = clusterProjectedSponsors(projectedSponsors, {
    radius: markerSize,
    selectedSponsorId,
  });
  const spiderfyGroups = spiderfiedClusterId
    ? clusterProjectedSponsors(projectedSponsors, {
        radius: markerSize,
        selectedSponsorId: null,
      })
    : groups;
  const spiderfied = spiderfyGroups.find(
    (group): group is Extract<MarkerGroup, { kind: 'cluster' }> =>
      group.kind === 'cluster' && group.id === spiderfiedClusterId,
  );
  const spiderfiedSponsorIds = new Set(
    spiderfied?.sponsors.map(({ id }) => id),
  );

  useEffect(() => {
    if (spiderfiedClusterId && !spiderfied) onSpiderfyChange(null);
  }, [onSpiderfyChange, spiderfied, spiderfiedClusterId]);

  const selectSponsor = (sponsor: RegionalSponsor) => {
    onSpiderfyChange(null);
    onSelectSponsor(sponsor.id);
  };
  const openCluster = (group: Extract<MarkerGroup, { kind: 'cluster' }>) => {
    if (group.allSameCoordinate || map.getZoom() >= profile.maxZoom) {
      onSpiderfyChange(group.id);
      return;
    }
    map.fitBounds(
      latLngBounds(
        group.sponsors.map(({ latitude, longitude }) => [latitude, longitude]),
      ),
      { ...fitOptions, maxZoom: profile.maxZoom },
    );
  };

  return (
    <>
      {groups.map((group) => {
        const hiddenBySpiderfy =
          group.kind === 'single'
            ? spiderfiedSponsorIds.has(group.sponsor.id)
            : group.sponsors.every(({ id }) => spiderfiedSponsorIds.has(id));
        if (hiddenBySpiderfy) return null;
        if (group.kind === 'single') {
          const { sponsor } = group;
          const label = `${sponsor.name}、${getRegionalSponsorCategoryPresentation(sponsor.category).label}`;
          const activate = () => selectSponsor(sponsor);
          return (
            <Marker
              key={group.id}
              ref={(marker) => {
                if (marker)
                  applyAccessibility(marker, label, group.selected, activate);
              }}
              position={[sponsor.latitude, sponsor.longitude]}
              icon={pinIcon(sponsor, markerSize, group.selected)}
              keyboard={false}
              alt={label}
              title={label}
              zIndexOffset={group.selected ? 1000 : 0}
              eventHandlers={{
                add: (event) =>
                  applyAccessibility(
                    event.target as LeafletMarker,
                    label,
                    group.selected,
                    activate,
                  ),
                click: activate,
              }}
            />
          );
        }
        const sponsorLabels = group.sponsors
          .map(
            (sponsor) =>
              `${sponsor.name}（${getRegionalSponsorCategoryPresentation(sponsor.category).label}）`,
          )
          .join('、');
        const label = `${group.sponsors.length}件の地域協賛：${sponsorLabels}。選択して拡大`;
        const activate = () => openCluster(group);
        return (
          <Marker
            key={group.id}
            ref={(marker) => {
              if (marker) applyAccessibility(marker, label, false, activate);
            }}
            position={[group.anchor.latitude, group.anchor.longitude]}
            icon={clusterIcon(markerSize)}
            keyboard={false}
            alt={label}
            title={label}
            eventHandlers={{
              add: (event) =>
                applyAccessibility(
                  event.target as LeafletMarker,
                  label,
                  false,
                  activate,
                ),
              click: activate,
            }}
          />
        );
      })}
      {spiderfied &&
        createSpiderfyLayout(spiderfied.sponsors, markerSize * 1.4).map(
          ({ sponsor, offsetX, offsetY }) => {
            const anchor = map.project(
              [spiderfied.anchor.latitude, spiderfied.anchor.longitude],
              zoom,
            );
            const position = map.unproject(
              [anchor.x + offsetX, anchor.y + offsetY],
              zoom,
            );
            const label = `${sponsor.name}、${getRegionalSponsorCategoryPresentation(sponsor.category).label}`;
            const selected = sponsor.id === selectedSponsorId;
            const activate = () => onSelectSponsor(sponsor.id);
            return (
              <Marker
                key={`spider:${sponsor.id}`}
                ref={(marker) => {
                  if (marker)
                    applyAccessibility(marker, label, selected, activate);
                }}
                position={position}
                icon={pinIcon(sponsor, markerSize, selected)}
                keyboard={false}
                alt={label}
                title={label}
                zIndexOffset={selected ? 1000 : 900}
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
          },
        )}
    </>
  );
}
