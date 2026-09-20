import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AreaExhibitionList,
  buildListHeading,
  type AreaExhibitionListState,
} from './area-exhibition-list';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

function card(
  overrides: Partial<ExhibitionCardSummary>,
): ExhibitionCardSummary {
  return {
    id: 1,
    category: 'exhibit',
    displayName: '企画名',
    organizationName: '団体名',
    location: null,
    areaIds: [1],
    thumbnail: null,
    ...overrides,
  };
}

describe('buildListHeading', () => {
  it('formats an area-only heading as area name plus a separate count', () => {
    const heading = buildListHeading({
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: '',
      categories: [],
      items: [card({})],
    });
    expect(heading).toEqual({ heading: '中央エリア', count: '1件の企画' });
  });

  it('appends the keyword and category labels when they are also applied', () => {
    const heading = buildListHeading({
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: 'ロボット',
      categories: ['stage', 'exhibit'],
      items: [card({}), card({ category: 'stage' })],
    });
    expect(heading).toEqual({
      heading: '中央エリア 「ロボット」 ステージ・展示',
      count: '2件の企画',
    });
  });

  it('omits the area segment when no area is selected', () => {
    const heading = buildListHeading({
      kind: 'filtered',
      areaName: null,
      keyword: 'ロボット',
      categories: [],
      items: [],
    });
    expect(heading).toEqual({ heading: '「ロボット」', count: '0件の企画' });
  });
});

describe('AreaExhibitionList', () => {
  it('shows guidance to pick an area when no condition is applied', () => {
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(<AreaExhibitionList state={state} />);
    expect(screen.getByText(/エリアを選/)).toBeInTheDocument();
  });

  it('shows a distinct message when no area is registered', () => {
    const state: AreaExhibitionListState = { kind: 'no-area' };
    render(<AreaExhibitionList state={state} />);
    expect(screen.getByText(/登録されていません/)).toBeInTheDocument();
  });

  it('shows the error message and distinguishes it from the empty-result guidance', () => {
    const state: AreaExhibitionListState = {
      kind: 'error',
      message: '出展物の取得に失敗しました',
    };
    render(<AreaExhibitionList state={state} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '出展物の取得に失敗しました',
    );
  });

  it('renders one tile per exhibition-card summary with a heading built from the state', () => {
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: '',
      categories: [],
      items: [
        card({ id: 1, displayName: '企画A' }),
        card({ id: 2, displayName: '企画B' }),
      ],
    };
    render(<AreaExhibitionList state={state} />);
    expect(
      screen.getByRole('heading', { level: 2, name: '中央エリア' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2件の企画')).toBeInTheDocument();
    expect(screen.getByText('企画A')).toBeInTheDocument();
    expect(screen.getByText('企画B')).toBeInTheDocument();
  });

  it('uses id + category as the tile key so a multi-category exhibition renders one tile per category', () => {
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: '',
      categories: [],
      items: [
        card({ id: 5, category: 'exhibit', displayName: '企画名 (展示)' }),
        card({ id: 5, category: 'vendor', displayName: '企画名 (出店)' }),
      ],
    };
    render(<AreaExhibitionList state={state} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('shows the area-empty message when the area alone yields no items', () => {
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: '',
      categories: [],
      items: [],
    };
    render(<AreaExhibitionList state={state} />);
    expect(
      screen.getByText('このエリアに出展物はありません'),
    ).toBeInTheDocument();
  });

  it('shows a condition-change prompt when a keyword or category yields no items', () => {
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: null,
      keyword: '見つからない語句',
      categories: [],
      items: [],
    };
    render(<AreaExhibitionList state={state} />);
    expect(
      screen.getByText(/条件に一致する出展物はありません/),
    ).toBeInTheDocument();
  });

  it('draws a divider between the heading and the tiles when an area is selected', () => {
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: '',
      categories: [],
      items: [card({})],
    };
    render(<AreaExhibitionList state={state} />);
    expect(screen.getByTestId('list-divider')).toBeInTheDocument();
  });

  it('draws the divider even when the filtered result is empty', () => {
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: '中央エリア',
      keyword: '',
      categories: [],
      items: [],
    };
    render(<AreaExhibitionList state={state} />);
    expect(screen.getByTestId('list-divider')).toBeInTheDocument();
  });

  it('omits the divider when no heading is shown', () => {
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(<AreaExhibitionList state={state} />);
    expect(screen.queryByTestId('list-divider')).not.toBeInTheDocument();
  });

  it('places the list body in a live region so updates are announced to assistive tech', () => {
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<AreaExhibitionList state={state} />);
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('shows an optional notice alongside the normal content instead of replacing it', () => {
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(
      <AreaExhibitionList
        state={state}
        notice="エリア情報の取得に失敗しました。地図はそのままご利用いただけます。"
      />,
    );
    expect(
      screen.getByText(
        'エリア情報の取得に失敗しました。地図はそのままご利用いただけます。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/エリアを選/)).toBeInTheDocument();
  });
});
