import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaticPage, { generateMetadata } from './page';
import { getPageBySlug } from '@/lib/static-page';
import { notFound } from 'next/navigation';

vi.mock('@/lib/static-page', () => ({
  getPageBySlug: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
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

describe('StaticPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page content and embed when slug is found', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'お問い合わせ',
      contentHtml: '<p>お問い合わせ本文</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
    });

    const params = Promise.resolve({ slug: 'contact' });
    render(await StaticPage({ params }));

    expect(
      screen.getByRole('heading', { name: 'お問い合わせ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('お問い合わせ本文')).toBeInTheDocument();
    expect(screen.getByTitle('お問い合わせ')).toHaveAttribute(
      'src',
      'https://forms.example.com',
    );
  });

  it('renders the privacy policy via the generic static page route', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'プライバシーポリシー',
      contentHtml: '<h2>1. 取得する情報</h2><ul><li>氏名</li></ul>',
      embedUrl: null,
      embedHeight: null,
    });

    const params = Promise.resolve({ slug: 'privacy' });
    render(await StaticPage({ params }));

    expect(
      screen.getByRole('heading', { name: 'プライバシーポリシー' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '1. 取得する情報' }),
    ).toBeInTheDocument();
    expect(screen.getByText('氏名')).toBeInTheDocument();
  });

  it('calls notFound when slug does not exist', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue(null);

    const params = Promise.resolve({ slug: 'unknown' });
    await expect(StaticPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });

  it('パンくず (トップ › タイトル) の BreadcrumbList JSON-LD を出力する (要件 5.7)', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'アクセス',
      contentHtml: '<p>本文</p>',
      embedUrl: null,
      embedHeight: null,
    });

    const params = Promise.resolve({ slug: 'access' });
    const { container } = render(await StaticPage({ params }));

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(
      data.itemListElement.map((item: { name: string }) => item.name),
    ).toEqual(['トップ', 'アクセス']);
    expect(data.itemListElement[1].item).toBe(
      'https://aramakisai.example.com/access',
    );
  });

  it('generateMetadata returns page title when found', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'アクセス',
      contentHtml: '<p>アクセス方法の説明</p>',
      embedUrl: null,
      embedHeight: null,
    });

    const params = Promise.resolve({ slug: 'access' });
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe('アクセス');
    expect(metadata.description).toBe('アクセス方法の説明');
    expect(metadata.alternates).toEqual({ canonical: '/access' });
  });

  it('ページ固有の meta description が優先される (要件 6.9)', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'アクセス',
      contentHtml: '<p>アクセス方法の説明</p>',
      embedUrl: null,
      embedHeight: null,
      metaDescription: '編集者が設定した説明文',
    });

    const params = Promise.resolve({ slug: 'access' });
    const metadata = await generateMetadata({ params });

    expect(metadata.description).toBe('編集者が設定した説明文');
  });

  it('generateMetadata returns site defaults when slug not found (要件 2.10 / 8.1)', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue(null);

    const params = Promise.resolve({ slug: 'unknown' });
    const metadata = await generateMetadata({ params });

    expect(metadata.title).toEqual({ absolute: '荒牧祭' });
    expect(metadata.description).toBe('荒牧祭公式サイト');
  });
});
