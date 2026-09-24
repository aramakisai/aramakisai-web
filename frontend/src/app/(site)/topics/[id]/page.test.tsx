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

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

const baseTopic = {
  id: 1,
  title: 'テストトピック',
  body: '<p>これはテストです</p>',
  imageId: '42',
  metaDescription: null,
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

  it('パンくず (トップ › トピック › タイトル) の BreadcrumbList JSON-LD を出力する (要件 5.7)', async () => {
    vi.mocked(getTopicById).mockResolvedValue(baseTopic);

    const { container } = render(
      await TopicPage({ params: Promise.resolve({ id: '1' }) }),
    );

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(
      data.itemListElement.map((item: { name: string }) => item.name),
    ).toEqual(['トップ', 'トピック', 'テストトピック']);
    expect(data.itemListElement[2].item).toBe(
      'https://aramakisai.example.com/topics/1',
    );
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

    expect(metadata.title).toBe('テストトピック');
    expect(metadata.description).toBe('これはテストです');
    expect(metadata.alternates).toEqual({ canonical: '/topics/1' });
    expect(metadata.openGraph?.images).toEqual([
      { url: 'https://example.com/assets/42' },
    ]);
  });

  it('ページ固有の meta description が優先される (要件 6.9)', async () => {
    vi.mocked(getTopicById).mockResolvedValue({
      ...baseTopic,
      metaDescription: '編集者が設定した説明文',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '1' }),
    });

    expect(metadata.description).toBe('編集者が設定した説明文');
  });

  it('サイト既定値へ退避する (取得結果なし、要件 2.10 / 8.1)', async () => {
    vi.mocked(getTopicById).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '999' }),
    });

    expect(metadata.title).toEqual({ absolute: '荒牧祭' });
    expect(metadata.description).toBe('荒牧祭公式サイト');
  });

  it('サイト既定値へ退避する (id 不正、取得しない)', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(metadata.title).toEqual({ absolute: '荒牧祭' });
    expect(getTopicById).not.toHaveBeenCalled();
  });
});
