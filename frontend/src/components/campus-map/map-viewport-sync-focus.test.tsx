import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';
import { MapViewportSync } from './map-viewport-sync';

const controllerProps: Record<string, unknown>[] = [];
vi.mock('@/components/map/map-viewport-controller', () => ({
  MapViewportController: (props: Record<string, unknown>) => {
    controllerProps.push(props);
    return null;
  },
}));

it('焦点の中心とキーに最大ネイティブズームを添えてコントローラへ渡す', () => {
  render(
    <MapViewportSync
      fitBounds={[
        [0, 0],
        [1, 1],
      ]}
      focusCenter={[0.5, 0.5]}
      focusKey={3}
      refocusKey="desktop"
    />,
  );
  const props = controllerProps.at(-1)!;
  expect(props.focusCenter).toEqual([0.5, 0.5]);
  expect(props.focusKey).toBe(3);
  expect(props.focusZoom).toBe(CAMPUS_MAP_CONFIG.maxNativeZoom);
  expect(props.refocusKey).toBe('desktop');
  expect(typeof props.focusFitOptions).toBe('function');
});
