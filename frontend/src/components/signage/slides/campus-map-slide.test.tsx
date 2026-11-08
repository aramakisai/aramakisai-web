import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignageSnapshot } from '@/lib/signage';

const seen = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function MockedView(props: Record<string, unknown>) {
      seen.props.push(props);
      return (<div data-testid="map" />) as ReactNode;
    },
}));

import { CampusMapSlide } from './campus-map-slide';

const campusMap: NonNullable<SignageSnapshot['campusMap']> = {
  areas: [
    {
      id: 1,
      name: '1号館',
      color: 'primary',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      hasAed: false,
      hasToilet: false,
    },
  ],
  points: [],
};

describe('CampusMapSlide', () => {
  beforeEach(() => {
    seen.props.length = 0;
  });

  it('画像を使わず、スナップショットの地図データで地図を描く', () => {
    const { container } = render(
      <CampusMapSlide campusMap={campusMap} installAreaId={1} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(seen.props[0]).toMatchObject({
      areas: campusMap.areas,
      points: campusMap.points,
      selectedAreaId: null,
      showUserLocation: false,
      showZoomControl: false,
      fitExcludeOutliers: true,
      installAreaId: 1,
    });
  });

  it('地図の層は inert で操作を受けない', () => {
    render(<CampusMapSlide campusMap={campusMap} installAreaId={null} />);
    expect(screen.getByTestId('map').closest('[inert]')).not.toBeNull();
  });

  it('地図の層はスタッキングコンテキストを作り Leaflet の z-index を閉じ込める', () => {
    render(<CampusMapSlide campusMap={campusMap} installAreaId={null} />);
    expect(screen.getByTestId('map').closest('[inert]')).toHaveClass('isolate');
  });

  it('見出しチップ「構内マップ」を出す', () => {
    render(<CampusMapSlide campusMap={campusMap} installAreaId={null} />);
    expect(screen.getByText('構内マップ')).toBeInTheDocument();
    expect(screen.getByText('map')).toBeInTheDocument();
  });
});
