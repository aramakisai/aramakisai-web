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
import {
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  REGIONAL_SPONSOR_CATEGORY_STYLES,
} from '@/lib/regional-sponsor-categories';
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
  const color = REGIONAL_SPONSOR_CATEGORY_STYLES[sponsor.category].color;
  return divIcon({
    className: `regional-sponsor-pin ${selected ? 'regional-sponsor-pin--selected' : ''}`,
    html: `<span aria-hidden="true" style="--regional-pin-color:${color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function clusterIcon(count: number, size: number) {
  return divIcon({
    className: 'regional-sponsor-cluster',
    html: `<span aria-hidden="true">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function applyAccessibility(
  marker: LeafletMarker,
  label: string,
  current = false,
) {
  const element = marker.getElement();
  if (!element) return;
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', label);
  if (current) element.setAttribute('aria-current', 'true');
  else element.removeAttribute('aria-current');
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
      onSpiderfyChange(null);
    },
    moveend: () => {
      setRevision((value) => value + 1);
      onSpiderfyChange(null);
    },
    resize: () => setRevision((value) => value + 1),
    click: () => onSpiderfyChange(null),
  });
  const zoom = map.getZoom();
  void revision;
  const groups = clusterProjectedSponsors(
    sponsors.map((sponsor) => {
      const projected = map.project(
        [sponsor.latitude, sponsor.longitude],
        zoom,
      );
      return { sponsor, x: projected.x, y: projected.y };
    }),
    { radius: markerSize, selectedSponsorId },
  );
  const spiderfied = groups.find(
    (group): group is Extract<MarkerGroup, { kind: 'cluster' }> =>
      group.kind === 'cluster' && group.id === spiderfiedClusterId,
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
        if (group.kind === 'single') {
          const { sponsor } = group;
          const label = `${sponsor.name}、${REGIONAL_SPONSOR_CATEGORY_LABELS[sponsor.category]}`;
          return (
            <Marker
              key={group.id}
              ref={(marker) => {
                if (marker) applyAccessibility(marker, label, group.selected);
              }}
              position={[sponsor.latitude, sponsor.longitude]}
              icon={pinIcon(sponsor, markerSize, group.selected)}
              keyboard
              alt={label}
              title={label}
              zIndexOffset={group.selected ? 1000 : 0}
              eventHandlers={{
                add: (event) =>
                  applyAccessibility(
                    event.target as LeafletMarker,
                    label,
                    group.selected,
                  ),
                click: () => selectSponsor(sponsor),
              }}
            />
          );
        }
        if (group.id === spiderfiedClusterId) return null;
        const sponsorLabels = group.sponsors
          .map(
            (sponsor) =>
              `${sponsor.name}（${REGIONAL_SPONSOR_CATEGORY_LABELS[sponsor.category]}）`,
          )
          .join('、');
        const label = `${group.sponsors.length}件の地域協賛：${sponsorLabels}。選択して拡大`;
        return (
          <Marker
            key={group.id}
            ref={(marker) => {
              if (marker) applyAccessibility(marker, label);
            }}
            position={[group.anchor.latitude, group.anchor.longitude]}
            icon={clusterIcon(group.sponsors.length, markerSize)}
            keyboard
            alt={label}
            title={label}
            eventHandlers={{
              add: (event) =>
                applyAccessibility(event.target as LeafletMarker, label),
              click: () => openCluster(group),
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
            const label = `${sponsor.name}、${REGIONAL_SPONSOR_CATEGORY_LABELS[sponsor.category]}`;
            return (
              <Marker
                key={`spider:${sponsor.id}`}
                ref={(marker) => {
                  if (marker) applyAccessibility(marker, label);
                }}
                position={position}
                icon={pinIcon(sponsor, markerSize, false)}
                keyboard
                alt={label}
                title={label}
                zIndexOffset={900}
                eventHandlers={{
                  add: (event) =>
                    applyAccessibility(event.target as LeafletMarker, label),
                  click: () => selectSponsor(sponsor),
                }}
              />
            );
          },
        )}
    </>
  );
}
