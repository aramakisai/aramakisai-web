import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';
import { MapViewportSync } from './map-viewport-sync';

const map = vi.hoisted(() => ({
  getContainer: () => document.createElement('div'),
  invalidateSize: vi.fn(),
  setMinZoom: vi.fn(),
  getBoundsZoom: vi.fn(),
  fitBounds: vi.fn(),
}));

vi.mock('react-leaflet', () => ({ useMap: () => map }));

describe('MapViewportSync', () => {
  it('raises the min zoom to the zoom at which the tile bounds cover the container', () => {
    map.getBoundsZoom.mockReturnValue(17.25);
    render(
      <MapViewportSync
        fitBounds={[
          [0, 0],
          [1, 1],
        ]}
      />,
    );
    expect(map.getBoundsZoom).toHaveBeenCalledWith(
      CAMPUS_MAP_CONFIG.bounds,
      true,
    );
    expect(map.setMinZoom).toHaveBeenCalledWith(17.25);
  });

  it('never goes below the configured absolute min zoom', () => {
    map.getBoundsZoom.mockReturnValue(10);
    render(
      <MapViewportSync
        fitBounds={[
          [0, 0],
          [1, 1],
        ]}
      />,
    );
    expect(map.setMinZoom).toHaveBeenLastCalledWith(CAMPUS_MAP_CONFIG.minZoom);
  });
});
