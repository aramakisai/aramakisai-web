import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notFound } from 'next/navigation';
import ExhibitionPage, { generateMetadata } from './page';
import { getExhibitionDetail } from '@/lib/exhibitions';
import type {
  ExhibitionDetail,
  ExhibitionDetailResult,
} from '@/lib/exhibitions';
import { getCampusMapAreas } from '@/lib/campus-map';
import type { CampusMapArea, CampusMapDataResult } from '@/lib/campus-map';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/exhibitions', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/exhibitions')>(
      '@/lib/exhibitions',
    );
  return { ...actual, getExhibitionDetail: vi.fn() };
});

vi.mock('@/lib/campus-map', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/campus-map')>(
      '@/lib/campus-map',
    );
  return { ...actual, getCampusMapAreas: vi.fn() };
});

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null, width?: number) =>
    id ? `https://cms.example.com/assets/${id}/${width}` : null,
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'https://cms.example.com',
    NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com',
  },
}));

const baseExhibition: ExhibitionDetail = {
  id: 1,
  category: 'stage',
  displayName: 'アラマキ祭実行委員会 (出演名)',
  organizationName: '実行委員会',
  categories: ['stage', 'exhibit'],
  location: '第一ステージ',
  areaIds: [1],
  thumbnail: { id: '42', alt: 'サムネイル' },
  description: 'たのしい企画です',
  images: [
    { id: '42', alt: 'サムネイル' },
    { id: '43', alt: '写真2' },
  ],
  links: [{ platform: 'x', url: 'https://x.com/aramaki' }],
};

function mockResult(result: ExhibitionDetailResult) {
  vi.mocked(getExhibitionDetail).mockResolvedValue(result);
}

function mockAreas(result: CampusMapDataResult['areas']) {
  vi.mocked(getCampusMapAreas).mockResolvedValue(result);
}

function area(overrides: Partial<CampusMapArea> = {}): CampusMapArea {
  return {
    id: 1,
    name: '第一ステージ',
    color: 'primary',
    sort: 0,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 36.43],
          [139.001, 36.43],
          [139.001, 36.431],
          [139.0, 36.431],
          [139.0, 36.43],
        ],
      ],
    },
    ...overrides,
  };
}

describe('ExhibitionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 企画位置セクションに無関係なテストでは対象なし扱いとし、他セクションへの影響のみを見る
    mockAreas({ kind: 'loaded', value: [] });
  });

  it('URL の category に応じた企画名・場所・全カテゴリを表示する', async () => {
    mockResult({ kind: 'found', value: baseExhibition });

    const jsx = await ExhibitionPage({
      params: Promise.resolve({ id: '1', category: 'stage' }),
    });
    render(jsx);

    expect(getExhibitionDetail).toHaveBeenCalledWith(1, 'stage');
    expect(
      screen.getByRole('heading', {
        name: 'アラマキ祭実行委員会 (出演名)',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('実行委員会')).toBeInTheDocument();
    expect(screen.getByText('ステージ')).toBeInTheDocument();
    expect(screen.getByText('展示')).toBeInTheDocument();
    expect(screen.getByText('第一ステージ')).toBeInTheDocument();
    expect(screen.getByText('たのしい企画です')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '企画一覧へ戻る' }),
    ).toHaveAttribute('href', '/exhibitions');
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://x.com/aramaki',
    );
    expect(screen.getByRole('button', { name: /共有/ })).toBeInTheDocument();
  });

  it('存在しない ID は notFound を呼ぶ', async () => {
    mockResult({ kind: 'missing' });

    await expect(
      ExhibitionPage({
        params: Promise.resolve({ id: '999', category: 'stage' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('その企画が持たないカテゴリは notFound を呼ぶ', async () => {
    mockResult({ kind: 'missing' });

    await expect(
      ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'vendor' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getExhibitionDetail).toHaveBeenCalledWith(1, 'vendor');
    expect(notFound).toHaveBeenCalled();
  });

  it('数値でない ID は取得せず notFound を呼ぶ', async () => {
    await expect(
      ExhibitionPage({
        params: Promise.resolve({ id: 'abc', category: 'stage' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getExhibitionDetail).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });

  it('未知のカテゴリは取得せず notFound を呼ぶ', async () => {
    await expect(
      ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'unknown' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getExhibitionDetail).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalled();
  });

  it('企画位置セクションが描画される場合も、ギャラリー・基本情報・リンク・紹介が従来どおり描画される (要件 1.1, 4.5)', async () => {
    mockResult({ kind: 'found', value: baseExhibition });
    mockAreas({ kind: 'loaded', value: [area()] });

    const jsx = await ExhibitionPage({
      params: Promise.resolve({ id: '1', category: 'stage' }),
    });
    render(jsx);

    expect(
      screen.getByRole('heading', {
        name: 'アラマキ祭実行委員会 (出演名)',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('実行委員会')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://x.com/aramaki',
    );
    expect(screen.getByText('たのしい企画です')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '場所', level: 2 }),
    ).toBeInTheDocument();
  });

  it('区画データの取得に失敗し企画位置セクションが描画されない場合も、ギャラリー・基本情報・リンク・紹介が従来どおり描画される (要件 1.1, 4.2, 4.5)', async () => {
    mockResult({ kind: 'found', value: baseExhibition });
    mockAreas({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });

    const jsx = await ExhibitionPage({
      params: Promise.resolve({ id: '1', category: 'stage' }),
    });
    render(jsx);

    expect(
      screen.getByRole('heading', {
        name: 'アラマキ祭実行委員会 (出演名)',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('実行委員会')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://x.com/aramaki',
    );
    expect(screen.getByText('たのしい企画です')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '場所', level: 2 }),
    ).not.toBeInTheDocument();
  });

  it('取得に失敗した場合は 404 にせず失敗が分かる表示をする', async () => {
    mockResult({ kind: 'error', error: { kind: 'network', status: 500 } });

    const jsx = await ExhibitionPage({
      params: Promise.resolve({ id: '1', category: 'stage' }),
    });
    render(jsx);

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('取得');
    expect(
      screen.getByRole('link', { name: '企画一覧へ戻る' }),
    ).toHaveAttribute('href', '/exhibitions');
  });

  // exhibition-location-section.test.tsx がコンポーネント単体の描画可否を検証するのに対し、
  // ここでは getCampusMapAreas の結果とページの分岐が実際に噛み合うことを確認する
  describe('企画位置セクションの表示可否 (統合)', () => {
    function locationSection(): HTMLElement {
      const heading = screen.getByRole('heading', { name: '場所', level: 2 });
      const section = heading.closest('section');
      if (!section) {
        throw new Error('企画位置セクションの section 要素が見つかりません');
      }
      return section;
    }

    it('所在エリアを持つ企画ではセクションが描画され、キャプションに企画詳細ページの所在地表記が含まれる (要件 4.1)', async () => {
      mockResult({
        kind: 'found',
        value: {
          ...baseExhibition,
          category: 'exhibit',
          categories: ['exhibit'],
          location: 'Aゾーン・ブース1',
          areaIds: [1],
        },
      });
      mockAreas({ kind: 'loaded', value: [area()] });

      const jsx = await ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'exhibit' }),
      });
      render(jsx);

      expect(
        within(locationSection()).getByText('Aゾーン・ブース1'),
      ).toBeInTheDocument();
    });

    it('所在エリアを持たずステージ経由でエリアを解決する企画でもセクションが描画される (要件 4.1)', async () => {
      // baseExhibition は category: 'stage' で、所在地表記もステージ名 (第一ステージ)。
      // 直接の area_id を持たずステージの area_id 経由で解決される企画を表す
      mockResult({ kind: 'found', value: baseExhibition });
      mockAreas({ kind: 'loaded', value: [area()] });

      const jsx = await ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });
      render(jsx);

      expect(
        screen.getByRole('heading', { name: '場所', level: 2 }),
      ).toBeInTheDocument();
    });

    it('対象エリアを持たない企画ではセクションが描画されず、他のセクションは従来どおり描画される (要件 4.1, 4.5)', async () => {
      mockResult({ kind: 'found', value: { ...baseExhibition, areaIds: [] } });
      mockAreas({ kind: 'loaded', value: [area()] });

      const jsx = await ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });
      render(jsx);

      expect(
        screen.queryByRole('heading', { name: '場所', level: 2 }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: baseExhibition.displayName,
          level: 1,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('たのしい企画です')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
        'href',
        'https://x.com/aramaki',
      );
    });

    it('区画データの取得に失敗した場合、セクションは描画されず既存の所在地テキスト表記が維持される (要件 4.2)', async () => {
      mockResult({ kind: 'found', value: baseExhibition });
      mockAreas({ kind: 'error', error: { kind: 'network', status: 500 } });

      const jsx = await ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });
      render(jsx);

      expect(
        screen.queryByRole('heading', { name: '場所', level: 2 }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(baseExhibition.location as string),
      ).toBeInTheDocument();
    });

    it('形状検証に失敗する区画が混在する場合、当該エリアのみが対象から除外される (要件 4.3, 4.4)', async () => {
      mockResult({
        kind: 'found',
        value: { ...baseExhibition, areaIds: [1, 2] },
      });
      // id=1 は geometry の検証に失敗し getCampusMapAreas が除外済み
      // (campus-map.test.ts の「geometry の検証に失敗したエリアは除外し、残りを返す」で担保)
      // という前提を再現し、ページには id=2 のみが渡る状態にする
      mockAreas({ kind: 'loaded', value: [area({ id: 2, name: '第二エリア' })] });

      const jsx = await ExhibitionPage({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });
      render(jsx);

      expect(
        screen.getByRole('heading', { name: '場所', level: 2 }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: '構内マップで見る' }),
      ).toHaveAttribute('href', '/map?area=2');
    });
  });

  describe('generateMetadata', () => {
    it('URL の category に応じた企画名・紹介文・画像を OGP として返す', async () => {
      mockResult({ kind: 'found', value: baseExhibition });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });

      expect(metadata.title).toBe('アラマキ祭実行委員会 (出演名)');
      expect(metadata.description).toBe('たのしい企画です');
      expect(metadata.openGraph?.images).toEqual([
        'https://cms.example.com/assets/42/960',
      ]);
      expect((metadata.twitter as { card?: string } | undefined)?.card).toBe(
        'summary_large_image',
      );
    });

    it('紹介文が未入力なら代替の説明文を使う', async () => {
      mockResult({
        kind: 'found',
        value: { ...baseExhibition, description: null },
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });

      expect(metadata.description).toBe('実行委員会 の企画');
    });

    it('見つからない場合は既定のメタデータのみを返す', async () => {
      mockResult({ kind: 'missing' });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '999', category: 'stage' }),
      });

      expect(metadata).toEqual({});
    });

    it('取得に失敗した場合も既定のメタデータのみを返す', async () => {
      mockResult({ kind: 'error', error: { kind: 'network', status: 500 } });

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: '1', category: 'stage' }),
      });

      expect(metadata).toEqual({});
    });
  });
});
