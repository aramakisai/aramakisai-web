import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ExhibitionFilters } from './exhibition-filters';
import type { AreaOption, ExhibitionQuery } from '@/lib/exhibitions';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

const areas: readonly AreaOption[] = [
  { id: 1, name: 'A棟' },
  { id: 2, name: 'B棟' },
];

function baseQuery(overrides: Partial<ExhibitionQuery> = {}): ExhibitionQuery {
  return { q: '', categories: [], areaIds: [], page: 1, ...overrides };
}

describe('ExhibitionFilters', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onChange.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('検索欄は現在のキーワードを初期値として表示する', () => {
    render(
      <ExhibitionFilters
        query={baseQuery({ q: 'ロボット' })}
        areas={areas}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('searchbox', { name: '企画を検索' })).toHaveValue(
      'ロボット',
    );
  });

  test('キーワード入力は確定 (デバウンス) 後に 変更を通知する', () => {
    render(
      <ExhibitionFilters
        query={baseQuery()}
        areas={areas}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('searchbox', { name: '企画を検索' });

    fireEvent.change(input, { target: { value: 'ロボット' } });
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith({
      q: 'ロボット',
      categories: [],
      areaIds: [],
    });
  });

  test('キーワード変更時、ページ番号を含めず通知する (1 ページ目へ戻すため)', () => {
    render(
      <ExhibitionFilters
        query={baseQuery({ page: 3 })}
        areas={areas}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('searchbox', { name: '企画を検索' });

    fireEvent.change(input, { target: { value: 'x' } });
    vi.advanceTimersByTime(300);

    expect(onChange).toHaveBeenCalledWith({
      q: 'x',
      categories: [],
      areaIds: [],
    });
  });

  test('カテゴリチップを選ぶと即座に 変更を通知する', () => {
    render(
      <ExhibitionFilters
        query={baseQuery()}
        areas={areas}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));

    expect(onChange).toHaveBeenCalledWith({
      q: '',
      categories: ['stage'],
      areaIds: [],
    });
  });

  test('選択済みのカテゴリチップを再度選ぶと解除する', () => {
    render(
      <ExhibitionFilters
        query={baseQuery({ categories: ['stage'] })}
        areas={areas}
        onChange={onChange}
      />,
    );

    const chip = screen.getByRole('button', { name: 'ステージ' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chip);

    expect(onChange).toHaveBeenCalledWith({
      q: '',
      categories: [],
      areaIds: [],
    });
  });

  test('エリアチップは CMS から渡された選択肢で構成される', () => {
    render(
      <ExhibitionFilters
        query={baseQuery()}
        areas={areas}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'B棟' }));

    expect(onChange).toHaveBeenCalledWith({
      q: '',
      categories: [],
      areaIds: [2],
    });
  });

  test('検索語・カテゴリ・エリアを組み合わせて 変更として通知する', () => {
    render(
      <ExhibitionFilters
        query={baseQuery({ q: 'ロボット', areaIds: [1] })}
        areas={areas}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '展示' }));

    expect(onChange).toHaveBeenCalledWith({
      q: 'ロボット',
      categories: ['exhibit'],
      areaIds: [1],
    });
  });

  test('検索語が現在の条件と同じなら通知しない (復元した状態を壊さない)', () => {
    render(
      <ExhibitionFilters
        query={baseQuery({ q: 'ロボット', page: 2 })}
        areas={areas}
        onChange={onChange}
      />,
    );

    vi.advanceTimersByTime(1000);

    expect(onChange).not.toHaveBeenCalled();
  });
});
