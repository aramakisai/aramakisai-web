import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecenterButtonBounds } from './recenter-button';

let mapMock: { fitBounds: ReturnType<typeof vi.fn>; getBounds: () => unknown };

vi.mock('react-leaflet', () => ({
  useMap: () => mapMock,
}));

import { RecenterButton } from './recenter-button';

const INITIAL_BOUNDS: RecenterButtonBounds = {
  southWest: [36.43, 139.0],
  northEast: [36.431, 139.001],
};

describe('RecenterButton', () => {
  beforeEach(() => {
    // 地図が移動済みの状態を模す。fitBounds が呼ばれるとその引数で上書きされる
    let currentBounds: unknown = { moved: true };
    mapMock = {
      fitBounds: vi.fn((next: unknown) => {
        currentBounds = next;
      }),
      getBounds: () => currentBounds,
    };
  });

  it('地図を移動させたのち操作すると初期表示範囲へ戻る', () => {
    render(<RecenterButton bounds={INITIAL_BOUNDS} />);

    fireEvent.click(screen.getByRole('button', { name: '企画位置に戻す' }));

    expect(mapMock.fitBounds).toHaveBeenCalledWith([
      INITIAL_BOUNDS.southWest,
      INITIAL_BOUNDS.northEast,
    ]);
    expect(mapMock.getBounds()).toEqual([
      INITIAL_BOUNDS.southWest,
      INITIAL_BOUNDS.northEast,
    ]);
  });
});
