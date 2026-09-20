import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapSearchOverlay } from './map-search-overlay';

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

describe('MapSearchOverlay', () => {
  it('binds the search box to keywordInput and reports edits via setKeywordInput', () => {
    mockMatchMedia(false);
    const setKeywordInput = vi.fn();
    render(
      <MapSearchOverlay
        keywordInput="ロボット"
        setKeywordInput={setKeywordInput}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const input = screen.getByRole('searchbox', { name: '企画を検索' });
    expect(input).toHaveValue('ロボット');
    fireEvent.change(input, { target: { value: 'ロボット2' } });
    expect(setKeywordInput).toHaveBeenCalledWith('ロボット2');
  });

  it('MapMenuButton と縦中心を揃えるための共有トークンでパディング・行の高さを指定している', () => {
    mockMatchMedia(false);
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const searchBoxLabel = screen
      .getByRole('searchbox', { name: '企画を検索' })
      .closest('label');
    expect(searchBoxLabel?.className).toMatch(
      /py-\[var\(--map-search-box-padding-y\)\]/,
    );
    expect(searchBoxLabel?.className).toMatch(
      /leading-\[var\(--map-search-box-line-height\)\]/,
    );
  });

  it('renders one chip per CMS category with the pressed state reflecting the categories prop', () => {
    mockMatchMedia(false);
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={['stage']}
        setCategories={vi.fn()}
      />,
    );
    const stage = screen.getByRole('button', { name: 'ステージ' });
    expect(stage).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '展示' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks "all" as pressed when no category is selected', () => {
    mockMatchMedia(false);
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clears the category selection when "all" is clicked', () => {
    mockMatchMedia(false);
    const setCategories = vi.fn();
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={['stage']}
        setCategories={setCategories}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'すべて' }));
    expect(setCategories).toHaveBeenCalledWith([]);
  });

  it('toggles a category on and off via setCategories without mutating the given array', () => {
    mockMatchMedia(false);
    const setCategories = vi.fn();
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={['stage']}
        setCategories={setCategories}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    expect(setCategories).toHaveBeenCalledWith(['stage', 'exhibit']);
    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));
    expect(setCategories).toHaveBeenCalledWith([]);
  });

  it('keeps the category row to a single scrollable line', () => {
    mockMatchMedia(false);
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const group = screen.getByRole('group', { name: 'カテゴリで絞り込み' });
    expect(group.className).toMatch(/overflow-x-auto/);
    expect(group.className).not.toMatch(/flex-wrap/);
  });

  it('reserves right margin for the menu button only on the search box row, not the category row', () => {
    mockMatchMedia(false);
    const { container } = render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    const searchBoxLabel = screen
      .getByRole('searchbox', {
        name: '企画を検索',
      })
      .closest('label');
    const categoryGroup = screen.getByRole('group', {
      name: 'カテゴリで絞り込み',
    });
    expect(wrapper.className).not.toMatch(/mr-14/);
    expect(searchBoxLabel?.className).toMatch(/mr-14/);
    expect(categoryGroup.className).not.toMatch(/mr-14/);
  });

  it('uses input identifiers distinct from the desktop search panel', () => {
    mockMatchMedia(false);
    render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const input = screen.getByRole('searchbox', { name: '企画を検索' });
    expect(input.id).toMatch(/^map-search-overlay-/);
  });

  it('is excluded from assistive tech and the tab order at/above the breakpoint', () => {
    mockMatchMedia(true);
    const { container } = render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).toHaveAttribute('inert');
    expect(wrapper.className).toMatch(/md:hidden/);
  });

  it('stays reachable below the breakpoint', () => {
    mockMatchMedia(false);
    const { container } = render(
      <MapSearchOverlay
        keywordInput=""
        setKeywordInput={vi.fn()}
        categories={[]}
        setCategories={vi.fn()}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).not.toHaveAttribute('inert');
  });
});
