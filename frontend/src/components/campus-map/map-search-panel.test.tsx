import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapSearchPanel, type MapSearchProps } from './map-search-panel';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

function baseProps(overrides: Partial<MapSearchProps> = {}): MapSearchProps {
  return {
    keyword: '',
    categories: [],
    onKeywordChange: vi.fn(),
    onCategoriesChange: vi.fn(),
    ...overrides,
  };
}

describe('MapSearchPanel', () => {
  it('renders the keyword input bound to the current value', () => {
    render(<MapSearchPanel {...baseProps({ keyword: 'ロボット' })} />);
    expect(screen.getByRole('searchbox', { name: '企画を検索' })).toHaveValue(
      'ロボット',
    );
  });

  it('reports every keystroke immediately without trimming (debounce is the hook’s job)', () => {
    const onKeywordChange = vi.fn();
    render(<MapSearchPanel {...baseProps({ onKeywordChange })} />);

    fireEvent.change(screen.getByRole('searchbox', { name: '企画を検索' }), {
      target: { value: ' ロボット' },
    });

    expect(onKeywordChange).toHaveBeenCalledWith(' ロボット');
  });

  it('prefixes the input id so it never collides with the smartphone search overlay', () => {
    render(<MapSearchPanel {...baseProps()} />);
    const input = screen.getByRole('searchbox', { name: '企画を検索' });
    expect(input.id).toMatch(/^map-search-panel-/);
  });

  it('offers an "all" chip plus one toggle per category matching the CMS category definition, in order', () => {
    render(<MapSearchPanel {...baseProps()} />);
    const group = screen.getByRole('group', { name: 'カテゴリで絞り込み' });
    expect(
      Array.from(group.querySelectorAll('button')).map((b) => b.textContent),
    ).toEqual(['すべて', 'ステージ', '展示', '出店', 'その他']);
  });

  it('marks the currently applied categories as pressed', () => {
    render(<MapSearchPanel {...baseProps({ categories: ['stage'] })} />);
    expect(screen.getByRole('button', { name: 'ステージ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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
    render(<MapSearchPanel {...baseProps({ categories: [] })} />);
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clears the category selection when "all" is clicked', () => {
    const onCategoriesChange = vi.fn();
    render(
      <MapSearchPanel
        {...baseProps({ categories: ['stage'], onCategoriesChange })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'すべて' }));
    expect(onCategoriesChange).toHaveBeenCalledWith([]);
  });

  it('adds a category when an unpressed toggle is clicked', () => {
    const onCategoriesChange = vi.fn();
    render(
      <MapSearchPanel
        {...baseProps({ categories: ['stage'], onCategoriesChange })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    expect(onCategoriesChange).toHaveBeenCalledWith(['stage', 'exhibit']);
  });

  it('removes a category when its pressed toggle is clicked', () => {
    const onCategoriesChange = vi.fn();
    render(
      <MapSearchPanel
        {...baseProps({ categories: ['stage', 'exhibit'], onCategoriesChange })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));
    expect(onCategoriesChange).toHaveBeenCalledWith(['exhibit']);
  });
});
