import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { Header, MAIN_CONTENT_ID } from './header';
import { navigationItemsByPhase } from '@/lib/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

describe('Header', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/');
  });

  test('スキップリンクは本文の main へ遷移し、キーボードフォーカス時のみ表示する', () => {
    render(<Header phase="pre_event" />);

    const skipLink = screen.getByRole('link', { name: '本文へ移動' });
    expect(skipLink).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(skipLink).toHaveClass('sr-only', 'focus:not-sr-only');
  });

  test('ロゴはトップページへのリンクで、PC で 40px 高さの表示になる', () => {
    render(<Header phase="pre_event" />);

    expect(screen.getByRole('link', { name: '荒牧祭2026' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('img', { name: '荒牧祭2026' })).toHaveClass(
      'h-8',
      'lg:h-10',
    );
  });

  test('開催前フェーズは 荒牧祭について・お知らせ・ご案内・協賛 の順に表示する', () => {
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    const topLevelLabels = navigationItemsByPhase.pre_event.map(
      (item) => item.label,
    );
    for (const label of topLevelLabels) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    // 開催中限定の項目は表示しない
    expect(within(nav).queryByText('企画一覧')).not.toBeInTheDocument();
    expect(within(nav).queryByText('構内マップ')).not.toBeInTheDocument();
  });

  test('開催中フェーズは 企画一覧・構内マップ・タイムテーブル・お知らせ・ご案内 の順に表示する', () => {
    render(<Header phase="live" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    for (const label of navigationItemsByPhase.live.map((i) => i.label)) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    expect(within(nav).queryByText('協賛')).not.toBeInTheDocument();
  });

  test('href を持つ項目は現在地のとき aria-current を付ける', () => {
    mockedUsePathname.mockReturnValue('/announcements');
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(within(nav).getByRole('link', { name: 'お知らせ' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('子項目だけを持つ親は、子項目のいずれかが現在地のとき現在地として扱う', () => {
    mockedUsePathname.mockReturnValue('/access');
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(within(nav).getByRole('button', { name: /ご案内/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('子項目を持つ項目は button で開く手段を備え、子項目一覧を含む', () => {
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    const trigger = within(nav).getByRole('button', { name: /ご案内/ });
    expect(trigger).toBeInTheDocument();

    const submenu = within(nav).getByRole('list', {
      name: 'ご案内のサブメニュー',
    });
    expect(
      within(submenu)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['アクセス', '/access'],
      ['ご来場の際の注意点', '/guidelines'],
      ['案内所・落とし物・迷子', '/info-desk'],
      ['ごみの分別のお願い', '/waste'],
      ['よくある質問', '/faq'],
      ['お問い合わせ', '/contact'],
    ]);
  });

  test('現在地の下線色は親項目ごとに固定され、ラベルの文字色は変えない', () => {
    mockedUsePathname.mockReturnValue('/announcements');
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    const link = within(nav).getByRole('link', { name: 'お知らせ' });
    expect(link).toHaveClass('text-text');
    const indicator = link.parentElement?.querySelector(
      'span[aria-hidden="true"]',
    );
    expect(indicator).toHaveClass('bg-warning', 'opacity-100', 'scale-x-100');
  });

  test('上端に固定し、地の色と下端の境界線を持つ', () => {
    const { container } = render(<Header phase="pre_event" />);

    const header = container.querySelector('header');
    expect(header).toHaveClass(
      'fixed',
      'top-0',
      'bg-background',
      'border-b',
      'border-gray-200',
    );
  });

  test('高さ 80px・左右 padding 80px を PC で適用する', () => {
    const { container } = render(<Header phase="pre_event" />);

    const headerInner = container.querySelector('header')?.firstElementChild;
    expect(headerInner).toHaveClass('lg:h-20', 'lg:px-20');
  });

  test('ナビゲーション項目間は 32px', () => {
    render(<Header phase="pre_event" />);
    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(nav.querySelector('ul')).toHaveClass('gap-8');
  });

  test('opens a mobile navigation with the phase navigation links', () => {
    render(<Header phase="pre_event" />);

    const menuButton = screen.getByRole('button', { name: 'メニューを開く' });
    expect(menuButton).toHaveAttribute('type', 'button');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'mobile-navigation');
    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument();

    fireEvent.click(menuButton);

    expect(
      screen.getByRole('button', { name: 'メニューを閉じる' }),
    ).toHaveAttribute('aria-expanded', 'true');
    const mobileNavigation = screen.getByRole('navigation', {
      name: 'モバイルナビゲーション',
    });
    expect(
      within(mobileNavigation).getByText('荒牧祭について'),
    ).toBeInTheDocument();
    expect(within(mobileNavigation).getByText('協賛')).toBeInTheDocument();
  });

  test('複数の子項目持ちの親を、それぞれ独立して開閉できる (お知らせ + ご案内)', () => {
    mockedUsePathname.mockReturnValue('/');
    render(<Header phase="live" />);

    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    const mobileNavigation = screen.getByRole('navigation', {
      name: 'モバイルナビゲーション',
    });

    const openAnnouncements = within(mobileNavigation).getByRole('button', {
      name: 'お知らせのサブメニューを開く',
    });
    fireEvent.click(openAnnouncements);
    expect(
      within(mobileNavigation).getByRole('list', {
        name: 'お知らせのモバイルサブメニュー',
      }),
    ).toBeInTheDocument();
    // 「ご案内」はまだ閉じたまま
    expect(
      within(mobileNavigation).queryByRole('list', {
        name: 'ご案内のモバイルサブメニュー',
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(mobileNavigation).getByRole('button', {
        name: 'ご案内のサブメニューを開く',
      }),
    );
    expect(
      within(mobileNavigation).getByRole('list', {
        name: 'ご案内のモバイルサブメニュー',
      }),
    ).toBeInTheDocument();
  });

  test('モバイルメニュー内の項目を選択すると遷移してメニューを閉じる', () => {
    render(<Header phase="pre_event" />);

    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    const mobileNavigation = screen.getByRole('navigation', {
      name: 'モバイルナビゲーション',
    });
    fireEvent.click(
      within(mobileNavigation).getByRole('link', { name: '荒牧祭について' }),
    );

    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument();
  });

  test('closes the mobile menu with Escape and returns focus to the toggle', () => {
    render(<Header phase="pre_event" />);

    const menuButton = screen.getByRole('button', { name: 'メニューを開く' });
    fireEvent.click(menuButton);
    expect(
      screen.getByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  test('PC ナビ項目 (リンク・ドロップダウントリガー) は body/md の line-height 1.7', () => {
    mockedUsePathname.mockReturnValue('/');
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    expect(
      within(nav).getByRole('link', { name: '荒牧祭について' }),
    ).toHaveClass('leading-[1.7]');
    expect(within(nav).getByRole('button', { name: /ご案内/ })).toHaveClass(
      'leading-[1.7]',
    );
  });

  test('ドロップダウンの子項目は body/sm の line-height 1.6 で、ul に縦方向の余白を持たない', () => {
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    const submenu = within(nav).getByRole('list', {
      name: 'ご案内のサブメニュー',
    });
    expect(submenu).not.toHaveClass('py-2');
    for (const link of within(submenu).getAllByRole('link')) {
      expect(link).toHaveClass('leading-[1.6]');
    }
  });

  test('ホバー下線とPCドロップダウンの開閉モーションは 200ms ease-out で行う', () => {
    mockedUsePathname.mockReturnValue('/announcements');
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    const link = within(nav).getByRole('link', { name: 'お知らせ' });
    const indicator = link.parentElement?.querySelector(
      'span[aria-hidden="true"]',
    );
    expect(indicator).toHaveClass('duration-200', 'ease-out');

    const trigger = within(nav).getByRole('button', { name: /ご案内/ });
    const dropdown = trigger.parentElement?.querySelector(
      '[class*="top-full"]',
    );
    expect(dropdown).toHaveClass('duration-200', 'ease-out');
  });

  test('PC ドロップダウンの閉状態は上方向 (負の translate) から開く', () => {
    render(<Header phase="pre_event" />);

    const nav = screen.getByRole('navigation', {
      name: 'メインナビゲーション',
    });
    const trigger = within(nav).getByRole('button', { name: /ご案内/ });
    const dropdown = trigger.parentElement?.querySelector(
      '[class*="top-full"]',
    );
    expect(dropdown).toHaveClass('-translate-y-1');
    expect(dropdown).not.toHaveClass('translate-y-1');
  });

  test('uses compact mobile sizing and safe-area spacing without changing desktop sizes', () => {
    const { container } = render(<Header phase="pre_event" />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('pt-[env(safe-area-inset-top)]');
    const headerInner = header?.firstElementChild;
    expect(headerInner).toHaveClass('h-16', 'lg:h-20');
    expect(screen.getByRole('img', { name: '荒牧祭2026' })).toHaveClass('h-8');
    expect(
      container.querySelector('[aria-hidden="true"].header-spacer'),
    ).toHaveClass(
      'h-[calc(4rem+env(safe-area-inset-top))]',
      'lg:h-[calc(5rem+env(safe-area-inset-top))]',
    );
  });
});
