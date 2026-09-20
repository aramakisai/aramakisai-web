import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { navigationItems } from '@/components/header';
import * as phaseModule from '@/lib/phase';
import { MapMenuButton } from './map-menu-button';

vi.mock('@/lib/phase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/phase')>();
  return { ...actual, visibleNavItems: vi.fn(actual.visibleNavItems) };
});

function flattenHrefs(): string[] {
  return navigationItems.flatMap((item) => [
    item.href,
    ...(item.children?.map((child) => child.href) ?? []),
  ]);
}

describe('MapMenuButton', () => {
  it('初期状態ではメニューを閉じている', () => {
    render(<MapMenuButton phase="pre_event" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('トリガーを押すとサイト共通ヘッダーと同じ遷移先の一覧を開く', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    const hrefs = flattenHrefs();
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(
        Array.from(dialog.querySelectorAll('a')).some(
          (a) => a.getAttribute('href') === href,
        ),
      ).toBe(true);
    }
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

  it('Tab はメニュー内で循環し外へ出ない', () => {
    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    const dialog = screen.getByRole('dialog');
    const links = Array.from(dialog.querySelectorAll('a'));
    const last = links[links.length - 1] as HTMLElement;
    const first = links[0] as HTMLElement;

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

  it('Esc キーで閉じてトリガーへフォーカスを戻す', () => {
    render(<MapMenuButton phase="pre_event" />);
    const trigger = screen.getByRole('button', { name: 'メニューを開く' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('開催前フェーズで非公開のリンク先を持つ項目を除去する', () => {
    vi.mocked(phaseModule.visibleNavItems).mockReturnValue(
      navigationItems.filter((item) => item.href !== '/announcements'),
    );

    render(<MapMenuButton phase="pre_event" />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));

    expect(phaseModule.visibleNavItems).toHaveBeenCalledWith(
      navigationItems,
      'pre_event',
    );
    const dialog = screen.getByRole('dialog');
    expect(
      Array.from(dialog.querySelectorAll('a')).some(
        (a) => a.getAttribute('href') === '/announcements',
      ),
    ).toBe(false);
  });
});
