import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { CampusMapArea } from '@/lib/campus-map';
import type { ExhibitionDetail } from '@/lib/exhibitions';
import type { ExhibitionLocationMapProps } from './exhibition-location-map';

// exhibition-location-map.ts は campus-map.ts 経由で cms.ts (env.ts の起動時検証を含む) に
// 依存するため、campus-map.test.ts / exhibitions.test.ts と同様にモックする
vi.mock('@/lib/cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

// leaflet 依存の地図本体を描画せず、ExhibitionLocationSection が渡す props の検証に絞る
vi.mock('./exhibition-location-map', () => ({
  ExhibitionLocationMap: (props: ExhibitionLocationMapProps) => (
    <div
      data-testid="location-map"
      data-area-names={props.areaNames.join(',')}
      data-map-href={props.mapHref}
    />
  ),
}));

import { ExhibitionLocationSection } from './exhibition-location-section';

function area(overrides: Partial<CampusMapArea> = {}): CampusMapArea {
  return {
    id: 1,
    name: 'Aゾーン',
    color: 'primary',
    sort: 0,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 36.43],
          [139.001, 36.43],
          [139.001, 36.431],
          [139.0, 36.431],
          [139.0, 36.43],
        ],
      ],
    },
    ...overrides,
  };
}

function exhibition(overrides: Partial<ExhibitionDetail> = {}): ExhibitionDetail {
  return {
    id: 1,
    category: 'exhibit',
    displayName: '写真部 作品展',
    organizationName: '写真部',
    location: 'Aゾーン・ブース1',
    areaIds: [1],
    thumbnail: null,
    description: null,
    images: [],
    links: [],
    categories: ['exhibit'],
    ...overrides,
  };
}

describe('ExhibitionLocationSection', () => {
  it('対象エリアを解決できる企画では地図とキャプションを描画する (要件 1.3, 1.8)', () => {
    const { container } = render(
      <ExhibitionLocationSection exhibition={exhibition()} areas={[area()]} />,
    );

    expect(screen.getByTestId('location-map')).toBeInTheDocument();
    expect(screen.getByText('Aゾーン・ブース1')).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it('所在地表記が得られない場合、キャプションに対象エリア名を用いる (要件 1.8)', () => {
    render(
      <ExhibitionLocationSection
        exhibition={exhibition({ location: null })}
        areas={[area()]}
      />,
    );

    expect(screen.getByText('Aゾーン')).toBeInTheDocument();
  });

  it('企画のエリア ID が対象エリアを解決できない場合、自身を描画しない (要件 4.1)', () => {
    const { container } = render(
      <ExhibitionLocationSection
        exhibition={exhibition({ areaIds: [999] })}
        areas={[area()]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('区画データが得られなかった場合、自身を描画しない (要件 4.2)', () => {
    const { container } = render(
      <ExhibitionLocationSection exhibition={exhibition()} areas={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('構内マップページへの遷移リンクを、遷移先が判別できる文言とキーボード到達可能な形で置く (要件 3.1, 3.5, 6.4)', () => {
    render(
      <ExhibitionLocationSection exhibition={exhibition()} areas={[area()]} />,
    );

    const link = screen.getByRole('link', { name: '構内マップで見る' });
    expect(link).toHaveAttribute('href', '/map?area=1');
    expect(link.tagName).toBe('A');
  });

  it('複数の対象エリアがある場合、すべてのエリア名を地図へ渡す (要件 1.5)', () => {
    render(
      <ExhibitionLocationSection
        exhibition={exhibition({ areaIds: [1, 2] })}
        areas={[area(), area({ id: 2, name: 'Bゾーン' })]}
      />,
    );

    expect(screen.getByTestId('location-map')).toHaveAttribute(
      'data-area-names',
      'Aゾーン,Bゾーン',
    );
  });
});
