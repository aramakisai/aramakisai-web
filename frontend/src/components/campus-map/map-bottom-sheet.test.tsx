import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapBottomSheet } from './map-bottom-sheet';
import type { AreaExhibitionListState } from './area-exhibition-list';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('MapBottomSheet', () => {
  it('renders the list content passed via state', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(<MapBottomSheet state={state} />);
    expect(screen.getByText(/エリアを選/)).toBeInTheDocument();
  });

  it('shrinks to content height when no condition is applied (要件 5.3)', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { getByTestId } = render(<MapBottomSheet state={state} />);
    expect(getByTestId('map-bottom-sheet').className).not.toMatch(
      /overflow-y-auto/,
    );
  });

  it('expands to a fixed scrollable height once any condition applies', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'no-area' };
    const { getByTestId } = render(<MapBottomSheet state={state} />);
    expect(getByTestId('map-bottom-sheet').className).toMatch(
      /overflow-y-auto/,
    );
  });

  it('lets the map receive pointer events outside the sheet itself', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container, getByTestId } = render(<MapBottomSheet state={state} />);
    expect((container.firstChild as HTMLElement).className).toMatch(
      /pointer-events-none/,
    );
    expect(getByTestId('map-bottom-sheet').className).toMatch(
      /pointer-events-auto/,
    );
  });

  it('stays reachable by assistive tech and keyboard below the breakpoint', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<MapBottomSheet state={state} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).not.toHaveAttribute('inert');
  });

  it('is excluded from assistive tech and the tab order at/above the breakpoint', () => {
    mockMatchMedia(true);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<MapBottomSheet state={state} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).toHaveAttribute('inert');
  });

  it('hides itself at/above the breakpoint via the shared MAP_BREAKPOINT prefix', () => {
    mockMatchMedia(true);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<MapBottomSheet state={state} />);
    expect((container.firstChild as HTMLElement).className).toMatch(
      /md:hidden/,
    );
  });

  it('forwards an optional notice to the exhibition list', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(
      <MapBottomSheet state={state} notice="エリア情報の取得に失敗しました" />,
    );
    expect(
      screen.getByText('エリア情報の取得に失敗しました'),
    ).toBeInTheDocument();
  });
});
