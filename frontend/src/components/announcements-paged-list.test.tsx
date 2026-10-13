import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AnnouncementsPagedList } from './announcements-paged-list';
import type { AnnouncementSummary } from '@/lib/home-page-types';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

function items(count: number): AnnouncementSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `お知らせ${i + 1}`,
    body: '本文',
    publishedAt: '2026-07-01',
    attachments: [],
  }));
}

function setUrl(search: string) {
  window.history.replaceState(null, '', `/announcements${search}`);
}

describe('AnnouncementsPagedList', () => {
  beforeEach(() => {
    setUrl('');
    window.scrollTo = vi.fn();
  });

  test('11 件以上でページ送りを描画し 1 ページ目に 10 件表示する', () => {
    render(<AnnouncementsPagedList announcements={items(11)} />);

    expect(screen.getByText('お知らせ10')).toBeInTheDocument();
    expect(screen.queryByText('お知らせ11')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('10 件以下ではページ送りを描画しない', () => {
    render(<AnnouncementsPagedList announcements={items(10)} />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('?page=2 から復元して 11 件目以降を表示する', () => {
    setUrl('?page=2');

    render(<AnnouncementsPagedList announcements={items(11)} />);

    expect(screen.getByText('お知らせ11')).toBeInTheDocument();
    expect(screen.queryByText('お知らせ1')).not.toBeInTheDocument();
  });

  test('範囲外の page は最終ページへ丸める', () => {
    setUrl('?page=999');

    render(<AnnouncementsPagedList announcements={items(11)} />);

    expect(screen.getByText('お知らせ11')).toBeInTheDocument();
  });

  test('ページ送りクリックで pushState し先頭へスクロールする', () => {
    render(<AnnouncementsPagedList announcements={items(11)} />);

    fireEvent.click(screen.getByRole('link', { name: '2' }));

    expect(window.location.search).toBe('?page=2');
    expect(screen.getByText('お知らせ11')).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('popstate で URL のページに追従する', () => {
    render(<AnnouncementsPagedList announcements={items(11)} />);

    act(() => {
      setUrl('?page=2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('お知らせ11')).toBeInTheDocument();
  });
});
