import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { map as createMap, type Map as LeafletMap } from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  UseUserLocationOptions,
  UseUserLocationResult,
} from './use-user-location';

const hook = vi.hoisted(() => ({
  result: null as unknown as UseUserLocationResult,
  options: null as unknown as UseUserLocationOptions,
}));
const mapRef = vi.hoisted(() => ({ current: null as unknown }));
const paneProps: Record<string, unknown>[] = [];
const circleProps: Record<string, unknown>[] = [];
const markerProps: Record<string, unknown>[] = [];

vi.mock('./use-user-location', () => ({
  useUserLocation: (options: UseUserLocationOptions) => {
    hook.options = options;
    return hook.result;
  },
}));

vi.mock('react-leaflet', () => ({
  useMap: () => mapRef.current,
  Pane: (props: Record<string, unknown>) => {
    paneProps.push(props);
    return <div data-testid="pane">{props.children as never}</div>;
  },
  Circle: (props: Record<string, unknown>) => {
    circleProps.push(props);
    return <div data-testid="circle" />;
  },
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props);
    return <div data-testid="marker" />;
  },
}));

import { MapUserLocation } from './map-user-location';

const LOCATION = { latitude: 36.43, longitude: 139.0, accuracy: 25 };
const start = vi.fn();
let map: LeafletMap;

function setHook(partial: Partial<UseUserLocationResult>) {
  hook.result = {
    state: { kind: 'idle' },
    failureCount: 0,
    start,
    ...partial,
  };
}

describe('MapUserLocation', () => {
  beforeEach(() => {
    start.mockClear();
    paneProps.length = 0;
    circleProps.length = 0;
    markerProps.length = 0;
    map = createMap(document.body.appendChild(document.createElement('div')));
    map.setView([36.4, 139.0], 18);
    mapRef.current = map;
    setHook({});
  });

  afterEach(() => {
    map.remove();
  });

  it('現在地ボタンを bottomright のコントロール角に置き、アンマウントで取り除く', () => {
    const { unmount } = render(<MapUserLocation />);
    const corner = document.querySelector('.leaflet-bottom.leaflet-right')!;
    const control = corner.querySelector('.map-locate-control');
    expect(control).not.toBeNull();
    expect(control!.querySelector('button')).not.toBeNull();
    unmount();
    expect(corner.querySelector('.map-locate-control')).toBeNull();
  });

  it('ボタンの名前と押下状態が取得状態に追従する', () => {
    const { rerender } = render(<MapUserLocation />);
    const button = screen.getByRole('button', { name: '現在地を表示' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.style.color).toBe('');
    setHook({ state: { kind: 'watching', location: null } });
    rerender(<MapUserLocation />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.style.color).toBe('rgb(235, 176, 60)');
  });

  it('未取得でクリックすると取得を開始する', () => {
    render(<MapUserLocation />);
    fireEvent.click(screen.getByRole('button', { name: '現在地を表示' }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('button は Enter で押せる要素である', () => {
    render(<MapUserLocation />);
    const button = screen.getByRole('button', { name: '現在地を表示' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('取得中で現在地があるときのクリックは縮尺を変えず中心だけ移し、開始は呼ばない', () => {
    setHook({ state: { kind: 'watching', location: LOCATION } });
    const panTo = vi.spyOn(map, 'panTo');
    const zoom = map.getZoom();
    render(<MapUserLocation />);
    fireEvent.click(screen.getByRole('button', { name: '現在地を表示' }));
    expect(panTo).toHaveBeenCalledWith([36.43, 139.0], { animate: false });
    expect(map.getZoom()).toBe(zoom);
    expect(start).not.toHaveBeenCalled();
  });

  it('取得中で現在地がまだ無いときのクリックは何もしない', () => {
    setHook({ state: { kind: 'watching', location: null } });
    const panTo = vi.spyOn(map, 'panTo');
    render(<MapUserLocation />);
    fireEvent.click(screen.getByRole('button', { name: '現在地を表示' }));
    expect(panTo).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('初回通知で縮尺を変えず中心を移す', () => {
    const panTo = vi.spyOn(map, 'panTo');
    render(<MapUserLocation />);
    hook.options.onFirstLocation(LOCATION);
    expect(panTo).toHaveBeenCalledWith([36.43, 139.0], { animate: false });
  });

  it('現在地が無いときはマーカーを描かない', () => {
    setHook({ state: { kind: 'watching', location: null } });
    render(<MapUserLocation />);
    expect(screen.queryByTestId('circle')).toBeNull();
    expect(screen.queryByTestId('marker')).toBeNull();
  });

  it('現在地があるときだけ、z-index 625 の専用の層に精度円と点を操作不能で描く', () => {
    setHook({ state: { kind: 'watching', location: LOCATION } });
    render(<MapUserLocation />);
    expect(paneProps.at(-1)!.style).toEqual({ zIndex: 625 });
    const circle = circleProps.at(-1)!;
    expect(circle.radius).toBe(25);
    expect(circle.center).toEqual([36.43, 139.0]);
    expect(circle.pathOptions).toMatchObject({
      weight: 1,
      color: '#1a73e8',
      fillColor: '#1a73e826',
      interactive: false,
    });
    const marker = markerProps.at(-1)!;
    expect(marker.position).toEqual([36.43, 139.0]);
    expect(marker.interactive).toBe(false);
    expect(marker.keyboard).toBe(false);
  });

  it('失敗が無いうちはトーストを出さない', () => {
    render(<MapUserLocation />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('失敗時は body 直下にリンク無しのトーストを出し、失敗が増えると出し直す', () => {
    vi.useFakeTimers();
    setHook({ failureCount: 1 });
    const { rerender } = render(<MapUserLocation />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('現在地を取得できませんでした');
    expect(within(toast).queryByRole('link')).toBeNull();
    expect(toast.parentElement!.parentElement).toBe(document.body);
    expect(toast.parentElement!.className).toContain('z-[1060]');

    try {
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByRole('status')).toBeNull();
      setHook({ failureCount: 2 });
      rerender(<MapUserLocation />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
