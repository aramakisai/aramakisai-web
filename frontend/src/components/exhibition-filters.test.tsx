import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useRouter } from 'next/navigation';
import { ExhibitionFilters } from './exhibition-filters';
import type { AreaOption, ExhibitionQuery } from '@/lib/exhibitions';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

const mockedUseRouter = vi.mocked(useRouter);

const areas: readonly AreaOption[] = [
  { id: 1, name: 'A棟' },
  { id: 2, name: 'B棟' },
];

function baseQuery(overrides: Partial<ExhibitionQuery> = {}): ExhibitionQuery {
  return { q: '', categories: [], areaIds: [], page: 1, ...overrides };
}

describe('ExhibitionFilters', () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockReset();
    mockedUseRouter.mockReturnValue({
      replace,
    } as unknown as ReturnType<typeof useRouter>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('検索欄は現在のキーワードを初期値として表示する', () => {
    render(<ExhibitionFilters query={baseQuery({ q: 'ロボット' })} areas={areas} />);
    expect(screen.getByRole('searchbox', { name: '企画を検索' })).toHaveValue('ロボット');
  });

  test('キーワード入力は確定 (デバウンス) 後に URL クエリを更新する', () => {
    render(<ExhibitionFilters query={baseQuery()} areas={areas} />);
    const input = screen.getByRole('searchbox', { name: '企画を検索' });

    fireEvent.change(input, { target: { value: 'ロボット' } });
    expect(replace).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledWith('/exhibitions?q=%E3%83%AD%E3%83%9C%E3%83%83%E3%83%88');
  });

  test('キーワード変更時、既存のページ番号を URL に残さない (1 ページ目へ戻す)', () => {
    render(<ExhibitionFilters query={baseQuery({ page: 3 })} areas={areas} />);
    const input = screen.getByRole('searchbox', { name: '企画を検索' });

    fireEvent.change(input, { target: { value: 'x' } });
    vi.advanceTimersByTime(300);

    expect(replace).toHaveBeenCalledWith('/exhibitions?q=x');
  });

  test('カテゴリチップを選ぶと即座に URL クエリを更新する', () => {
    render(<ExhibitionFilters query={baseQuery()} areas={areas} />);

    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));

    expect(replace).toHaveBeenCalledWith('/exhibitions?category=stage');
  });

  test('選択済みのカテゴリチップを再度選ぶと解除する', () => {
    render(
      <ExhibitionFilters query={baseQuery({ categories: ['stage'] })} areas={areas} />,
    );

    const chip = screen.getByRole('button', { name: 'ステージ' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chip);

    expect(replace).toHaveBeenCalledWith('/exhibitions');
  });

  test('エリアチップは CMS から渡された選択肢で構成される', () => {
    render(<ExhibitionFilters query={baseQuery()} areas={areas} />);

    fireEvent.click(screen.getByRole('button', { name: 'B棟' }));

    expect(replace).toHaveBeenCalledWith('/exhibitions?area=2');
  });

  test('検索語・カテゴリ・エリアを組み合わせて URL クエリへ反映する', () => {
    render(
      <ExhibitionFilters
        query={baseQuery({ q: 'ロボット', areaIds: [1] })}
        areas={areas}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '展示' }));

    expect(replace).toHaveBeenCalledWith(
      '/exhibitions?q=%E3%83%AD%E3%83%9C%E3%83%83%E3%83%88&category=exhibit&area=1',
    );
  });
});
