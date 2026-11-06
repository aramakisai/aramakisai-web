import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ExhibitionList } from './exhibition-list';
import type {
  CorporateBoothCard,
  ExhibitionCardSummary,
} from '@/lib/exhibitions';

const sendGaEvent = vi.hoisted(() => vi.fn());
const trackPageView = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({ sendGaEvent, trackPageView }));

const orderCards = vi.hoisted(() => vi.fn(<T,>(cards: readonly T[]) => cards));
vi.mock('@/lib/exhibition-order', () => ({
  readOrCreateSeed: () => 1,
  orderCards,
}));

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
  beforeEach(() => {
    setUrl('');
    sendGaEvent.mockClear();
    trackPageView.mockClear();
    orderCards.mockImplementation((cards) => cards);
  });
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
    expect(trackPageView).toHaveBeenCalledTimes(1);
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

  test('条件変更時だけ件数を送り、ページ送り・復元・キーワードでは送らない', () => {
    window.scrollTo = vi.fn();
    const cards = [
      ...Array.from({ length: 30 }, (_, i) => card(i + 1)),
      card(31, { category: 'stage' }),
    ];
    render(<ExhibitionList cards={cards} areas={areas} />);
    const searchCalls = () =>
      sendGaEvent.mock.calls.filter((c) => c[0] === 'exhibition_search');
    expect(searchCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole('link', { name: '2' }));
    expect(searchCalls()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'ステージ' }));
    expect(searchCalls()).toHaveLength(1);
    expect(sendGaEvent).toHaveBeenCalledWith('exhibition_search', {
      item_count: 1,
    });
  });

  test('キーワードはデバウンス確定後に件数だけ送る', () => {
    vi.useFakeTimers();
    render(<ExhibitionList cards={[card(1), card(2)]} areas={areas} />);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: '企画1' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(sendGaEvent).toHaveBeenCalledWith('exhibition_search', {
      item_count: 1,
    });
    expect(
      JSON.stringify(
        sendGaEvent.mock.calls.filter((c) => c[0] === 'exhibition_search'),
      ),
    ).not.toContain('企画1');
  });

  test('カテゴリ 企業ブース で企業ブースのカードだけに絞り込み、詳細 URL へリンクする', () => {
    setUrl('?category=booth');

    render(
      <ExhibitionList
        cards={[
          card(1),
          {
            ...card(7),
            category: 'booth',
            displayName: '企業A',
          } as CorporateBoothCard,
        ]}
        areas={areas}
      />,
    );

    expect(screen.queryByText('企画1')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /企業A/ })).toHaveAttribute(
      'href',
      '/exhibitions/booth/7',
    );
  });

  test('並べ替えた順で表示し、絞り込み後も相対順を保つ', () => {
    orderCards.mockImplementation((cards) => [...cards].reverse());
    setUrl('?category=stage');
    render(
      <ExhibitionList
        cards={[
          card(1, { category: 'stage' }),
          card(2),
          card(3, { category: 'stage' }),
        ]}
        areas={areas}
      />,
    );

    const names = screen
      .getAllByRole('link', { name: /企画\d/ })
      .map((a) => a.textContent);
    expect(names[0]).toContain('企画3');
    expect(names[1]).toContain('企画1');
  });

  test('企業ブースは並べ替えに関わらず学生企画すべての後ろに企画 id 順で並ぶ', () => {
    const booth = (id: number) =>
      ({
        ...card(id),
        category: 'booth',
        displayName: `企業${id}`,
      }) as CorporateBoothCard;
    const cards = [card(1), card(2), card(3), booth(7), booth(8)];
    const cases: [(c: readonly unknown[]) => unknown[], string[]][] = [
      [(c) => [...c].reverse(), ['企画3', '企画2', '企画1', '企業7', '企業8']],
      [
        (c) => [c[1], c[0], c[2]],
        ['企画2', '企画1', '企画3', '企業7', '企業8'],
      ],
    ];
    for (const [mock, expected] of cases) {
      orderCards.mockImplementation(mock as never);
      const { unmount } = render(
        <ExhibitionList cards={cards} areas={areas} />,
      );
      const names = screen
        .getAllByRole('link', { name: /(企画|企業)\d/ })
        .map((a) => a.textContent?.match(/(企画|企業)\d/)?.[0]);
      expect(names).toEqual(expected);
      unmount();
    }
  });

  test('シード確定前 (サーバー描画) は不可視で、noscript で可視化し、確定後は不可視にしない', () => {
    const html = renderToString(
      <ExhibitionList cards={[card(1)]} areas={areas} />,
    );
    expect(html).toContain('visibility:hidden');
    expect(html).toContain('<noscript><style>');

    const { container } = render(
      <ExhibitionList cards={[card(1)]} areas={areas} />,
    );
    expect(container.querySelector('[data-order-pending]')).toBeNull();
    expect(sendGaEvent).toHaveBeenCalledTimes(1);
  });

  test('2 ページ目の view_item_list は掲載位置 25 から始まる', () => {
    window.scrollTo = vi.fn();
    const cards = Array.from({ length: 30 }, (_, i) => card(i + 1));
    render(<ExhibitionList cards={cards} areas={areas} />);
    fireEvent.click(screen.getByRole('link', { name: '2' }));

    const calls = sendGaEvent.mock.calls.filter(
      (c) => c[0] === 'view_item_list',
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][1].items[0].index).toBe(1);
    expect(calls[1][1].items[0].index).toBe(25);
    expect(calls[1][1].list_filtered).toBe('false');
  });
});
