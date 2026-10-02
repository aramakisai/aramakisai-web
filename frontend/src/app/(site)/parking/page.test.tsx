import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ParkingPage, { dynamic, generateMetadata } from './page';
import { getParkingResponse } from '@/lib/parking-data';

vi.mock('@/lib/parking-data', () => ({ getParkingResponse: vi.fn() }));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

const FETCHED_AT = '2026-10-24T04:42:00Z';

describe('ParkingPage', () => {
  it('毎リクエスト描画する', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('公開時は一覧を表示する', async () => {
    vi.mocked(getParkingResponse).mockResolvedValue({
      ok: true,
      value: {
        enabled: true,
        fetchedAt: FETCHED_AT,
        lots: [
          {
            id: 1,
            name: '正門前駐車場',
            status: 'available',
            updatedAt: '2026-10-24T04:40:00Z',
          },
        ],
      },
    } as never);

    render(await ParkingPage());

    expect(
      screen.getByRole('heading', { name: '駐車場空き情報', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
  });

  it('非公開時は非公開の文言だけを表示する', async () => {
    vi.mocked(getParkingResponse).mockResolvedValue({
      ok: true,
      value: { enabled: false },
    });

    render(await ParkingPage());

    expect(
      screen.getByText('現在、駐車場空き情報は公開していません'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('取得失敗時はエラー表示で描画する', async () => {
    vi.mocked(getParkingResponse).mockResolvedValue({
      ok: false,
      error: new Error('x'),
    } as never);

    render(await ParkingPage());

    expect(screen.getByText('最新の情報を取得できません')).toBeInTheDocument();
  });

  it('メタデータにタイトルと canonical を設定する', async () => {
    const meta = await generateMetadata();

    expect(meta.title).toBe('駐車場空き情報');
    expect(meta.alternates?.canonical).toContain('/parking');
  });
});
