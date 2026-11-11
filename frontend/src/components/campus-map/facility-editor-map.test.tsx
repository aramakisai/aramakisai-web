import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('./campus-map-view', () => ({
  CampusMapView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-leaflet', () => ({
  Marker: ({
    title,
    eventHandlers,
    draggable,
    zIndexOffset,
  }: {
    title: string;
    draggable: boolean;
    zIndexOffset: number;
    eventHandlers: { click: () => void; dragend: (event: unknown) => void };
  }) => (
    <div>
      <button
        data-testid="facility-marker"
        data-z-index-offset={zIndexOffset}
        onClick={eventHandlers.click}
      >
        {title}
      </button>
      {draggable && (
        <button
          onClick={() =>
            eventHandlers.dragend({
              target: { getLatLng: () => ({ lat: 36.43, lng: 139.045 }) },
            })
          }
        >
          {title}を移動
        </button>
      )}
    </div>
  ),
}));

import { FacilityEditorMap } from './facility-editor-map';

describe('開発用施設配置確認', () => {
  it('11地点を表示し、選択・移動後の座標をCSVに反映する', () => {
    render(<FacilityEditorMap areas={[]} points={[]} />);
    expect(screen.getByText('一般受付 1')).toBeInTheDocument();
    expect(screen.getByText('一般受付 2')).toBeInTheDocument();
    expect(screen.getByText('ごみステーション 8')).toBeInTheDocument();
    expect(
      screen.getByText('ママタルトお笑いライブ専用受付'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /を移動$/ })).toHaveLength(11);
    expect(screen.getAllByTestId('facility-marker')).toHaveLength(11);
    for (const marker of screen.getAllByTestId('facility-marker')) {
      expect(
        Number(marker.getAttribute('data-z-index-offset')),
      ).toBeGreaterThan(0);
    }

    fireEvent.click(screen.getByRole('button', { name: '一般受付 1' }));
    expect(screen.getByText('36.431400, 139.044100')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '一般受付 1を移動' }));
    expect(screen.getByText('36.430000, 139.045000')).toBeInTheDocument();

    const href = screen
      .getByRole('link', { name: 'CSVをダウンロード' })
      .getAttribute('href')!;
    const csv = decodeURIComponent(href.split(',')[1]);
    expect(csv).toContain('一般受付 1,受付,36.430000,139.045000,未確定');
    expect(csv.trim().split('\r\n')).toHaveLength(12);
  });
});
