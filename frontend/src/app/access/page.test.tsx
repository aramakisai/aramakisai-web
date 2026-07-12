import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AccessPage from './page';
import * as staticPageModule from '@/lib/static-page';

vi.mock('@/lib/static-page', () => ({
  getAccessPage: vi.fn(),
}));

describe('AccessPage', () => {
  it('本文と地図埋め込みが表示される', async () => {
    vi.mocked(staticPageModule.getAccessPage).mockResolvedValue({
      contentHtml: '<p>アクセス本文</p>',
      embedUrl: 'https://maps.example.com',
    });

    render(await AccessPage());

    expect(
      screen.getByRole('heading', { name: 'アクセス' }),
    ).toBeInTheDocument();
    expect(screen.getByText('アクセス本文')).toBeInTheDocument();
    expect(screen.getByTitle('地図')).toHaveAttribute(
      'src',
      'https://maps.example.com',
    );
  });

  it('取得エラー時はクラッシュせず見出しのみ表示', async () => {
    vi.mocked(staticPageModule.getAccessPage).mockRejectedValue(
      new Error('Directus Error'),
    );

    render(await AccessPage());

    expect(
      screen.getByRole('heading', { name: 'アクセス' }),
    ).toBeInTheDocument();
  });
});
