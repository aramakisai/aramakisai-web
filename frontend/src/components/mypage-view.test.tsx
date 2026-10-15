import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MypageView } from './mypage-view';
import type {
  ExhibitionCardSummary,
  ExhibitionCategory,
} from '@/lib/exhibitions';
import type { MypageStampTarget } from '@/lib/stamp-progress';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

const AREAS = [
  { id: 1, name: '中央エリア' },
  { id: 2, name: '南エリア' },
  { id: 3, name: '空エリア' },
];
const LABELS = {
  stage: 'ステージ',
  exhibit: '展示',
  vendor: '出店',
  other: 'その他企画',
} as const;
const TARGETS: MypageStampTarget[] = [
  { id: 10, category: 'exhibit', displayName: '展示A', areaId: 1 },
  { id: 11, category: 'vendor', displayName: 'クレープ', areaId: 1 },
  { id: 12, category: 'other', displayName: '休憩所', areaId: 2 },
  { id: 13, category: 'exhibit', displayName: '野良', areaId: null },
];

const card = (id: number, category: ExhibitionCategory, name: string) => ({
  id,
  category,
  displayName: name,
  organizationName: '団体',
  location: null,
  areaIds: [],
  thumbnail: null,
});
const CARDS: ExhibitionCardSummary[] = [
  card(10, 'exhibit', '展示A'),
  card(20, 'stage', 'ライブ'),
  card(21, 'vendor', 'たこ焼き'),
];

function saveBookmarks(refs: Array<[number, string, string]>) {
  window.localStorage.setItem(
    'aramakisai_mypage',
    JSON.stringify({
      version: 1,
      lists: {
        bookmarks: refs.map(([id, category, savedAt]) => ({
          id,
          category,
          savedAt,
        })),
      },
    }),
  );
}

function save(refs: Array<[number, string]>) {
  window.localStorage.setItem(
    'aramakisai_mypage',
    JSON.stringify({
      version: 1,
      lists: {
        stamps: refs.map(([id, category], i) => ({
          id,
          category,
          savedAt: `2026-10-24T0${i}:00:00.000Z`,
        })),
      },
    }),
  );
}

describe('MypageView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/mypage');
  });

  it('スタンプが無いときは空表示を出し、エリアは0%で並ぶ', () => {
    render(
      <MypageView
        targets={TARGETS}
        areas={AREAS}
        cards={CARDS}
        categoryLabels={LABELS}
      />,
    );
    expect(screen.getByText('スタンプはありません')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.queryByText('その他')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'マイページ',
    );
  });

  it('取得率を表示し、エリアは既定で閉じている', () => {
    save([[10, 'exhibit']]);
    const { container } = render(
      <MypageView
        targets={TARGETS}
        areas={AREAS}
        cards={CARDS}
        categoryLabels={LABELS}
      />,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.queryByText('スタンプはありません')).not.toBeInTheDocument();
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(1);
    expect(details[0]).not.toHaveAttribute('open');
    const bar = container.querySelector('[data-testid="progress-fill"]');
    expect(bar).toHaveStyle({ width: '50%' });
  });

  it('行は企画詳細ページへのリンクで、カテゴリを示す', () => {
    save([[11, 'vendor']]);
    render(
      <MypageView
        targets={TARGETS}
        areas={AREAS}
        cards={CARDS}
        categoryLabels={LABELS}
      />,
    );
    const link = screen.getByRole('link', { name: /クレープ/ });
    expect(link).toHaveAttribute('href', '/exhibitions/11/vendor');
    expect(within(link).getByText('出店')).toBeInTheDocument();
  });

  it('「その他」は取得率なしで、取得があるときだけ出る', () => {
    save([[13, 'exhibit']]);
    render(
      <MypageView
        targets={TARGETS}
        areas={AREAS}
        cards={CARDS}
        categoryLabels={LABELS}
      />,
    );
    const summary = screen.getByText('その他').closest('summary')!;
    expect(summary).not.toHaveTextContent('%');
    expect(screen.getByRole('link', { name: /野良/ })).toHaveAttribute(
      'href',
      '/exhibitions/13/exhibit',
    );
  });

  it('対象に無い保存済みスタンプは無視する', () => {
    save([[999, 'exhibit']]);
    render(
      <MypageView
        targets={TARGETS}
        areas={AREAS}
        cards={CARDS}
        categoryLabels={LABELS}
      />,
    );
    expect(screen.getByText('スタンプはありません')).toBeInTheDocument();
  });

  it('保存不可でも空表示で落ちない', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('denied');
    };
    try {
      render(
        <MypageView
          targets={TARGETS}
          areas={AREAS}
          cards={CARDS}
          categoryLabels={LABELS}
        />,
      );
      expect(screen.getByText('スタンプはありません')).toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = orig;
    }
  });

  it('PC案内を本体と別に持ち、QR画像のaltを持つ', () => {
    render(
      <MypageView
        targets={TARGETS}
        areas={AREAS}
        cards={CARDS}
        categoryLabels={LABELS}
      />,
    );
    expect(
      screen.getByText('マイページはスマートフォンでご利用ください'),
    ).toBeInTheDocument();
    expect(screen.getByAltText('マイページのQRコード')).toHaveAttribute(
      'src',
      expect.stringContaining('qr-mypage.svg'),
    );
    expect(screen.getByAltText('マイページのQRコード')).toHaveClass(
      'size-[174px]',
    );
  });

  describe('タブ', () => {
    const renderView = () =>
      render(
        <MypageView
          targets={TARGETS}
          areas={AREAS}
          cards={CARDS}
          categoryLabels={LABELS}
        />,
      );

    it('ARIA属性を持ち、既定はスタンプが選択される', () => {
      renderView();
      const stamps = screen.getByRole('tab', { name: /スタンプ/ });
      const bookmarks = screen.getByRole('tab', { name: /ブックマーク/ });
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(stamps).toHaveAttribute('aria-selected', 'true');
      expect(stamps).toHaveAttribute('tabindex', '0');
      expect(stamps).toHaveAttribute('aria-controls', 'mypage-panel-stamps');
      expect(bookmarks).toHaveAttribute('aria-selected', 'false');
      expect(bookmarks).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        'mypage-tab-stamps',
      );
    });

    it('#bookmarksで開くとブックマーク、不明値ならスタンプ', () => {
      window.history.replaceState(null, '', '/mypage#bookmarks');
      const { unmount } = renderView();
      expect(screen.getByRole('tab', { name: /ブックマーク/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      unmount();
      window.history.replaceState(null, '', '/mypage#foo');
      renderView();
      expect(screen.getByRole('tab', { name: /スタンプ/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('矢印・Home/Endで移動と選択をし、ハッシュを置き換える', () => {
      const len = window.history.length;
      renderView();
      const stamps = screen.getByRole('tab', { name: /スタンプ/ });
      const bookmarks = screen.getByRole('tab', { name: /ブックマーク/ });
      fireEvent.keyDown(stamps, { key: 'ArrowRight' });
      expect(bookmarks).toHaveAttribute('aria-selected', 'true');
      expect(bookmarks).toHaveFocus();
      expect(window.location.hash).toBe('#bookmarks');
      fireEvent.keyDown(bookmarks, { key: 'ArrowRight' });
      expect(stamps).toHaveAttribute('aria-selected', 'true');
      expect(window.location.hash).toBe('');
      fireEvent.keyDown(stamps, { key: 'End' });
      expect(bookmarks).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(bookmarks, { key: 'Home' });
      expect(stamps).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(stamps, { key: 'ArrowLeft' });
      expect(bookmarks).toHaveAttribute('aria-selected', 'true');
      expect(window.history.length).toBe(len);
    });

    it('クリックで切り替わる', () => {
      renderView();
      fireEvent.click(screen.getByRole('tab', { name: /ブックマーク/ }));
      expect(window.location.hash).toBe('#bookmarks');
    });
  });

  describe('ブックマークのタブ', () => {
    const open = () => {
      window.history.replaceState(null, '', '/mypage#bookmarks');
      render(
        <MypageView
          targets={TARGETS}
          areas={AREAS}
          cards={CARDS}
          categoryLabels={LABELS}
        />,
      );
      return screen.getByRole('tabpanel', { name: 'ブックマーク' });
    };

    it('保存済みを新しい順に企画カードで並べ、カタログに無い組は除く', () => {
      saveBookmarks([
        [10, 'exhibit', '2026-10-24T01:00:00.000Z'],
        [20, 'stage', '2026-10-24T03:00:00.000Z'],
        [999, 'exhibit', '2026-10-24T04:00:00.000Z'],
        [21, 'exhibit', '2026-10-24T05:00:00.000Z'],
        [21, 'vendor', '2026-10-24T02:00:00.000Z'],
      ]);
      const panel = open();
      const links = within(panel)
        .getAllByRole('link')
        .map((l) => l.getAttribute('href'));
      expect(links).toEqual([
        '/exhibitions/20/stage',
        '/exhibitions/21/vendor',
        '/exhibitions/10/exhibit',
      ]);
      expect(within(panel).getAllByRole('button')).toHaveLength(3);
    });

    it('カードのボタンで解除するとカードが消え、0件表示になる', () => {
      saveBookmarks([[10, 'exhibit', '2026-10-24T01:00:00.000Z']]);
      const panel = open();
      expect(
        within(panel).queryByText('ブックマークはありません'),
      ).not.toBeInTheDocument();
      fireEvent.click(within(panel).getByRole('button'));
      expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
      expect(
        within(panel).getByText('ブックマークはありません'),
      ).toBeInTheDocument();
    });

    it('保存が無ければ0件表示を出す', () => {
      const panel = open();
      expect(
        within(panel).getByText('ブックマークはありません'),
      ).toBeInTheDocument();
    });
  });
});
