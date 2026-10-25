import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampusMapDataResult } from '@/lib/campus-map';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

vi.mock('@/lib/analytics', () => ({ sendGaEvent: vi.fn() }));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));
vi.mock('@/lib/cms-asset-url', () => ({ toAssetUrl: () => null }));

const state = vi.hoisted(() => ({
  viewProps: [] as Record<string, unknown>[],
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockedView(props: Record<string, unknown>) {
      state.viewProps.push(props);
      const ref = props.mapRef as { current: unknown };
      ref.current = { zoomIn: state.zoomIn, zoomOut: state.zoomOut };
      return (
        <button onClick={() => (props.onSelectArea as (n: number) => void)(1)}>
          select-area-1
        </button>
      ) as ReactNode;
    },
}));

import { TouchMap } from './touch-map';

function card(o: Partial<ExhibitionCardSummary>): ExhibitionCardSummary {
  return {
    id: 1,
    category: 'exhibit',
    displayName: '企画A',
    organizationName: '団体',
    location: null,
    areaIds: [1],
    thumbnail: null,
    ...o,
  };
}

const data: CampusMapDataResult = {
  areas: {
    kind: 'loaded',
    value: [
      {
        id: 1,
        name: '1号館',
        color: 'primary',
        geometry: { type: 'MultiPolygon', coordinates: [] },
        hasAed: true,
        hasToilet: false,
      },
    ],
  },
  exhibitions: {
    kind: 'loaded',
    value: [
      card({ id: 1 }),
      card({ id: 2, category: 'stage', displayName: '企画B' }),
    ],
  },
  points: [],
};

beforeEach(() => {
  state.viewProps.length = 0;
  state.zoomIn.mockClear();
  state.zoomOut.mockClear();
});

describe('TouchMap', () => {
  it('現在地とLeaflet標準のズームを出さない指定で地図を描く', () => {
    render(<TouchMap data={data} />);
    const props = state.viewProps.at(-1)!;
    expect(props.showUserLocation).toBe(false);
    expect(props.showZoomControl).toBe(false);
  });

  it('ハンバーガー・検索欄を描画しない', () => {
    render(<TouchMap data={data} />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('未選択ではエリア選択の案内を出す', () => {
    render(<TouchMap data={data} />);
    expect(screen.getByText('エリアを選択してください')).toBeInTheDocument();
  });

  it('エリアを選ぶと企画一覧が出て、カテゴリで絞れる', () => {
    render(<TouchMap data={data} />);
    fireEvent.click(screen.getByText('select-area-1'));
    expect(screen.getByText('企画A')).toBeInTheDocument();
    expect(screen.getByText('企画B')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    expect(screen.getByText('企画A')).toBeInTheDocument();
    expect(screen.queryByText('企画B')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '出店' }));
    expect(
      screen.getByText(
        '条件に一致する出展物はありません。条件を変更してください',
      ),
    ).toBeInTheDocument();
  });

  it('絞り込みはURLへ書かない', () => {
    const push = vi.spyOn(window.history, 'pushState');
    render(<TouchMap data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('拡大・縮小のボタンが地図のzoomIn・zoomOutを呼ぶ', () => {
    render(<TouchMap data={data} />);
    fireEvent.click(screen.getByRole('button', { name: '拡大' }));
    fireEvent.click(screen.getByRole('button', { name: '縮小' }));
    expect(state.zoomIn).toHaveBeenCalledTimes(1);
    expect(state.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('marks the left panel for the map fit and passes the bottom inset', () => {
    state.viewProps.length = 0;
    const { container } = render(<TouchMap data={data} />);
    expect(container.querySelector('[data-map-side-panel]')).not.toBeNull();
    expect(state.viewProps.at(-1)?.fitBottomInset).toBe(200);
    expect(state.viewProps.at(-1)?.maxBoundsPad).toBeGreaterThan(0);
  });

  it('タイルの読み込み完了で、親へ描画完了を知らせる', () => {
    const postMessage = vi.fn();
    vi.spyOn(window, 'parent', 'get').mockReturnValue({
      postMessage,
    } as unknown as Window);
    state.viewProps.length = 0;
    render(<TouchMap data={data} />);
    (state.viewProps.at(-1)?.onTilesLoaded as () => void)();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signage-touch-ready' }),
      window.location.origin,
    );
    vi.restoreAllMocks();
  });
});
