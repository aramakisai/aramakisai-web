import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ExhibitionList } from './exhibition-list';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

function card(id: number, overrides: Partial<ExhibitionCardSummary> = {}) {
  return {
    id,
    category: 'exhibit',
    displayName: `企画${id}`,
    organizationName: '団体',
    location: null,
    areaIds: [],
    thumbnail: null,
    ...overrides,
  } as ExhibitionCardSummary;
}

const areas = [{ id: 1, name: 'A棟' }];

function setUrl(search: string) {
  window.history.replaceState(null, '', `/exhibitions${search}`);
}

describe('ExhibitionList', () => {
  beforeEach(() => setUrl(''));
  afterEach(() => vi.useRealTimers());

  test('URL クエリが無ければ全件を件数付きで表示する', () => {
    render(<ExhibitionList cards={[card(1), card(2)]} areas={areas} />);

    expect(screen.getByText('全 2 件中 1–2 件を表示')).toBeInTheDocument();
    expect(screen.getByText('企画1')).toBeInTheDocument();
    expect(screen.getByText('企画2')).toBeInTheDocument();
  });

  test('マウント時に URL クエリから絞り込み状態を復元する', () => {
    setUrl('?category=stage&q=%E3%83%AD');

    render(
      <ExhibitionList
        cards={[
          card(1, { category: 'stage', displayName: 'ロボ' }),
          card(2, { category: 'exhibit', displayName: 'ロボット展' }),
          card(3, { category: 'stage', displayName: '演奏' }),
        ]}
        areas={areas}
      />,
    );

    expect(screen.getByText('ロボ')).toBeInTheDocument();
    expect(screen.queryByText('ロボット展')).not.toBeInTheDocument();
    expect(screen.queryByText('演奏')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('ロ');
    expect(screen.getByRole('button', { name: 'ステージ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('チップ操作はクライアント側で絞り込み、URL を replace で更新する', () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    render(
      <ExhibitionList
        cards={[
          card(1, { category: 'stage', displayName: '演奏' }),
          card(2, { category: 'exhibit', displayName: '展示物' }),
        ]}
        areas={areas}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));

    expect(screen.queryByText('展示物')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?category=stage');
    replaceSpy.mockRestore();
  });

  test('ページ送りはクライアント側で行い、URL を push で更新する', () => {
    window.scrollTo = vi.fn();
    const cards = Array.from({ length: 30 }, (_, i) => card(i + 1));
    render(<ExhibitionList cards={cards} areas={areas} />);
    expect(screen.getByText('企画1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: '2' }));

    expect(screen.getByText('全 30 件中 25–30 件を表示')).toBeInTheDocument();
    expect(screen.queryByText('企画1')).not.toBeInTheDocument();
    expect(screen.getByText('企画30')).toBeInTheDocument();
    expect(window.location.search).toBe('?page=2');
  });

  test('戻る操作 (popstate) で URL の状態に戻る', () => {
    window.scrollTo = vi.fn();
    const cards = Array.from({ length: 30 }, (_, i) => card(i + 1));
    render(<ExhibitionList cards={cards} areas={areas} />);
    fireEvent.click(screen.getByRole('link', { name: '2' }));

    act(() => {
      setUrl('');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('企画1')).toBeInTheDocument();
  });

  test('0 件のとき、条件の有無でメッセージを出し分ける', () => {
    const { unmount } = render(<ExhibitionList cards={[]} areas={[]} />);
    expect(
      screen.getByText('企画はまだ公開されていません'),
    ).toBeInTheDocument();
    unmount();

    setUrl('?q=nothing');
    render(<ExhibitionList cards={[card(1)]} areas={areas} />);
    expect(
      screen.getByText('条件に一致する企画はありません'),
    ).toBeInTheDocument();
  });
});
