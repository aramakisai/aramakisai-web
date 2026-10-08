import { describe, expect, it, vi } from 'vitest';
import {
  buildPlaylist,
  slideAt,
  eventDayIndex,
  paginateLostItems,
  paginateSponsors,
  stageNow,
  timetableWindow,
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

const base = { durationSec: 10 } as const;
const slide = (
  id: number,
  kind: 'sponsors' | 'lost_items' | 'parking' | 'timetable',
  durationSec = 10,
): SignageSlide => ({ id, kind, durationSec });

function snapshot(over: Partial<SignageSnapshot> = {}): SignageSnapshot {
  return {
    fetchedAt: '',
    serverNow: '',
    pinnedSlideId: null,
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

  it('固定スライドが有効スライドにあればそのページだけを返す', () => {
    const list = buildPlaylist(
      snapshot({
        pinnedSlideId: 2,
        slides: [
          slide(1, 'parking'),
          slide(2, 'sponsors'),
          slide(3, 'lost_items'),
        ],
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['2:0']);
  });

  it('固定スライドが有効スライドに無ければ(無効化・削除)通常の巡回に戻る', () => {
    const list = buildPlaylist(
      snapshot({
        pinnedSlideId: 99,
        slides: [slide(1, 'parking'), slide(2, 'sponsors')],
        lostItems: [],
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['1:0', '2:0']);
  });

  it('固定スライドが複数ページなら全ページを巡回する', () => {
    const list = buildPlaylist(
      snapshot({
        pinnedSlideId: 3,
        slides: [slide(1, 'parking'), slide(3, 'lost_items')],
        lostItems: Array.from({ length: 9 }, (_, i) => lost(i)),
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['3:0', '3:1']);
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
          pinnedSlideId: 1,
          slides: [slide(1, 'sponsors'), slide(2, 'parking')],
          sponsors: [],
        }),
        NOW,
      ),
    ).toEqual([]);
  });
});

describe('slideAt', () => {
  const entries = buildPlaylist(
    snapshot({
      slides: [slide(1, 'parking', 10), slide(2, 'sponsors', 20)],
    }),
    NOW,
  ); // 周期30秒

  it('0件、表示秒数の合計0ではnull', () => {
    expect(slideAt([], 5000)).toBeNull();
    const zero = buildPlaylist(
      snapshot({ slides: [slide(1, 'parking', 0)] }),
      NOW,
    );
    expect(slideAt(zero, 5000)).toBeNull();
  });

  it('時刻から現在の項目と項目内の経過を決める', () => {
    expect(slideAt(entries, 0)).toMatchObject({ elapsedMs: 0 });
    expect(slideAt(entries, 9_999)?.entry.key).toBe('1:0');
    expect(slideAt(entries, 9_999)?.elapsedMs).toBe(9_999);
    expect(slideAt(entries, 10_000)?.entry.key).toBe('2:0');
    expect(slideAt(entries, 10_000)?.elapsedMs).toBe(0);
    expect(slideAt(entries, 29_999)?.entry.key).toBe('2:0');
  });

  it('周期の境目で先頭へ戻り、エポックからの経過が同じなら同じ項目', () => {
    expect(slideAt(entries, 30_000)?.entry.key).toBe('1:0');
    const t = 1_700_000_000_000;
    expect(slideAt(entries, t)?.entry.key).toBe(
      slideAt(entries, t + 30_000 * 7)?.entry.key,
    );
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

describe('stageNow', () => {
  const tt: Timetable = {
    days: [],
    stages: [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ],
    performances: [
      perf(1, 1, '10:00', '11:00'),
      perf(2, 1, '10:30', '11:30'),
      perf(3, 2, '12:00', '13:00'),
    ],
  };
  const at = (t: string) => stageNow(tt, new Date(`2026-11-14T${t}:00+09:00`));

  it('全ステージをタイムテーブル順に返し、公演が無ければ null', () => {
    const rows = at('09:00');
    expect(rows.map((r) => [r.stage.id, r.colorIndex, r.performance])).toEqual([
      [1, 0, null],
      [2, 1, null],
    ]);
  });

  it('開始ちょうどは出演中、終了ちょうどは対象外', () => {
    expect(at('12:00')[1].performance?.id).toBe(3);
    expect(at('13:00')[1].performance).toBeNull();
    expect(at('11:30')[0].performance).toBeNull();
  });

  it('重なる出演中枠は開始の遅い方', () => {
    expect(at('10:45')[0].performance?.id).toBe(2);
    expect(at('10:15')[0].performance?.id).toBe(1);
  });
});

describe('timetableWindow', () => {
  const day = [perf(1, 1, '10:00', '16:20'), perf(2, 1, '12:00', '13:00')];
  const w = (t: string, ps = day) =>
    timetableWindow(ps, new Date(`2026-11-14T${t}:00+09:00`));

  it('現在時刻を中心に30分単位へ切り下げる', () => {
    expect(w('13:10')).toEqual({ startMinute: 11 * 60, endMinute: 15 * 60 });
  });

  it('朝は範囲の先頭へ寄せる', () => {
    expect(w('09:00')).toEqual({ startMinute: 10 * 60, endMinute: 14 * 60 });
  });

  it('夕方は範囲の末尾(時単位に切り上げ)へ寄せる', () => {
    expect(w('20:00')).toEqual({ startMinute: 13 * 60, endMinute: 17 * 60 });
  });

  it('公演が無ければ丸一日を範囲にする', () => {
    expect(w('00:10', [])).toEqual({ startMinute: 0, endMinute: 240 });
  });

  it('範囲が幅より短ければ先頭に合わせる', () => {
    expect(w('12:00', [perf(1, 1, '11:00', '12:00')])).toEqual({
      startMinute: 11 * 60,
      endMinute: 15 * 60,
    });
  });
});
