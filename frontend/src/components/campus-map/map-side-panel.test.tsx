import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AreaExhibitionListState } from './area-exhibition-list';
import { MapSidePanel, type MapSidePanelProps } from './map-side-panel';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

const UNSELECTED_LIST_STATE: AreaExhibitionListState = { kind: 'unselected' };

function baseProps(
  overrides: Partial<MapSidePanelProps> = {},
): MapSidePanelProps {
  return {
    search: {
      keyword: '',
      categories: [],
      onKeywordChange: vi.fn(),
      onCategoriesChange: vi.fn(),
    },
    listState: UNSELECTED_LIST_STATE,
    ...overrides,
  };
}

/** matchMedia を指定した一致結果でスタブする。テストごとに後始末する */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: '(min-width: 768px)',
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  return mql;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MapSidePanel', () => {
  it('renders the search panel and the exhibition list', () => {
    stubMatchMedia(true);
    render(<MapSidePanel {...baseProps()} />);

    expect(
      screen.getByRole('searchbox', { name: '企画を検索' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '地図上のブロックをタップすると、そこで開催している企画が表示されます',
      ),
    ).toBeInTheDocument();
  });

  it('is visible to assistive tech and keyboard at/above the breakpoint', () => {
    stubMatchMedia(true);
    const { container } = render(<MapSidePanel {...baseProps()} />);
    const panel = container.firstElementChild as HTMLElement;

    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(panel).not.toHaveAttribute('inert');
    expect(panel).toHaveClass('hidden', 'md:flex');
  });

  it('is excluded from assistive tech and keyboard focus below the breakpoint', () => {
    stubMatchMedia(false);
    const { container } = render(<MapSidePanel {...baseProps()} />);
    const panel = container.firstElementChild as HTMLElement;

    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveAttribute('inert');
    // role クエリの既定は aria-hidden 配下を除外するため、Tab 対象からの除外を兼ねて確認する
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('draws a divider between the search panel and the exhibition list', () => {
    stubMatchMedia(true);
    render(<MapSidePanel {...baseProps()} />);
    expect(screen.getByTestId('panel-divider')).toBeInTheDocument();
  });

  it('forwards an optional notice to the exhibition list', () => {
    stubMatchMedia(true);
    render(
      <MapSidePanel
        {...baseProps({ notice: 'エリア情報の取得に失敗しました' })}
      />,
    );
    expect(
      screen.getByText('エリア情報の取得に失敗しました'),
    ).toBeInTheDocument();
  });
});
