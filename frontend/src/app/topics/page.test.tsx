import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopicsPage from './page';
import * as topicsModule from '@/lib/topics';

vi.mock('@/lib/topics', () => ({
  getTopics: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
  },
}));

describe('TopicsPage', () => {
  it('トピックス一覧が表示される', async () => {
    vi.mocked(topicsModule.getTopics).mockResolvedValue([
      {
        id: 1,
        title: 'トピック1',
        body: '本文1',
        imageId: null,
        attachments: [],
      },
      {
        id: 2,
        title: 'トピック2',
        body: '本文2',
        imageId: null,
        attachments: [],
      },
    ]);

    render(await TopicsPage());

    expect(
      screen.getByRole('heading', { name: 'トピックス' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
    expect(screen.getByText('トピック2')).toBeInTheDocument();
  });

  it('0件時は空状態メッセージが表示される', async () => {
    vi.mocked(topicsModule.getTopics).mockResolvedValue([]);

    render(await TopicsPage());

    expect(
      screen.getByRole('heading', { name: 'トピックス' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピックスはありません')).toBeInTheDocument();
  });

  it('取得エラー時は空状態メッセージにフォールバックして表示', async () => {
    vi.mocked(topicsModule.getTopics).mockRejectedValue(
      new Error('Directus Error'),
    );

    render(await TopicsPage());

    expect(
      screen.getByRole('heading', { name: 'トピックス' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピックスはありません')).toBeInTheDocument();
  });
});
