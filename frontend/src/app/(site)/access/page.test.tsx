import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessPage, { generateMetadata } from './page';
import { getAccessSettings } from '@/lib/access-settings';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

vi.mock('@/data/bus-timetable.json', () => ({
  default: { fetchedAt: '2026-10-30T10:30:00.000Z', versions: [] },
}));

vi.mock('@/lib/use-bus-realtime', () => ({ useBusRealtime: () => null }));

vi.mock('@/lib/access-settings', () => ({ getAccessSettings: vi.fn() }));

vi.mock('@/lib/cms-asset-url', () => ({ toAssetUrl: () => null }));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

describe('AccessPage', () => {
  beforeEach(() => {
    vi.mocked(getAccessSettings).mockResolvedValue({
      summary: '',
      contentHtml: '<p>サイト設定の本文</p>',
      embedUrl: 'https://maps.example.com/embed',
      embedHeight: null,
    });
  });

  it('h1・サイト設定の本文と地図・次の便の案内・関越交通へのリンクを出す', async () => {
    render(await AccessPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'アクセス' }),
    ).toBeTruthy();
    expect(screen.getByText('サイト設定の本文')).toBeTruthy();
    expect(screen.getByTitle('会場周辺の地図').getAttribute('src')).toBe(
      'https://maps.example.com/embed',
    );
    expect(screen.queryByTestId('bus-departure-board')).toBeNull();
    expect(
      screen
        .getByRole('link', { name: /関越交通 路線バスの時刻表/ })
        .getAttribute('href'),
    ).toBe('https://kan-etsu.net/pages/23/');
  });

  it('その日に合う版が無ければ時刻表を出さずリンクだけを出す', async () => {
    render(await AccessPage());

    expect(screen.queryByTestId('bus-timetable')).toBeNull();
    expect(
      screen.getByRole('link', { name: /関越交通 路線バスの時刻表/ }),
    ).toBeTruthy();
  });

  it('関越交通へのリンクの直後に出典の全文を置く', async () => {
    render(await AccessPage());

    const link = screen.getByRole('link', {
      name: /関越交通 路線バスの時刻表/,
    });
    const notice = screen.getByTestId('bus-data-notice');
    expect(link.nextElementSibling).toBe(notice);
    expect(notice.textContent).toContain('時刻表の取得日時: 2026/10/30 19:30');
  });

  it('メタデータは /access の定数を使う', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('アクセス');
  });
});
