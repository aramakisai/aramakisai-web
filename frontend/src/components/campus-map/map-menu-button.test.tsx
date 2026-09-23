import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { navigationItemsByPhase } from '@/lib/navigation';
import { MapMenuButton } from './map-menu-button';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

function topLevelHrefs(phase: 'pre_event' | 'live'): string[] {
  return navigationItemsByPhase[phase]
    .filter(
      (item): item is typeof item & { href: string } => item.href !== undefined,
    )
    .map((item) => item.href);
}

describe('MapMenuButton', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/map');
  });

  it('初期状態ではメニューを閉じている', () => {
    render(<MapMenuButton phase="pre_event" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('トリガーを押すと直下に固定幅でハンバーガーメニューと同じ項目一覧を開く', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('w-64');
    const hrefs = topLevelHrefs('pre_event');
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(
        Array.from(dialog.querySelectorAll('a')).some(
          (a) => a.getAttribute('href') === href,
        ),
      ).toBe(true);
    }
  });

  it('子項目を持つ行を開くとハンバーガーメニューと同じ行部品でその遷移先が現れる', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).queryByRole('link', { name: 'アクセス' }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /ご案内/ }));
    expect(
      within(dialog).getByRole('link', { name: 'アクセス' }),
    ).toBeInTheDocument();
  });

  it('開いている間は地図へのポインタ操作を遮るオーバーレイを敷く', () => {
    render(<MapMenuButton phase="pre_event" />);
    expect(screen.queryByTestId('map-menu-overlay')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    expect(screen.getByTestId('map-menu-overlay')).toBeInTheDocument();
  });

  it('開くとメニュー内の最初の遷移先へフォーカスを移す', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    const links = dialog.querySelectorAll('a');
    expect(document.activeElement).toBe(links[0]);
  });

  it('Tab はメニュー内のリンク・開閉ボタンを含めて循環し外へ出ない', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button'),
    );
    const last = focusables[focusables.length - 1];
    const first = focusables[0];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('検索ボックスと縦中心を揃えるための共有トークンでサイズ・位置を指定している', () => {
    render(<MapMenuButton phase="pre_event" />);
    const trigger = screen.getByRole('button', { name: 'メニューを開く' });
    expect(trigger.className).toMatch(/map-menu-button-position/);
    expect(trigger.className).toMatch(/h-\[var\(--map-toolbar-size\)\]/);
    expect(trigger.className).toMatch(/w-\[var\(--map-toolbar-size\)\]/);
  });

  it('PC (lg) では右端 24px、SP では右端 16px の位置を持つ', () => {
    render(<MapMenuButton phase="pre_event" />);
    const trigger = screen.getByRole('button', { name: 'メニューを開く' });
    expect(trigger).toHaveClass(
      'right-[max(1rem,env(safe-area-inset-right))]',
      'lg:right-[max(1.5rem,env(safe-area-inset-right))]',
    );
  });

  it('開いたメニューの直下位置も PC/SP でボタンと同じ右端に揃える', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass(
      'right-[max(1rem,env(safe-area-inset-right))]',
      'lg:right-[max(1.5rem,env(safe-area-inset-right))]',
    );
  });

  it('Esc キーで閉じてトリガーへフォーカスを戻す', () => {
    render(<MapMenuButton phase="pre_event" />);
    const trigger = screen.getByRole('button', { name: 'メニューを開く' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('開催前フェーズでは開催中限定の項目 (企画一覧) を含まない', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    expect(
      Array.from(dialog.querySelectorAll('a')).some(
        (a) => a.getAttribute('href') === '/exhibitions',
      ),
    ).toBe(false);
  });

  it('開催中フェーズでは企画一覧・構内マップを含む', () => {
    render(<MapMenuButton phase="live" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    const renderedHrefs = Array.from(dialog.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(renderedHrefs).toEqual(
      expect.arrayContaining(topLevelHrefs('live')),
    );
    expect(renderedHrefs).toEqual(
      expect.arrayContaining(['/exhibitions', '/map']),
    );
  });
});
