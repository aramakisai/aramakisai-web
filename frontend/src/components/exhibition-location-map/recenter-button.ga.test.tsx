import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const { sendGaEvent } = vi.hoisted(() => ({ sendGaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ sendGaEvent }));
vi.mock('react-leaflet', () => ({ useMap: () => ({ fitBounds: vi.fn() }) }));

import { RecenterButton } from './recenter-button';

it('再中心化ボタンで location_map/recenter を送る', () => {
  render(<RecenterButton bounds={{ southWest: [0, 0], northEast: [1, 1] }} />);
  fireEvent.click(screen.getByRole('button', { name: '企画位置に戻す' }));
  expect(sendGaEvent).toHaveBeenCalledWith('location_map', {
    result: 'recenter',
  });
});
