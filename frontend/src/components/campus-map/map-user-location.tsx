'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { Control, DomEvent, DomUtil, divIcon } from 'leaflet';
import { Circle, Marker, Pane, useMap } from 'react-leaflet';
import { MaterialIcon } from '@/components/icons';
import { StampToast } from '@/components/stamp-toast';
import tailwindConfig from '../../../tailwind.config';
import { useUserLocation, type UserLocation } from './use-user-location';

const THEME_COLORS = tailwindConfig.theme?.extend?.colors as Record<
  'location' | 'location-accuracy' | 'primary',
  string
>;

const DOT_SIZE = 16;
const dotIcon = divIcon({
  html: renderToStaticMarkup(
    <span className="block size-4 rounded-full border-2 border-white bg-location shadow-[0_1px_3px_rgba(0,0,0,0.3)]" />,
  ),
  className: '',
  iconSize: [DOT_SIZE, DOT_SIZE],
  iconAnchor: [DOT_SIZE / 2, DOT_SIZE / 2],
});

const ACCURACY_STYLE = {
  color: THEME_COLORS.location,
  weight: 1,
  opacity: 1,
  fillColor: THEME_COLORS['location-accuracy'],
  fillOpacity: 1,
  interactive: false,
};

// markerPane (600) のエリア名ラベル・地点マーカーより手前、tooltipPane (650) より奥
const PANE_STYLE = { zIndex: 625 };

export function MapUserLocation() {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const panToLocation = ({ latitude, longitude }: UserLocation) =>
    map.panTo([latitude, longitude], { animate: false });
  const { state, failureCount, start } = useUserLocation({
    onFirstLocation: panToLocation,
  });

  useEffect(() => {
    const control = new Control({ position: 'bottomright' });
    control.onAdd = () => {
      const div = DomUtil.create('div', 'map-locate-control');
      DomEvent.disableClickPropagation(div);
      DomEvent.disableScrollPropagation(div);
      return div;
    };
    control.addTo(map);
    setContainer(control.getContainer() ?? null);
    return () => {
      control.remove();
      setContainer(null);
    };
  }, [map]);

  const watching = state.kind === 'watching';
  const location = watching ? state.location : null;

  const handleClick = () => {
    if (!watching) start();
    else if (location) panToLocation(location);
  };

  return (
    <>
      {container &&
        createPortal(
          <button
            type="button"
            aria-label="現在地を表示"
            aria-pressed={watching}
            onClick={handleClick}
            // アイコンの取得中の色は Figma の color/primary。文字色トークンのクラスは禁止
            // 検査 (verify-no-legacy-text-colors) に掛かるため、テーマの値を直接当てる
            style={watching ? { color: THEME_COLORS.primary } : undefined}
            className="flex size-[42px] items-center justify-center rounded-lg border border-gray-200 bg-white text-text shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <MaterialIcon name="my_location" size={24} />
          </button>,
          container,
        )}
      {location && (
        <Pane name="userLocationPane" style={PANE_STYLE}>
          <Circle
            center={[location.latitude, location.longitude]}
            radius={location.accuracy}
            pathOptions={ACCURACY_STYLE}
          />
          <Marker
            position={[location.latitude, location.longitude]}
            icon={dotIcon}
            interactive={false}
            keyboard={false}
          />
        </Pane>
      )}
      {failureCount > 0 &&
        createPortal(
          // body 直下に置くのは、地図コンテナ内だと Leaflet のドラッグ・click 処理がトースト上でも走るため
          <div className="relative z-[1060]">
            <StampToast
              key={failureCount}
              kind="added"
              message="現在地を取得できませんでした"
              showLink={false}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
