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

  it('拡大/縮小ボタンにアクセシブルな名前を与える', () => {
    render(<MapZoomControl />);
    const props = zoomControlProps.at(-1)!;
    expect(props.zoomInTitle).toBe('拡大');
    expect(props.zoomOutTitle).toBe('縮小');
  });

  it('Figma のカスタムアイコンをボタンに使う (既定の +/− テキストではない)', () => {
    render(<MapZoomControl />);
    const props = zoomControlProps.at(-1)!;
    expect(props.zoomInText).toContain('<svg');
    expect(props.zoomOutText).toContain('<svg');
  });
});
