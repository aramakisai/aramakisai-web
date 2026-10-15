import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBookmark, removeBookmark } from '@/lib/mypage-storage';
import { BookmarkButton } from './bookmark-button';

const sendGaEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({ sendGaEvent }));

vi.mock('@/lib/mypage-storage', async (orig) => {
  const m = await orig<typeof import('@/lib/mypage-storage')>();
  return {
    ...m,
    addBookmark: vi.fn(m.addBookmark),
    removeBookmark: vi.fn(m.removeBookmark),
  };
});

const KEY = 'aramakisai_mypage';
const seed = (bookmarks: unknown[]) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, lists: { stamps: [], bookmarks } }),
  );
const saved = { id: 1, category: 'stage', savedAt: '2026-01-01T00:00:00Z' };

function setup(variant: 'detail' | 'card' = 'detail') {
  return render(
    <BookmarkButton
      exhibitionId={1}
      category="stage"
      displayName="劇団A"
      variant={variant}
    />,
  );
}

describe('BookmarkButton', () => {
  beforeEach(() => {
    localStorage.clear();
    sendGaEvent.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('未確定の間は不可視で場所だけ確保する', () => {
    const html = renderToString(
      <BookmarkButton
        exhibitionId={1}
        category="stage"
        displayName="劇団A"
        variant="detail"
      />,
    );
    expect(html).toContain('invisible');
    expect(html).toContain('ブックマーク');
  });

  it('保存不可では何も描画しない', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  it('未保存は aria-pressed=false、保存済みは true', () => {
    setup();
    expect(
      screen.getByRole('button', { name: 'ブックマーク' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('保存済みなら押下状態で描かれる', () => {
    seed([saved]);
    setup();
    expect(
      screen.getByRole('button', { name: 'ブックマーク' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('card は企画名を含む名前を持ち、PC では隠す', () => {
    setup('card');
    const b = screen.getByRole('button', { name: '劇団Aをブックマーク' });
    expect(b).toHaveClass('pc-input:hidden');
  });

  it('未保存で押すと追加し bookmark_add を1回送りトーストを出す', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
    expect(sendGaEvent).toHaveBeenCalledTimes(1);
    expect(sendGaEvent).toHaveBeenCalledWith('bookmark_add', {
      exhibition_id: 1,
      exhibition_category: 'stage',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'ブックマークしました',
    );
    expect(
      screen.getByRole('button', { name: 'ブックマーク' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(KEY)!).lists.bookmarks).toHaveLength(
      1,
    );
  });

  it('保存済みで押すと解除し bookmark_remove を1回送りトーストは出さない', () => {
    seed([saved]);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
    expect(sendGaEvent).toHaveBeenCalledTimes(1);
    expect(sendGaEvent).toHaveBeenCalledWith('bookmark_remove', {
      exhibition_id: 1,
      exhibition_category: 'stage',
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'ブックマーク' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('exists では送信もトーストもない', () => {
    seed([]);
    setup();
    vi.mocked(addBookmark).mockReturnValueOnce('exists');
    fireEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
    expect(sendGaEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('absent と書き込み失敗では bookmark_remove を送らない', () => {
    seed([saved]);
    setup();
    const spy = vi.mocked(removeBookmark);
    for (const r of ['absent', 'unavailable'] as const) {
      spy.mockReturnValueOnce(r);
      fireEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
    }
    expect(sendGaEvent).not.toHaveBeenCalled();
  });

  it('書き込み失敗の追加では送信もトーストもない', () => {
    setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    fireEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
    expect(sendGaEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
