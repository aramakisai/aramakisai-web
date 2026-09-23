import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TopicPage, { generateMetadata } from './page';
import { notFound } from 'next/navigation';
import { getTopicById } from '@/lib/topics';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/topics', () => ({
  getTopicById: vi.fn(),
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

const baseTopic = {
  id: 1,
  title: 'テストトピック',
  body: '<p>これはテストです</p>',
  imageId: '42',
};

describe('TopicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders topic correctly when found', async () => {
    vi.mocked(getTopicById).mockResolvedValue(baseTopic);

    const params = Promise.resolve({ id: '1' });
    const jsx = await TopicPage({ params });
    render(jsx);

    expect(getTopicById).toHaveBeenCalledWith(1);
    expect(
      screen.getByRole('heading', { name: 'テストトピック', level: 1 }),
    ).toBeInTheDocument();

    // 戻る導線 (要件 17.2)
    const backLink = screen.getByRole('link', { name: 'トピック一覧に戻る' });
    expect(backLink).toHaveAttribute('href', '/topics');

    // サムネイル (要件 17.4)。選択で拡大モーダルが開く (要件 17.7)
    const thumbnailButton = screen.getByRole('button', {
      name: '画像を拡大: テストトピック',
    });
    const thumbnail = thumbnailButton.querySelector('img');
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/assets/42');
    expect(thumbnail).toHaveAttribute('data-media-id', '42');

    // 本文
    expect(screen.getByText('これはテストです')).toBeInTheDocument();
  });

  it('サムネイルが無ければ領域ごと出さない (要件 17.6)', async () => {
    vi.mocked(getTopicById).mockResolvedValue({
      ...baseTopic,
      imageId: null,
    });

    const params = Promise.resolve({ id: '1' });
    render(await TopicPage({ params }));

    expect(
      screen.queryByRole('button', { name: /画像を拡大/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('添付ファイルを表示しない (要件 17.11)', async () => {
    vi.mocked(getTopicById).mockResolvedValue(baseTopic);

    const params = Promise.resolve({ id: '1' });
    render(await TopicPage({ params }));

    expect(
      screen.queryByRole('heading', { name: '添付ファイル' }),
    ).not.toBeInTheDocument();
  });

  it('calls notFound when topic does not exist', async () => {
    vi.mocked(getTopicById).mockResolvedValue(null);

    const params = Promise.resolve({ id: '999' });
    await expect(TopicPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getTopicById).toHaveBeenCalledWith(999);
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when id is invalid', async () => {
    const params = Promise.resolve({ id: 'invalid' });
    await expect(TopicPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
    expect(getTopicById).not.toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the topic title as the page title (要件 17.10)', async () => {
    vi.mocked(getTopicById).mockResolvedValue(baseTopic);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '1' }),
    });

    expect(metadata).toEqual({ title: 'テストトピック' });
  });

  it('returns empty metadata when the topic does not exist', async () => {
    vi.mocked(getTopicById).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '999' }),
    });

    expect(metadata).toEqual({});
  });

  it('returns empty metadata for an invalid id without fetching', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(metadata).toEqual({});
    expect(getTopicById).not.toHaveBeenCalled();
  });
});
