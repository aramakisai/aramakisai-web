import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const FIT = [
  [0, 0],
  [1, 1],
] as [[number, number], [number, number]];

function renderWithResize() {
  let trigger = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        trigger = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  map.fitBounds.mockClear();
  render(<MapViewportSync fitBounds={FIT} />);
  trigger();
}

describe('MapViewportSync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('offsets the fit padding by the side panel right edge when it is visible', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-map-side-panel', '');
    panel.getBoundingClientRect = () => ({ width: 348, right: 372 }) as DOMRect;
    document.body.append(panel);
    renderWithResize();
    expect(map.fitBounds.mock.calls[0][1].paddingTopLeft).toEqual([404, 32]);
    expect(map.fitBounds.mock.calls[0][1].paddingBottomRight).toEqual([32, 48]);
  });

  it('uses the base padding when there is no side panel', () => {
    renderWithResize();
    expect(map.fitBounds.mock.calls[0][1].paddingTopLeft).toEqual([32, 32]);
  });

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
