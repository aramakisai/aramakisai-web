import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AreaOption } from '@/lib/exhibitions';
import type { AreaExhibitionListState } from './area-exhibition-list';
import { MapSidePanel, type MapSidePanelProps } from './map-side-panel';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

const AREAS: readonly AreaOption[] = [
  { id: 1, name: '中央エリア' },
  { id: 2, name: '南エリア' },
];

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
    areas: AREAS,
    selectedAreaId: null,
    onSelectArea: vi.fn(),
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
  it('renders the search panel, an area selector, and the exhibition list', () => {
    stubMatchMedia(true);
    render(<MapSidePanel {...baseProps()} />);

    expect(
      screen.getByRole('searchbox', { name: '企画を検索' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'エリアを選択' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '中央エリア' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '地図上のブロックをタップすると、そこで開催している企画が表示されます',
      ),
    ).toBeInTheDocument();
  });

  it('selects an unselected area on click', () => {
    stubMatchMedia(true);
    const onSelectArea = vi.fn();
    render(<MapSidePanel {...baseProps({ onSelectArea })} />);

    fireEvent.click(screen.getByRole('button', { name: '中央エリア' }));
    expect(onSelectArea).toHaveBeenCalledWith(1);
  });

  it('deselects the already-selected area on click (single-select toggle)', () => {
    stubMatchMedia(true);
    const onSelectArea = vi.fn();
    render(
      <MapSidePanel {...baseProps({ selectedAreaId: 1, onSelectArea })} />,
    );

    const button = screen.getByRole('button', { name: '中央エリア' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onSelectArea).toHaveBeenCalledWith(null);
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
    expect(
      screen.queryByRole('button', { name: '中央エリア' }),
    ).not.toBeInTheDocument();
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
