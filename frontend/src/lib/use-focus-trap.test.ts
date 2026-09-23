import { createElement, useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFocusTrap } from './use-focus-trap';

/**
 * 子項目の開閉を模した「要素数が変わる」ハーネス。origin (起点ボタン) と
 * container (可変長のリンク一覧) を用意し、count を変えて再レンダーすることで
 * フォーカス可能な要素の増減を再現する。
 */
function Harness({
  active,
  count,
  onClose,
}: {
  active: boolean;
  count: number;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLButtonElement>(null);
  useFocusTrap({ active, containerRef, originRef, onClose });

  return createElement(
    'div',
    null,
    createElement('button', { ref: originRef }, 'origin'),
    createElement(
      'div',
      { ref: containerRef },
      Array.from({ length: count }, (_, i) =>
        createElement('a', { key: i, href: `#${i}` }, `item-${i}`),
      ),
    ),
  );
}

describe('useFocusTrap', () => {
  it('要素の増減後も Tab と Shift+Tab がメニュー内で循環する', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      createElement(Harness, { active: true, count: 3, onClose }),
    );

    const linksBefore = screen.getAllByRole('link');
    (linksBefore[linksBefore.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(linksBefore[0]);

    // 子項目が開いて要素が増えたことを模す
    rerender(createElement(Harness, { active: true, count: 5, onClose }));
    const linksAfterGrow = screen.getAllByRole('link');
    (linksAfterGrow[linksAfterGrow.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(linksAfterGrow[0]);

    linksAfterGrow[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
      linksAfterGrow[linksAfterGrow.length - 1],
    );

    // 子項目が閉じて要素が減ったことを模す (キャッシュしていれば古い末尾を掴んで壊れる)
    rerender(createElement(Harness, { active: true, count: 2, onClose }));
    const linksAfterShrink = screen.getAllByRole('link');
    (linksAfterShrink[linksAfterShrink.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(linksAfterShrink[0]);
  });

  it('Esc キーで onClose を呼び、起点へフォーカスを戻す', () => {
    const onClose = vi.fn();
    render(createElement(Harness, { active: true, count: 3, onClose }));

    const links = screen.getAllByRole('link');
    (links[1] as HTMLElement).focus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'origin' }),
    );
  });

  it('active が false の間は Tab を素通りさせる', () => {
    const onClose = vi.fn();
    render(createElement(Harness, { active: false, count: 3, onClose }));

    const links = screen.getAllByRole('link');
    (links[links.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    // 循環しない (preventDefault されないので activeElement は変化しない)
    expect(document.activeElement).toBe(links[links.length - 1]);
  });
});
