import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import ExhibitionsPage, { generateMetadata, revalidate } from './page';
import * as exhibitionsModule from '@/lib/exhibitions';
import * as corporateBoothsModule from '@/lib/corporate-booths';
import * as siteMetadataModule from '@/lib/site-metadata';
import type {
  CorporateBoothCard,
  ExhibitionCardSummary,
} from '@/lib/exhibitions';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/exhibitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/exhibitions')>();
  return { ...actual, getExhibitionCatalog: vi.fn() };
});

vi.mock('@/lib/corporate-booths', () => ({
  getCorporateBoothCards: vi.fn(),
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

vi.mock('@/lib/cms-asset-url', () => {
  const toAssetUrl = (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null;
  return {
    toAssetUrl,
    toCardImageUrl: (image: { id: string }) => toAssetUrl(image.id),
    toHeroImage: (image: { id: string }) => {
      const src = toAssetUrl(image.id);
      return src ? { src } : null;
    },
  };
});

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

function exhibition(
  overrides: Partial<ExhibitionCardSummary>,
): ExhibitionCardSummary {
  return {
    id: 1,
    category: 'exhibit',
    displayName: '企画',
    organizationName: '団体',
    location: null,
    areaIds: [],
    thumbnail: null,
    ...overrides,
  };
}

function booth(overrides: Partial<CorporateBoothCard>): CorporateBoothCard {
  return {
    id: 1,
    category: 'booth',
    displayName: 'ブース',
    organizationName: '企業',
    location: null,
    areaIds: [],
    thumbnail: null,
    ...overrides,
  };
}

function catalog(cards: ExhibitionCardSummary[] = []) {
  return { cards, areas: [] };
}

async function renderPage() {
  return render(await ExhibitionsPage());
}

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

describe('ExhibitionsPage', () => {
  beforeEach(() => {
    vi.mocked(exhibitionsModule.getExhibitionCatalog).mockReset();
    vi.mocked(corporateBoothsModule.getCorporateBoothCards)
      .mockReset()
      .mockResolvedValue([]);
    vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
      SITE_METADATA,
    );
    window.history.replaceState(null, '', '/exhibitions');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('全カードを渡し、件数・検索欄を表示する', async () => {
    vi.mocked(exhibitionsModule.getExhibitionCatalog).mockResolvedValue(
      catalog([
        exhibition({ id: 1, displayName: 'ロボット企画' }),
        exhibition({ id: 2, displayName: '吹奏楽部演奏' }),
      ]),
    );

    await renderPage();

    expect(
      screen.getByRole('heading', { name: '企画一覧' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ロボット企画')).toBeInTheDocument();
    expect(screen.getByText('吹奏楽部演奏')).toBeInTheDocument();
    expect(screen.getByText('全 2 件中 1–2 件を表示')).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: '企画を検索' }),
    ).toBeInTheDocument();
  });

  it('企業ブースを学生企画の後ろに並べ、「企業ブース」で絞り込める', async () => {
    vi.mocked(exhibitionsModule.getExhibitionCatalog).mockResolvedValue(
      catalog([exhibition({ id: 1, displayName: 'ロボット企画' })]),
    );
    vi.mocked(corporateBoothsModule.getCorporateBoothCards).mockResolvedValue([
      booth({ id: 7, displayName: 'たこ焼きブース' }),
    ]);

    await renderPage();

    const titles = screen
      .getAllByRole('link')
      .map((a) => a.textContent ?? '')
      .filter((t) => /ロボット企画|たこ焼きブース/.test(t));
    expect(titles[0]).toContain('ロボット企画');
    expect(titles[1]).toContain('たこ焼きブース');
    expect(
      screen.getByRole('link', { name: /たこ焼きブース/ }),
    ).toHaveAttribute('href', '/exhibitions/booth/7');

    window.history.replaceState(null, '', '/exhibitions?category=booth');
    cleanup();
    await renderPage();
    expect(screen.queryByText('ロボット企画')).not.toBeInTheDocument();
    expect(screen.getByText('たこ焼きブース')).toBeInTheDocument();
  });

  it('企業ブースの実行時の取得失敗は例外のまま伝える', async () => {
    vi.mocked(exhibitionsModule.getExhibitionCatalog).mockResolvedValue(
      catalog(),
    );
    vi.mocked(corporateBoothsModule.getCorporateBoothCards).mockRejectedValue(
      new Error('booth error'),
    );

    await expect(ExhibitionsPage()).rejects.toThrow('booth error');
  });

  it('実行時の取得失敗は例外のまま伝える (ISR が古いページを保つため)', async () => {
    vi.mocked(exhibitionsModule.getExhibitionCatalog).mockRejectedValue(
      new Error('CMS error'),
    );

    await expect(ExhibitionsPage()).rejects.toThrow('CMS error');
  });

  it('ビルド時 (CMS 不在) の取得失敗は空の一覧で描画する', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.mocked(exhibitionsModule.getExhibitionCatalog).mockRejectedValue(
      new Error('CMS error'),
    );

    await renderPage();

    expect(
      screen.getByText('企画はまだ公開されていません'),
    ).toBeInTheDocument();
  });

  it('ISR 化されている (searchParams を読まない)', () => {
    expect(revalidate).toBe(60);
    expect(ExhibitionsPage.length).toBe(0);
  });
});

describe('generateMetadata (要件2.3, 2.9)', () => {
  it('title / description を持ち、絞り込み条件を含まない canonical を設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('企画一覧');
    expect(metadata.description).toMatch(/企画/);
    expect(metadata.alternates).toEqual({ canonical: '/exhibitions' });
  });
});
