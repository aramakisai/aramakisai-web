import { describe, expect, it, vi } from 'vitest';
import {
  buildPlaylist,
  eventDayIndex,
  paginateLostItems,
  paginateSponsors,
  type SignageSlide,
  type SignageSnapshot,
  type SignageSponsor,
  type SignageLostItem,
} from './signage';
import type { Timetable, TimetablePerformance } from './timetable';

vi.mock('./cms', () => ({ cms: {} }));

const DAYS = [
  {
    label: null,
    startAt: '2026-11-14T10:00:00+09:00',
    endAt: '2026-11-14T17:30:00+09:00',
  },
  {
    label: null,
    startAt: '2026-11-15T10:00:00+09:00',
    endAt: '2026-11-15T16:30:00+09:00',
  },
];

function perf(
  id: number,
  stageId: number,
  start: string,
  end: string,
  date = '2026-11-14',
): TimetablePerformance {
  return {
    id,
    stageId,
    name: `p${id}`,
    href: null,
    slot: {
      dateKey: date,
      startAt: new Date(`${date}T${start}:00+09:00`).toISOString(),
      endAt: new Date(`${date}T${end}:00+09:00`).toISOString(),
    },
  };
}

const sponsor = (
  id: number,
  tier: SignageSponsor['tier'],
  logo = true,
): SignageSponsor => ({
  id,
  name: `s${id}`,
  tier,
  logoId: logo ? `${id}` : null,
});

const lost = (id: number): SignageLostItem => ({
  id,
  name: `l${id}`,
  foundPlace: '',
  foundAt: '2026-11-14T10:00:00+09:00',
  photoId: null,
});

const base = { durationSec: 10, pinned: false } as const;
const slide = (
  id: number,
  kind: 'sponsors' | 'lost_items' | 'parking' | 'timetable',
  pinned = false,
): SignageSlide => ({ id, kind, durationSec: 10, pinned });

function snapshot(over: Partial<SignageSnapshot> = {}): SignageSnapshot {
  return {
    fetchedAt: '',
    eventDays: DAYS,
    slides: [],
    telops: [],
    timetable: {
      days: [],
      stages: [{ id: 1, name: 'A' }],
      performances: [perf(1, 1, '10:00', '11:00')],
    },
    sponsors: [sponsor(1, 'planA')],
    lostItems: [lost(1)],
    parking: {
      isEventDay: true,
      fetchedAt: '',
      lots: [{ id: 1, name: 'P', status: 'available', updatedAt: null }],
    },
    ...over,
  };
}

const NOW = new Date('2026-11-14T12:00:00+09:00');

describe('buildPlaylist', () => {
  it('並び順どおりに展開し、鍵は slideId:page', () => {
    const list = buildPlaylist(
      snapshot({
        slides: [slide(2, 'parking'), slide(1, 'sponsors')],
        lostItems: [],
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['2:0', '1:0']);
  });

  it('複数ページのスライドはページごとに展開する', () => {
    const list = buildPlaylist(
      snapshot({
        slides: [slide(1, 'lost_items')],
        lostItems: Array.from({ length: 9 }, (_, i) => lost(i)),
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['1:0', '1:1']);
  });

  it('固定表示があれば先頭の固定スライドのページだけを返す', () => {
    const list = buildPlaylist(
      snapshot({
        slides: [
          slide(1, 'parking'),
          slide(2, 'sponsors', true),
          slide(3, 'lost_items', true),
        ],
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['2:0']);
  });

  it('空の自動スライドを除く', () => {
    const image = (id: number, withImage: boolean): SignageSlide => ({
      ...base,
      id,
      kind: 'image',
      image: withImage
        ? { id: 'x', filenameDownload: 'x', type: null, filesize: null }
        : null,
    });
    const list = buildPlaylist(
      snapshot({
        slides: [
          slide(1, 'sponsors'),
          slide(2, 'lost_items'),
          slide(3, 'parking'),
          slide(4, 'timetable'),
          image(5, false),
          image(6, true),
        ],
        sponsors: [],
        lostItems: [],
        parking: {
          isEventDay: false,
          fetchedAt: '',
          lots: [{ id: 1, name: 'P', status: null, updatedAt: null }],
        },
        timetable: { days: [], stages: [], performances: [] },
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['6:0']);
  });

  it('当日以外の公演しかなければタイムテーブルを除く', () => {
    const t: Timetable = {
      days: [],
      stages: [{ id: 1, name: 'A' }],
      performances: [perf(1, 1, '10:00', '11:00', '2026-11-15')],
    };
    expect(
      buildPlaylist(
        snapshot({ slides: [slide(1, 'timetable')], timetable: t }),
        NOW,
      ),
    ).toEqual([]);
  });

  it('固定スライドが空なら何も出さない', () => {
    expect(
      buildPlaylist(
        snapshot({
          slides: [slide(1, 'sponsors', true), slide(2, 'parking')],
          sponsors: [],
        }),
        NOW,
      ),
    ).toEqual([]);
  });
});

describe('eventDayIndex', () => {
  it('開催日は1始まりの日数、それ以外は null', () => {
    expect(eventDayIndex(DAYS, new Date('2026-11-14T00:30:00+09:00'))).toBe(1);
    expect(eventDayIndex(DAYS, new Date('2026-11-15T23:59:00+09:00'))).toBe(2);
    expect(
      eventDayIndex(DAYS, new Date('2026-11-13T23:59:00+09:00')),
    ).toBeNull();
  });
});

describe('paginateLostItems', () => {
  it('8件ずつに分ける', () => {
    const sizes = (n: number) =>
      paginateLostItems(Array.from({ length: n }, (_, i) => lost(i))).map(
        (p) => p.length,
      );
    expect(sizes(0)).toEqual([]);
    expect(sizes(8)).toEqual([8]);
    expect(sizes(9)).toEqual([8, 1]);
  });
});

describe('paginateSponsors', () => {
  it('A〜Cかつロゴありはロゴ行、それ以外は社名行に振り分ける', () => {
    const pages = paginateSponsors([
      sponsor(1, 'planA'),
      sponsor(2, 'planB'),
      sponsor(3, 'planC'),
      sponsor(4, 'planD'),
      sponsor(5, null),
      sponsor(6, 'planA', false),
    ]);
    expect(pages).toHaveLength(1);
    expect(pages[0].map((r) => (r.kind === 'logo' ? r.tier : 'names'))).toEqual(
      ['planA', 'planB', 'planC', 'names'],
    );
    expect(pages[0][3].items.map((s) => s.id)).toEqual([4, 5, 6]);
  });

  it('列数で行を折り返す(A=3列, B=4列, C=6列, 社名=4列)', () => {
    const pages = paginateSponsors([
      ...[1, 2, 3, 4].map((i) => sponsor(i, 'planC')),
      ...[11, 12, 13, 14, 15, 16, 17].map((i) => sponsor(i, 'planC')),
    ]);
    expect(pages[0].map((r) => r.items.length)).toEqual([6, 5]);
  });

  it('行高の合計が704を超える位置でページを分ける', () => {
    // A 232 + 32 + B 176 + 32 + C 128 + 32 + 社名 24 = 656 ... A+B+C+社名1行は収まる
    const fit = paginateSponsors([
      sponsor(1, 'planA'),
      sponsor(2, 'planB'),
      sponsor(3, 'planC'),
      sponsor(4, 'planD'),
    ]);
    expect(fit).toHaveLength(1);
    // A2行 = 232+24+232 = 488, +32+B 176 = 696 ≤ 704, +32+C は超える
    const over = paginateSponsors([
      ...[1, 2, 3, 4].map((i) => sponsor(i, 'planA')),
      sponsor(5, 'planB'),
      sponsor(6, 'planC'),
    ]);
    expect(
      over.map((p) => p.map((r) => (r.kind === 'logo' ? r.tier : 'names'))),
    ).toEqual([['planA', 'planA', 'planB'], ['planC']]);
  });

  it('0件は0ページ', () => {
    expect(paginateSponsors([])).toEqual([]);
  });
});
