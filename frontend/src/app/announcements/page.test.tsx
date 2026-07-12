import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnnouncementsPage from './page';
import * as announcementsModule from '@/lib/announcements';

vi.mock('@/lib/announcements', () => ({
  getAnnouncements: vi.fn(),
}));

describe('AnnouncementsPage', () => {
  it('お知らせ一覧が表示される', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([
      { id: 1, title: 'お知らせ1', body: '本文1', publishedAt: '2026-07-01' },
      { id: 2, title: 'お知らせ2', body: '本文2', publishedAt: '2026-07-02' },
    ]);

    render(await AnnouncementsPage());

    expect(
      screen.getByRole('heading', { name: 'お知らせ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('お知らせ2')).toBeInTheDocument();
  });

  it('取得エラー時はクラッシュせず見出しのみ表示', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockRejectedValue(
      new Error('Directus Error'),
    );

    render(await AnnouncementsPage());

    expect(
      screen.getByRole('heading', { name: 'お知らせ' }),
    ).toBeInTheDocument();
  });
});
