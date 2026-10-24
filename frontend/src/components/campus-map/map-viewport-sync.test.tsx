import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';
import { MapViewportSync } from './map-viewport-sync';

const map = vi.hoisted(() => ({
  getContainer: () => document.createElement('div'),
  invalidateSize: vi.fn(),
  setMaxBounds: vi.fn(),
  setMinZoom: vi.fn(),
  getBoundsZoom: vi.fn(),
  fitBounds: vi.fn(),
}));

vi.mock('react-leaflet', () => ({ useMap: () => map }));

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

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

  it('keeps the existing campus fit padding when the container resizes', () => {
    MockResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const fitBounds = [
      [0, 0],
      [1, 1],
    ] as [[number, number], [number, number]];
    render(<MapViewportSync fitBounds={fitBounds} />);

    MockResizeObserver.instances.at(-1)?.trigger();
    expect(map.fitBounds).toHaveBeenCalledWith(fitBounds, {
      paddingTopLeft: [8, 8],
      paddingBottomRight: [8, 24],
      animate: false,
    });
    vi.unstubAllGlobals();
  });
});
