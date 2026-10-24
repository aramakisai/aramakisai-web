import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { point } from 'leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { MapViewportController } from './map-viewport-controller';

const container = document.createElement('div');
const map = vi.hoisted(() => ({
  getContainer: () => container,
  invalidateSize: vi.fn(),
  setMaxBounds: vi.fn(),
  setMinZoom: vi.fn(),
  getBoundsZoom: vi.fn(),
  fitBounds: vi.fn(),
  getSize: vi.fn(),
  getZoom: vi.fn(),
  project: vi.fn(),
  unproject: vi.fn(),
  flyTo: vi.fn(),
  setView: vi.fn(),
  stop: vi.fn(),
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

const initialBounds: LatLngBoundsExpression = [
  [1, 2],
  [3, 4],
];
const maxBounds: LatLngBoundsExpression = [
  [0, 1],
  [4, 5],
];
const fitOptions = {
  paddingTopLeft: [320, 24] as [number, number],
  paddingBottomRight: [24, 180] as [number, number],
  animate: false,
};

describe('MapViewportController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('注入された最大範囲と絶対下限から表示上の最小zoomを設定する', () => {
    map.getBoundsZoom.mockReturnValue(14);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={12}
        fitOptions={fitOptions}
      />,
    );

    expect(map.getBoundsZoom).toHaveBeenCalledWith(maxBounds, true);
    expect(map.setMaxBounds).toHaveBeenCalledWith(maxBounds);
    expect(map.setMinZoom).toHaveBeenCalledWith(14);
  });

  it('resize時に注入された初期範囲とpanel・sheet余白でfitし、操作後は再fitしない', () => {
    map.getBoundsZoom.mockReturnValue(14);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={12}
        fitOptions={fitOptions}
      />,
    );
    const observer = MockResizeObserver.instances.at(-1)!;

    observer.trigger();
    expect(map.fitBounds).toHaveBeenCalledWith(initialBounds, fitOptions);

    fireEvent.pointerDown(container);
    observer.trigger();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('地域mapでは初回fitを明示でき、keyboard操作後はresizeで再fitしない', () => {
    map.getBoundsZoom.mockReturnValue(14);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={12}
        fitOptions={fitOptions}
        fitOnMount
      />,
    );
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(container, { key: 'Enter' });
    MockResizeObserver.instances.at(-1)!.trigger();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('注入したpaddingを表示上の最小zoom計算へ渡す', () => {
    map.getBoundsZoom.mockReturnValue(12);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={10.5}
        minZoomPadding={point(32, 532)}
        fitOptions={fitOptions}
      />,
    );

    expect(map.getBoundsZoom).toHaveBeenCalledWith(
      maxBounds,
      true,
      expect.objectContaining({ x: 32, y: 532 }),
    );
    expect(map.setMinZoom).toHaveBeenCalledWith(12);
  });
  it('applies an explicit initial view once and does not reset it on resize', () => {
    map.getBoundsZoom.mockReturnValue(12);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        initialCenter={[36.43068, 139.044795]}
        initialZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={fitOptions}
      />,
    );

    expect(map.setView).toHaveBeenCalledWith([36.43068, 139.044795], 15.5, {
      animate: false,
    });
    MockResizeObserver.instances.at(-1)!.trigger();
    expect(map.setView).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('moves a newly selected position into the unobscured area and follows consecutive selections', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(12);
    map.getSize.mockReturnValue(point(1000, 800));
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockImplementation(({ x, y }: { x: number; y: number }) => ({
      lat: y,
      lng: x,
    }));
    const { rerender } = render(
      <MapViewportController
        fitBounds={initialBounds}
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={{
          paddingTopLeft: [396, 24],
          paddingBottomRight: [24, 24],
        }}
      />,
    );

    expect(map.project).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 36.41, lng: 139.1 }),
      15.5,
    );
    expect(map.unproject).toHaveBeenCalledWith(
      expect.objectContaining({ x: 314, y: 400 }),
      15.5,
    );
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 400, lng: 314 }),
      15.5,
      { duration: 0.6 },
    );

    rerender(
      <MapViewportController
        fitBounds={initialBounds}
        focusCenter={[36.5, 139.2]}
        focusKey={102}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={{
          paddingTopLeft: [396, 24],
          paddingBottomRight: [24, 24],
        }}
      />,
    );
    expect(map.flyTo).toHaveBeenCalledTimes(2);
    expect(map.project).toHaveBeenLastCalledWith(
      expect.objectContaining({ lat: 36.5, lng: 139.2 }),
      15.5,
    );
  });

  it('does not restart movement when only the coordinate array identity changes', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(15.5);
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    const stableFitOptions = {
      paddingTopLeft: [396, 24] as [number, number],
      paddingBottomRight: [24, 24] as [number, number],
    };
    const { rerender } = render(
      <MapViewportController
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={stableFitOptions}
      />,
    );

    rerender(
      <MapViewportController
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={stableFitOptions}
      />,
    );

    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('stops an unfinished automatic movement when returning to the list', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(15.5);
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    const { rerender } = render(
      <MapViewportController
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={fitOptions}
      />,
    );

    rerender(
      <MapViewportController
        focusCenter={null}
        focusKey={null}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={fitOptions}
      />,
    );

    expect(map.stop).toHaveBeenCalledTimes(2);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('does not keep following the same selection after the user moves the map', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(15.5);
    map.getSize.mockReturnValue(point(390, 844));
    map.project.mockReturnValue(point(200, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    const { rerender } = render(
      <MapViewportController
        fitBounds={initialBounds}
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={{
          paddingTopLeft: [16, 136],
          paddingBottomRight: [16, 396],
        }}
      />,
    );

    fireEvent.pointerDown(container);
    rerender(
      <MapViewportController
        fitBounds={initialBounds}
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={{
          paddingTopLeft: [16, 136],
          paddingBottomRight: [16, 716],
        }}
      />,
    );

    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('uses a non-animated move when reduced motion is requested', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(15.5);
    map.getSize.mockReturnValue(point(1000, 800));
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });

    render(
      <MapViewportController
        fitBounds={initialBounds}
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={fitOptions}
      />,
    );

    expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.setView).toHaveBeenCalledWith({ lat: 36.41, lng: 139.1 }, 15.5, {
      animate: false,
    });
  });
});
