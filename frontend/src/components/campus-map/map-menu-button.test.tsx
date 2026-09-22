import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { navigationItemsByPhase, linkableChildren } from '@/lib/navigation';
import { MapMenuButton } from './map-menu-button';

function flattenHrefs(phase: 'pre_event' | 'live'): string[] {
  return navigationItemsByPhase[phase].flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...linkableChildren(item).map((child) => child.href),
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
    const hrefs = flattenHrefs('pre_event');
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
    expect(renderedHrefs).toEqual(expect.arrayContaining(flattenHrefs('live')));
    expect(renderedHrefs).toEqual(
      expect.arrayContaining(['/exhibitions', '/map']),
    );
  });
});
