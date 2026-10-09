import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import ExhibitionsPage, { generateMetadata, revalidate } from './page';
import * as exhibitionsModule from '@/lib/exhibitions';
import * as siteMetadataModule from '@/lib/site-metadata';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/exhibitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/exhibitions')>();
  return { ...actual, getExhibitionCatalog: vi.fn() };
});

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

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
