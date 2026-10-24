import type { RegionalMapConfig } from '../../src/lib/regional-map-config';

/** Playwright専用。公開設定や正式な地域boundsには使用しない。 */
export const REGIONAL_MAP_E2E_PROFILE: RegionalMapConfig = {
  id: 'regional',
  bounds: [
    [36.36, 139.03],
    [36.46, 139.18],
  ],
  minZoom: 10,
  maxZoom: 18,
  minNativeZoom: 10,
  maxNativeZoom: 16,
  publicDirectory: 'public/regional-map-tiles',
  urlTemplate: '/regional-map-tiles/{z}/{x}/{y}.webp',
  expectedMaxTileCount: 64,
  expectedMaxBytes: 1_000_000,
  initialCenter: [36.43068, 139.044795],
  initialZoom: 15.5,
  focusZoom: 15.5,
};
