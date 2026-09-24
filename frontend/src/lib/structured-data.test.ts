import { describe, it, expect } from 'vitest';
import {
  buildEventJsonLd,
  buildOrganizationJsonLd,
  buildBreadcrumbJsonLd,
} from './structured-data';
import type { SiteMetadata } from './site-metadata';
import type { FestivalMeta } from './home-page-types';

const SITE_URL = 'https://aramakisai.example';

const BASE_FESTIVAL: FestivalMeta = {
  name: '荒牧祭',
  eventDays: [],
  overviewHtml: null,
  heroImageId: null,
  siteTitle: null,
  metaDescription: null,
  ogImageId: null,
  venueName: null,
  venueAddress: null,
  snsLinks: [],
};

const BASE_SITE: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

describe('buildEventJsonLd', () => {
  it('festival が取得できていなければ null を返す', () => {
    const result = buildEventJsonLd({ site: BASE_SITE, siteUrl: SITE_URL });
    expect(result).toBeNull();
  });

  it('開催日程が空なら null を返す', () => {
    const result = buildEventJsonLd({
      site: { ...BASE_SITE, festival: BASE_FESTIVAL },
      siteUrl: SITE_URL,
    });
    expect(result).toBeNull();
  });

  it('複数日の開催日程から startDate/endDate を最初/最後の日で設定する', () => {
    const result = buildEventJsonLd({
      site: {
        ...BASE_SITE,
        festival: {
          ...BASE_FESTIVAL,
          eventDays: [
            {
              label: '1日目',
              startAt: '2026-10-10T09:00:00+09:00',
              endAt: '2026-10-10T17:00:00+09:00',
            },
            {
              label: '2日目',
              startAt: '2026-10-11T09:00:00+09:00',
              endAt: '2026-10-11T17:00:00+09:00',
            },
          ],
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result).not.toBeNull();
    expect(result!['@type']).toBe('Event');
    expect(result!.startDate).toBe('2026-10-10T09:00:00+09:00');
    expect(result!.endDate).toBe('2026-10-11T17:00:00+09:00');
    expect(result!.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(result!.eventAttendanceMode).toBe(
      'https://schema.org/OfflineEventAttendanceMode',
    );
    expect(result!.url).toBe(SITE_URL);
  });

  it('会場住所が未設定なら location から address を省略する', () => {
    const result = buildEventJsonLd({
      site: {
        ...BASE_SITE,
        festival: {
          ...BASE_FESTIVAL,
          eventDays: [
            {
              label: null,
              startAt: '2026-10-10T09:00:00+09:00',
              endAt: '2026-10-10T17:00:00+09:00',
            },
          ],
          venueName: '荒牧キャンパス',
          venueAddress: null,
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result!.location).toEqual({
      '@type': 'Place',
      name: '荒牧キャンパス',
    });
  });

  it('会場名も未設定なら location 自体を省略する', () => {
    const result = buildEventJsonLd({
      site: {
        ...BASE_SITE,
        festival: {
          ...BASE_FESTIVAL,
          eventDays: [
            {
              label: null,
              startAt: '2026-10-10T09:00:00+09:00',
              endAt: '2026-10-10T17:00:00+09:00',
            },
          ],
          venueName: null,
          venueAddress: '群馬県前橋市',
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result!.location).toBeUndefined();
  });

  it('サイトの OG 画像が無ければ image を省略する', () => {
    const result = buildEventJsonLd({
      site: {
        ...BASE_SITE,
        ogImageUrl: null,
        festival: {
          ...BASE_FESTIVAL,
          eventDays: [
            {
              label: null,
              startAt: '2026-10-10T09:00:00+09:00',
              endAt: '2026-10-10T17:00:00+09:00',
            },
          ],
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result!.image).toBeUndefined();
  });

  it('サイトの OG 画像があれば image に設定する', () => {
    const result = buildEventJsonLd({
      site: {
        ...BASE_SITE,
        ogImageUrl: 'https://cms.example/api/media/serve/abc/hero',
        festival: {
          ...BASE_FESTIVAL,
          eventDays: [
            {
              label: null,
              startAt: '2026-10-10T09:00:00+09:00',
              endAt: '2026-10-10T17:00:00+09:00',
            },
          ],
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result!.image).toBe('https://cms.example/api/media/serve/abc/hero');
  });

  it('organizer に Organization の JSON-LD を埋め込む', () => {
    const result = buildEventJsonLd({
      site: {
        ...BASE_SITE,
        festival: {
          ...BASE_FESTIVAL,
          eventDays: [
            {
              label: null,
              startAt: '2026-10-10T09:00:00+09:00',
              endAt: '2026-10-10T17:00:00+09:00',
            },
          ],
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result!.organizer).toEqual(
      buildOrganizationJsonLd({ site: BASE_SITE, siteUrl: SITE_URL }),
    );
  });
});

describe('buildOrganizationJsonLd', () => {
  it('荒牧祭実行委員会を name に設定し、favicon から logo を絶対 URL で組み立てる', () => {
    const result = buildOrganizationJsonLd({
      site: BASE_SITE,
      siteUrl: SITE_URL,
    });

    expect(result['@type']).toBe('Organization');
    expect(result.name).toBe('荒牧祭実行委員会');
    expect(result.url).toBe(SITE_URL);
    expect(result.logo).toBe('https://aramakisai.example/images/favicon.png');
  });

  it('sns_links が無ければ sameAs を省略する', () => {
    const result = buildOrganizationJsonLd({
      site: BASE_SITE,
      siteUrl: SITE_URL,
    });
    expect(result.sameAs).toBeUndefined();
  });

  it('sns_links があれば sameAs に列挙する', () => {
    const result = buildOrganizationJsonLd({
      site: {
        ...BASE_SITE,
        festival: {
          ...BASE_FESTIVAL,
          snsLinks: [
            { platform: 'x', url: 'https://x.com/aramakisai' },
            { platform: 'instagram', url: 'https://instagram.com/aramakisai' },
          ],
        },
      },
      siteUrl: SITE_URL,
    });

    expect(result.sameAs).toEqual([
      'https://x.com/aramakisai',
      'https://instagram.com/aramakisai',
    ]);
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('階層をトップからの ListItem として絶対 URL で出力する', () => {
    const result = buildBreadcrumbJsonLd(
      [
        { name: 'トップ', path: '/' },
        { name: 'お知らせ', path: '/announcements' },
        { name: '休講のお知らせ', path: '/announcements/1' },
      ],
      SITE_URL,
    );

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('BreadcrumbList');
    expect(result.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'トップ',
        item: 'https://aramakisai.example/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'お知らせ',
        item: 'https://aramakisai.example/announcements',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: '休講のお知らせ',
        item: 'https://aramakisai.example/announcements/1',
      },
    ]);
  });
});
