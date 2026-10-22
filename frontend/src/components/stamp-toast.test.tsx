import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StampToast } from './stamp-toast';

describe('StampToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([
    ['added', 'スタンプを取得しました', '/mypage'],
    ['exists', '取得済みのスタンプです', '/mypage'],
    ['bookmarked', 'ブックマークしました', '/mypage#bookmarks'],
  ] as const)('%s の文言とマイページへのリンクを出す', (kind, text, href) => {
    render(<StampToast kind={kind} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(text);
    expect(screen.getByRole('link', { name: 'マイページ' })).toHaveAttribute(
      'href',
      href,
    );
  });

  it('message を渡すと kind の既定文言の代わりに出す', () => {
    render(<StampToast kind="added" message="現在地を取得できませんでした" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('現在地を取得できませんでした');
    expect(status).not.toHaveTextContent('スタンプを取得しました');
  });

  it('showLink={false} でマイページのリンクを描かず role=status は保つ', () => {
    render(<StampToast kind="added" showLink={false} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('固定幅 358px で右下に出す。下部ナビがある幅ではナビの上、lg 以上では画面下端から', () => {
    render(<StampToast kind="added" />);
    expect(screen.getByRole('status')).toHaveClass(
      'fixed',
      'right-4',
      'w-[358px]',
      'max-w-[calc(100vw-2rem)]',
      'bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]',
      'lg:bottom-[calc(1rem+env(safe-area-inset-bottom))]',
    );
  });

  it('表示時は透明・8px下から始まり、次フレームで表示状態へ遷移する', () => {
    render(<StampToast kind="added" />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass(
      'transition-[opacity,translate]',
      'duration-200',
      'ease-out',
      'motion-reduce:transition-none',
    );
    expect(status.dataset.state).toBe('entering');
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(status.dataset.state).toBe('open');
  });

  it('約3秒で退場アニメーションに入り、200ms 後に DOM から外れる', () => {
    render(<StampToast kind="added" />);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole('status').dataset.state).toBe('open');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status').dataset.state).toBe('leaving');
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
