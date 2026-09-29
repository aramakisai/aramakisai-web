import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FaqPage, { generateMetadata } from './page';
import * as faqModule from '@/lib/faq';
import * as siteMetadataModule from '@/lib/site-metadata';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/faq', () => ({
  getFaqItems: vi.fn(),
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(SITE_METADATA);

describe('FaqPage', () => {
  it('全件の質問と回答が表示される', async () => {
    vi.mocked(faqModule.getFaqItems).mockResolvedValue([
      {
        id: 1,
        question: '駐車場はありますか?',
        answer: '駐車場はありません。',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        question: '入場は無料ですか?',
        answer: 'はい、無料です。',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    render(await FaqPage());

    expect(
      screen.getByRole('heading', { name: 'よくある質問' }),
    ).toBeInTheDocument();
    expect(screen.getByText('駐車場はありますか?')).toBeInTheDocument();
    expect(screen.getByText('入場は無料ですか?')).toBeInTheDocument();
  });

  it('0件時は主見出しとともに空状態メッセージが表示される', async () => {
    vi.mocked(faqModule.getFaqItems).mockResolvedValue([]);

    render(await FaqPage());

    expect(
      screen.getByRole('heading', { name: 'よくある質問' }),
    ).toBeInTheDocument();
    expect(screen.getByText('よくある質問はありません')).toBeInTheDocument();
  });

  it('取得失敗時は0件時と同じ空状態メッセージにフォールバックする', async () => {
    vi.mocked(faqModule.getFaqItems).mockRejectedValue(new Error('CMS Error'));

    render(await FaqPage());

    expect(
      screen.getByRole('heading', { name: 'よくある質問' }),
    ).toBeInTheDocument();
    expect(screen.getByText('よくある質問はありません')).toBeInTheDocument();
  });

  it('トップ→よくある質問の2階層パンくずJSON-LDを出力し、FAQPageは出力しない', async () => {
    vi.mocked(faqModule.getFaqItems).mockResolvedValue([]);

    const { container } = render(await FaqPage());

    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);

    const data = JSON.parse(scripts[0].textContent!);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(
      data.itemListElement.map((item: { name: string }) => item.name),
    ).toEqual(['トップ', 'よくある質問']);
    expect(data.itemListElement[1].item).toBe(
      'https://aramakisai.example.com/faq',
    );

    expect(
      Array.from(scripts).some(
        (script) => JSON.parse(script.textContent!)['@type'] === 'FAQPage',
      ),
    ).toBe(false);
  });
});

describe('generateMetadata', () => {
  it('title / description / canonical を設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('よくある質問');
    expect(metadata.description).toBe(
      '荒牧祭についてよくある質問と回答をまとめています。',
    );
    expect(metadata.alternates).toEqual({ canonical: '/faq' });
  });
});
