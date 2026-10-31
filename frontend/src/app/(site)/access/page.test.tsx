import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessPage, { generateMetadata } from './page';
import { getAccessSettings } from '@/lib/access-settings';
import { getSiteMetadata } from '@/lib/site-metadata';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

const { timetableFile } = vi.hoisted(() => ({
  timetableFile: {
    fetchedAt: '2026-10-30T10:30:00.000Z',
    versions: [] as unknown[],
  },
}));

vi.mock('@/data/bus-timetable.json', () => ({ default: timetableFile }));

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
    timetableFile.versions = [];
    vi.mocked(getAccessSettings).mockResolvedValue({
      summary: '',
      contentHtml: '<p>サイト設定の本文</p>',
      embedUrl: 'https://maps.example.com/embed',
      embedHeight: null,
    });
  });

  it('アクセス設定の取得に失敗しても例外を投げず時刻表と出典は出る', async () => {
    vi.mocked(getAccessSettings).mockRejectedValue(new Error('cms down'));

    render(await AccessPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'アクセス' }),
    ).toBeTruthy();
    expect(screen.getByTestId('bus-data-notice')).toBeTruthy();
  });

  it('h1・サイト設定の本文と地図・関越交通へのリンクを出す', async () => {
    render(await AccessPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'アクセス' }),
    ).toBeTruthy();
    expect(screen.getByText('サイト設定の本文')).toBeTruthy();
    expect(screen.getByTitle('会場周辺の地図').getAttribute('src')).toBe(
      'https://maps.example.com/embed',
    );
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

  it('開催日に合う版があれば、群馬大学行・前橋駅行の表、関越交通リンク、出典の順に出す', async () => {
    timetableFile.versions = [
      {
        version: '20260919',
        validFrom: '2026-09-19',
        validTo: '2027-09-18',
        services: [
          {
            id: '土曜',
            weekdays: [false, false, false, false, false, true, false],
            startDate: '2026-09-19',
            endDate: '2027-03-31',
            added: [],
            removed: [],
          },
        ],
        departures: [
          {
            tripId: 't1',
            serviceId: '土曜',
            route: '22A',
            destination: '前橋駅',
            via: null,
            direction: 'maebashi',
            stop: 'gunma_univ_aramaki',
            stopSequence: 1,
            time: '10:15',
          },
        ],
        campusBound: [
          {
            tripId: 'c1',
            serviceId: '土曜',
            route: '22A',
            time: '09:30',
            alightStop: 'gunma_univ_aramaki',
          },
        ],
      },
    ];
    vi.mocked(getSiteMetadata).mockResolvedValueOnce({
      siteTitle: '荒牧祭',
      description: '荒牧祭公式サイト',
      ogImageUrl: null,
      festival: {
        eventDays: [
          {
            label: null,
            startAt: '2026-11-14T00:00:00+09:00',
            endAt: '2026-11-14T23:59:00+09:00',
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof getSiteMetadata>>);
    render(await AccessPage());

    const campusBound = screen.getByTestId('bus-campus-bound-timetable');
    const maebashi = screen.getByTestId('bus-timetable');
    const link = screen.getByRole('link', {
      name: /関越交通 路線バスの時刻表/,
    });
    const notice = screen.getByTestId('bus-data-notice');
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(campusBound, maebashi)).toBe(true);
    expect(follows(maebashi, link)).toBe(true);
    expect(follows(link, notice)).toBe(true);
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
