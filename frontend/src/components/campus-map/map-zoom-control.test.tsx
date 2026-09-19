import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const zoomControlProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  ZoomControl: (props: Record<string, unknown>) => {
    zoomControlProps.push(props);
    return <div data-testid="zoom-control" />;
  },
}));

import { MapZoomControl } from './map-zoom-control';

describe('MapZoomControl', () => {
  it('デスクトップの左ペインとモバイルのボトムシートに重ならない位置に置く', () => {
    render(<MapZoomControl />);
    expect(zoomControlProps.at(-1)!.position).toBe('bottomright');
  });
});
