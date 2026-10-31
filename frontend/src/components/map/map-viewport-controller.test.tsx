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
  once: vi.fn(),
  getCenter: vi.fn(),
  panBy: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
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
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('initialFitBoundsがあれば初回だけsetViewの代わりにfitする', () => {
    map.getBoundsZoom.mockReturnValue(14);
    const { rerender } = render(
      <MapViewportController
        initialCenter={[2, 3]}
        initialZoom={15}
        initialFitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={12}
        fitOptions={() => fitOptions}
        initialFitOptions={() => fitOptions}
      />,
    );

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledWith(initialBounds, fitOptions);
    expect(map.setView).not.toHaveBeenCalled();

    rerender(
      <MapViewportController
        initialCenter={[2, 3]}
        initialZoom={15}
        initialFitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={13}
        fitOptions={() => fitOptions}
        initialFitOptions={() => fitOptions}
      />,
    );
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('注入された最大範囲と絶対下限から表示上の最小zoomを設定する', () => {
    map.getBoundsZoom.mockReturnValue(14);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={12}
        fitOptions={() => fitOptions}
      />,
    );

    expect(map.getBoundsZoom).toHaveBeenCalledWith(maxBounds, true);
    expect(map.setMaxBounds).toHaveBeenCalledWith(maxBounds);
    expect(map.setMinZoom).toHaveBeenCalledWith(14);
  });

  it.each([
    ['pointerdown', () => fireEvent.pointerDown(container)],
    ['keydown', () => fireEvent.keyDown(container, { key: 'ArrowUp' })],
  ])(
    'resize時に注入された初期範囲とpanel・sheet余白でfitし、%s後は再fitしない',
    (_, interact) => {
      map.getBoundsZoom.mockReturnValue(14);
      render(
        <MapViewportController
          fitBounds={initialBounds}
          maxBounds={maxBounds}
          minZoom={12}
          fitOptions={() => fitOptions}
        />,
      );
      const observer = MockResizeObserver.instances.at(-1)!;

      observer.trigger();
      expect(map.fitBounds).toHaveBeenCalledWith(initialBounds, fitOptions);

      interact();
      observer.trigger();
      expect(map.fitBounds).toHaveBeenCalledTimes(1);
    },
  );

  it('fitOptions callbackをresizeのたびにcontainerから解決する', () => {
    map.getBoundsZoom.mockReturnValue(14);
    const dynamicFitOptions = vi
      .fn()
      .mockReturnValueOnce(fitOptions)
      .mockReturnValueOnce({ ...fitOptions, paddingTopLeft: [400, 24] });
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={12}
        fitOptions={dynamicFitOptions}
      />,
    );

    const observer = MockResizeObserver.instances.at(-1)!;
    observer.trigger();
    expect(map.fitBounds).toHaveBeenLastCalledWith(initialBounds, fitOptions);
    observer.trigger();
    expect(dynamicFitOptions).toHaveBeenCalledTimes(2);
    expect(dynamicFitOptions).toHaveBeenNthCalledWith(1, container);
    expect(dynamicFitOptions).toHaveBeenNthCalledWith(2, container);
    expect(map.fitBounds).toHaveBeenLastCalledWith(initialBounds, {
      ...fitOptions,
      paddingTopLeft: [400, 24],
    });
  });

  it('注入したpaddingを表示上の最小zoom計算へ渡す', () => {
    map.getBoundsZoom.mockReturnValue(12);
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={10.5}
        minZoomPadding={point(32, 532)}
        fitOptions={() => fitOptions}
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
        fitOptions={() => fitOptions}
      />,
    );

    expect(map.setView).toHaveBeenCalledWith([36.43068, 139.044795], 15.5, {
      animate: false,
    });
    MockResizeObserver.instances.at(-1)!.trigger();
    expect(map.setView).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('焦点を合わせた後のresizeでは全体表示へfitし直さない', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(12);
    map.getSize.mockReturnValue(point(1000, 800));
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockImplementation(({ x, y }: { x: number; y: number }) => ({
      lat: y,
      lng: x,
    }));
    render(
      <MapViewportController
        fitBounds={initialBounds}
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={() => fitOptions}
        focusFitOptions={() => fitOptions}
      />,
    );

    MockResizeObserver.instances.at(-1)!.trigger();
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
        fitOptions={() => ({
          paddingTopLeft: [396, 24],
          paddingBottomRight: [24, 24],
        })}
        focusFitOptions={() => ({
          paddingTopLeft: [396, 24],
          paddingBottomRight: [24, 24],
        })}
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
        fitOptions={() => ({
          paddingTopLeft: [396, 24],
          paddingBottomRight: [24, 24],
        })}
        focusFitOptions={() => ({
          paddingTopLeft: [396, 24],
          paddingBottomRight: [24, 24],
        })}
      />,
    );
    expect(map.flyTo).toHaveBeenCalledTimes(2);
    expect(map.project).toHaveBeenLastCalledWith(
      expect.objectContaining({ lat: 36.5, lng: 139.2 }),
      15.5,
    );
  });

  it('refocusKeyが変わると、選択中の位置をズームを変えずに見えている領域の中央へ移す', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(14);
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    const props = {
      focusCenter: [36.41, 139.1] as [number, number],
      focusKey: 101,
      focusZoom: 16,
      maxBounds,
      minZoom: 10.5,
      fitOptions: () => fitOptions,
      focusFitOptions: () => fitOptions,
    };
    const { rerender } = render(
      <MapViewportController {...props} refocusKey="desktop" />,
    );
    expect(map.setView).toHaveBeenCalledWith(expect.anything(), 16, {
      animate: false,
    });
    map.setView.mockClear();

    rerender(<MapViewportController {...props} refocusKey="mobile" />);
    expect(map.setView).toHaveBeenCalledWith(expect.anything(), 14, {
      animate: false,
    });
  });

  it('does not restart movement when only the coordinate array identity changes', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(12);
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
        fitOptions={() => stableFitOptions}
        focusFitOptions={() => stableFitOptions}
      />,
    );

    rerender(
      <MapViewportController
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={() => stableFitOptions}
        focusFitOptions={() => stableFitOptions}
      />,
    );

    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('stops an unfinished automatic movement when returning to the list', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(12);
    map.project.mockReturnValue(point(500, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    const { rerender } = render(
      <MapViewportController
        focusCenter={[36.41, 139.1]}
        focusKey={101}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={() => fitOptions}
        focusFitOptions={() => fitOptions}
      />,
    );

    rerender(
      <MapViewportController
        focusCenter={null}
        focusKey={null}
        focusZoom={15.5}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={() => fitOptions}
        focusFitOptions={() => fitOptions}
      />,
    );

    expect(map.stop).toHaveBeenCalledTimes(2);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('maxBoundsPaddingがあれば余白の分だけ最大範囲を広げ、zoomendで現在のzoomに張り直す', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(14);
    map.project.mockImplementation((ll: { lat: number; lng: number }) =>
      point(ll.lat * 100, ll.lng * 100),
    );
    map.unproject.mockImplementation((p: { x: number; y: number }) => ({
      lat: p.x / 100,
      lng: p.y / 100,
    }));
    render(
      <MapViewportController
        fitBounds={initialBounds}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={() => fitOptions}
        maxBoundsPadding={() => ({
          paddingTopLeft: [10, 20],
          paddingBottomRight: [30, 40],
        })}
      />,
    );
    const widened = (call: number) => {
      const b = map.setMaxBounds.mock.calls[call]![0];
      return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    };
    expect(map.project).toHaveBeenCalledWith(expect.anything(), 10.5);
    expect(widened(0)).toEqual([-0.1, 1.4, 4.3, 4.8]);
    expect(map.setMaxBounds).not.toHaveBeenCalledWith(maxBounds);

    const zoomend = map.on.mock.calls.find(([name]) => name === 'zoomend')![1];
    zoomend();
    expect(map.project).toHaveBeenLastCalledWith(expect.anything(), 14);
    expect(map.setMaxBounds).toHaveBeenCalledTimes(2);
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
        fitOptions={() => fitOptions}
        focusFitOptions={() => fitOptions}
      />,
    );

    expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.setView).toHaveBeenCalledWith({ lat: 36.41, lng: 139.1 }, 15.5, {
      animate: false,
    });
  });

  it('選択中にシートの余白が変わっても移動をやり直さず、範囲と下限の張り直しは移動の終了後に1回だけ行う', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(15);
    map.project.mockReturnValue(point(200, 400));
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    const props = {
      initialCenter: [36.4, 139.0] as [number, number],
      initialZoom: 15,
      focusCenter: [36.41, 139.1] as [number, number],
      focusKey: 101,
      focusZoom: 16,
      maxBounds,
      minZoom: 10.5,
    };
    const { rerender } = render(
      <MapViewportController
        {...props}
        fitOptions={() => ({
          paddingTopLeft: [16, 136],
          paddingBottomRight: [16, 367],
        })}
      />,
    );
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    const minZoomCalls = map.setMinZoom.mock.calls.length;

    for (const bottom of [400, 450, 508]) {
      rerender(
        <MapViewportController
          {...props}
          fitOptions={() => ({
            paddingTopLeft: [16, 136],
            paddingBottomRight: [16, bottom],
          })}
        />,
      );
    }
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(map.setMinZoom).toHaveBeenCalledTimes(minZoomCalls);

    const [event, onMoveEnd] = map.once.mock.calls[0];
    expect(event).toBe('moveend');
    onMoveEnd();
    expect(map.setMinZoom).toHaveBeenCalledTimes(minZoomCalls + 1);
  });

  describe('ズームが変わらない選択', () => {
    const renderSelection = () =>
      render(
        <MapViewportController
          focusCenter={[36.41, 139.1]}
          focusKey={101}
          focusZoom={16}
          maxBounds={maxBounds}
          minZoom={10.5}
          fitOptions={() => ({
            paddingTopLeft: [0, 0],
            paddingBottomRight: [0, 0],
          })}
          focusFitOptions={() => ({
            paddingTopLeft: [0, 0],
            paddingBottomRight: [0, 0],
          })}
        />,
      );
    beforeEach(() => {
      map.getBoundsZoom.mockReturnValue(12);
      map.getZoom.mockReturnValue(16);
      map.getSize.mockReturnValue(point(390, 844));
      map.getCenter.mockReturnValue({ lat: 0, lng: 0 });
      map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    });

    it('画面内で届く距離は拡大縮小せずに平行移動する', () => {
      map.project.mockImplementation(({ lat }: { lat: number }) =>
        lat === 0 ? point(500, 400) : point(560, 300),
      );
      renderSelection();
      expect(map.flyTo).not.toHaveBeenCalled();
      expect(map.panBy).toHaveBeenCalledWith(
        expect.objectContaining({ x: 60, y: -100 }),
        { duration: 0.6 },
      );
    });

    it('移動量が0なら動かさない', () => {
      map.project.mockReturnValue(point(500, 400));
      renderSelection();
      expect(map.flyTo).not.toHaveBeenCalled();
      expect(map.panBy).not.toHaveBeenCalled();
    });

    it('画面外まで離れていればflyToにする', () => {
      map.project.mockImplementation(({ lat }: { lat: number }) =>
        lat === 0 ? point(500, 400) : point(3000, 400),
      );
      renderSelection();
      expect(map.panBy).not.toHaveBeenCalled();
      expect(map.flyTo).toHaveBeenCalledTimes(1);
    });
  });

  it('下余白に focusExtraBottom の分を足した可視領域の中央へ向かう', () => {
    map.getBoundsZoom.mockReturnValue(12);
    map.getZoom.mockReturnValue(16);
    map.getSize.mockReturnValue(point(390, 844));
    map.getCenter.mockReturnValue({ lat: 0, lng: 0 });
    map.project.mockImplementation(({ lat }: { lat: number }) =>
      lat === 0 ? point(500, 400) : point(520, 420),
    );
    map.unproject.mockReturnValue({ lat: 36.41, lng: 139.1 });
    render(
      <MapViewportController
        focusCenter={[36.41, 139.1]}
        focusKey={1}
        focusZoom={16}
        maxBounds={maxBounds}
        minZoom={10.5}
        fitOptions={() => fitOptions}
        focusFitOptions={() => ({
          paddingTopLeft: [0, 0],
          paddingBottomRight: [0, 20],
        })}
        focusExtraBottom={() => 100}
      />,
    );
    // 下余白は 20+100。可視領域の中心が 60px 上にあるぶん、中心点は下へ寄る
    expect(map.unproject.mock.calls[0]![0].y).toBe(420 + 60);
  });

  describe('ズーム・移動中のリサイズ', () => {
    function mountWithObserver() {
      map.getBoundsZoom.mockReturnValue(14);
      render(
        <MapViewportController
          fitBounds={initialBounds}
          maxBounds={maxBounds}
          minZoom={12}
          fitOptions={() => fitOptions}
        />,
      );
      map.invalidateSize.mockClear();
      map.fitBounds.mockClear();
      return MockResizeObserver.instances.at(-1)!;
    }
    const zoomEndHandlers = () =>
      map.on.mock.calls
        .filter(([event]) => event === 'zoomend')
        .map(([, handler]) => handler as () => void);

    it('ズームのアニメーション中は反映を保留し、zoomend の後に1回だけ反映する', () => {
      const observer = mountWithObserver();
      Object.assign(map, { _animatingZoom: true });

      observer.trigger();
      observer.trigger();
      expect(map.invalidateSize).not.toHaveBeenCalled();
      expect(map.fitBounds).not.toHaveBeenCalled();

      Object.assign(map, { _animatingZoom: false });
      for (const handler of zoomEndHandlers()) handler();
      expect(map.invalidateSize).toHaveBeenCalledTimes(1);
      expect(map.fitBounds).toHaveBeenCalledTimes(1);

      for (const handler of zoomEndHandlers()) handler();
      expect(map.invalidateSize).toHaveBeenCalledTimes(1);
      delete (map as { _animatingZoom?: boolean })._animatingZoom;
    });

    it('アニメーションしていなければ即座に、内容を動かさず(pan:false)反映する', () => {
      const observer = mountWithObserver();
      observer.trigger();
      expect(map.invalidateSize).toHaveBeenCalledTimes(1);
      expect(map.invalidateSize).toHaveBeenCalledWith({
        animate: false,
        pan: false,
      });
    });
  });
});
