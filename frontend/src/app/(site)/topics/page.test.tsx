import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopicsPage, { generateMetadata } from './page';
import * as topicsModule from '@/lib/topics';
import * as siteMetadataModule from '@/lib/site-metadata';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/topics', () => ({
  getTopics: vi.fn(),
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
  },
}));

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(SITE_METADATA);

describe('TopicsPage', () => {
  it('トピック一覧が表示される', async () => {
    vi.mocked(topicsModule.getTopics).mockResolvedValue([
      {
        id: 1,
        title: 'トピック1',
        body: '本文1',
        imageId: null,
      },
      {
        id: 2,
        title: 'トピック2',
        body: '本文2',
        imageId: null,
      },
    ]);

    render(await TopicsPage());

    expect(
      screen.getByRole('heading', { name: 'トピック' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
    expect(screen.getByText('トピック2')).toBeInTheDocument();
  });

  it('0件時は空状態メッセージが表示される', async () => {
    vi.mocked(topicsModule.getTopics).mockResolvedValue([]);

    render(await TopicsPage());

    expect(
      screen.getByRole('heading', { name: 'トピック' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピックはありません')).toBeInTheDocument();
  });

  it('取得エラー時は空状態メッセージにフォールバックして表示', async () => {
    vi.mocked(topicsModule.getTopics).mockRejectedValue(
      new Error('Directus Error'),
    );

    render(await TopicsPage());

    expect(
      screen.getByRole('heading', { name: 'トピック' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピックはありません')).toBeInTheDocument();
  });
});

describe('generateMetadata (要件2.4)', () => {
  it('title / description / canonical を設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('トピック');
    expect(metadata.description).toMatch(/トピック/);
    expect(metadata.alternates).toEqual({ canonical: '/topics' });
  });
});
