import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import ExhibitionsPage, { generateMetadata } from './page';
import * as exhibitionsModule from '@/lib/exhibitions';
import * as siteMetadataModule from '@/lib/site-metadata';
import type {
  ExhibitionCardSummary,
  ExhibitionListResult,
} from '@/lib/exhibitions';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/exhibitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/exhibitions')>();
  return { ...actual, getExhibitionListData: vi.fn() };
});

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mocked(useRouter).mockReturnValue({
  replace: vi.fn(),
} as unknown as ReturnType<typeof useRouter>);

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

function listResult(
  overrides: Partial<ExhibitionListResult>,
): ExhibitionListResult {
  return {
    items: [],
    total: 0,
    page: 1,
    pageCount: 1,
    rangeStart: 0,
    rangeEnd: 0,
    areas: [],
    ...overrides,
  };
}

async function renderPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return render(
    await ExhibitionsPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

describe('ExhibitionsPage', () => {
  beforeEach(() => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockReset();
    vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
      SITE_METADATA,
    );
  });

  it('通常表示: 企画カード・件数・検索欄を表示する', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue(
      listResult({
        items: [
          exhibition({ id: 1, displayName: 'ロボット企画' }),
          exhibition({ id: 2, displayName: '吹奏楽部演奏' }),
        ],
        total: 2,
        rangeStart: 1,
        rangeEnd: 2,
      }),
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

  it('0 件: 公開済み企画が無い旨を表示し、条件不一致メッセージは出さない', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue(
      listResult({}),
    );

    await renderPage();

    expect(
      screen.getByText('企画はまだ公開されていません'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('条件に一致する企画はありません'),
    ).not.toBeInTheDocument();
  });

  it('条件不一致: 検索条件に一致しない旨を表示し、未公開メッセージは出さない', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue(
      listResult({}),
    );

    await renderPage({ q: '存在しない企画名' });

    expect(
      screen.getByText('条件に一致する企画はありません'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('企画はまだ公開されていません'),
    ).not.toBeInTheDocument();
  });

  it('取得失敗: 空の一覧ではなく取得失敗が分かる表示にする', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockRejectedValue(
      new Error('CMS error'),
    );

    await renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('取得に失敗');
    expect(
      screen.queryByText('企画はまだ公開されていません'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('ページ送りは現在の検索条件を維持した URL を生成する', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue(
      listResult({
        items: [exhibition({ id: 1, displayName: 'ロボット企画' })],
        total: 30,
        page: 1,
        pageCount: 2,
        rangeStart: 1,
        rangeEnd: 24,
      }),
    );

    await renderPage({ category: 'stage' });

    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      '/exhibitions?category=stage&page=2',
    );
  });

  it('同じ検索条件を開き直すと同じ結果が再現される', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue(
      listResult({
        items: [exhibition({ id: 1, displayName: 'ロボット企画' })],
        total: 1,
        rangeStart: 1,
        rangeEnd: 1,
      }),
    );

    const first = await renderPage({ q: 'ロボット' });
    const firstHtml = first.container.innerHTML;
    first.unmount();

    const second = await renderPage({ q: 'ロボット' });
    expect(second.container.innerHTML).toBe(firstHtml);
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
