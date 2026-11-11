import { describe, expect, it, vi } from 'vitest';
import {
  buildPlaylist,
  slideAt,
  animatedNeighbors,
  eventDayIndex,
  paginateLostItems,
  paginateSponsors,
  stageNow,
  timetableWindow,
  type PlaylistEntry,
  type SignageSlide,
  type SignageSnapshot,
  type SignageSponsor,
  type SignageLostItem,
} from './signage';
import { layoutSponsorName } from './signage-sponsor-name';
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
    projectName: null,
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
    trialShiftMs: null,
    pinnedSlideId: null,
    eventDays: DAYS,
    slides: [],
    quakeSlides: { warning: null, calm: null, evacuate: null, cancelled: null },
    telops: [],
    timetable: {
      days: [],
      stages: [{ id: 1, name: 'A' }],
      performances: [perf(1, 1, '10:00', '11:00')],
    },
    sponsors: [sponsor(1, 'planA')],
    lostItems: [lost(1)],
    campusMap: null,
    parking: {
      isEventDay: true,
      fetchedAt: '',
      lots: [
        { id: 1, name: 'P', status: 'available', updatedAt: null, image: null },
      ],
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

  it('固定スライドが表示できる内容を持たない(0ページ)なら通常の巡回に戻る', () => {
    const list = buildPlaylist(
      snapshot({
        pinnedSlideId: 3,
        slides: [slide(1, 'parking'), slide(3, 'lost_items')],
        lostItems: [],
      }),
      NOW,
    );
    expect(list.map((e) => e.key)).toEqual(['1:0']);
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

  it('構内マップスライドは地図データがあれば1ページ、無ければ0ページ(画像の有無によらない)', () => {
    const mapSlide: SignageSlide = { ...base, id: 7, kind: 'campus_map' };
    const withMap = snapshot({
      slides: [mapSlide],
      campusMap: { areas: [], points: [] },
    });
    expect(buildPlaylist(withMap, NOW).map((e) => e.key)).toEqual(['7:0']);
    const withoutMap = snapshot({ slides: [mapSlide], campusMap: null });
    expect(buildPlaylist(withoutMap, NOW)).toEqual([]);
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
          lots: [
            { id: 1, name: 'P', status: null, updatedAt: null, image: null },
          ],
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

const fixed = (t: string) => t.length * 24;

describe('paginateSponsors', () => {
  const kinds = (pages: ReturnType<typeof paginateSponsors>) =>
    pages.map((p) => p.map((r) => (r.kind === 'logo' ? r.tier : 'names')));

  it('プランごとに別ページにし、A→B→C→社名の順に並べる', () => {
    const pages = paginateSponsors([
      sponsor(4, 'planD'),
      sponsor(3, 'planC'),
      sponsor(2, 'planB'),
      sponsor(1, 'planA'),
      sponsor(5, null),
      sponsor(6, 'planA', false),
    ]);
    expect(kinds(pages)).toEqual([['planA'], ['planB'], ['planC'], ['names']]);
    expect(pages[0][0].items.map((s) => s.id)).toEqual([1, 6]);
    expect(pages[3][0].items.map((s) => s.id)).toEqual([4, 5]);
  });

  it('列数で行を折り返す(A=3列, B=4列, C=6列, 社名=4列)', () => {
    const pages = paginateSponsors(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => sponsor(i, 'planC')),
    );
    expect(pages[0].map((r) => r.items.length)).toEqual([6, 5]);
  });

  it('同じプラン内は行高の合計が704を超える位置でページを分ける', () => {
    // A 238 + 24 + 238 = 500, +24+238 = 762 > 704
    const pages = paginateSponsors(
      Array.from({ length: 7 }, (_, i) => sponsor(i + 1, 'planA')),
    );
    expect(kinds(pages)).toEqual([['planA', 'planA'], ['planA']]);
  });

  it('社名52件は1ページ(13行=702px)に収まり、56件は次ページに送られる', () => {
    const pages = paginateSponsors(
      Array.from({ length: 52 }, (_, i) => sponsor(i + 1, 'planD')),
    );
    expect(pages.map((p) => p.length)).toEqual([13]);
    const more = paginateSponsors(
      Array.from({ length: 56 }, (_, i) => sponsor(i + 1, 'planD')),
    );
    expect(more.map((p) => p.length)).toEqual([13, 1]);
  });

  it('長い社名で行が増えると次ページに送られる', () => {
    // C枠208・24px/文字なら1行8字。短い社名はロゴ96+8+30=134で5行(5*134+4*24=766)は収まらないので4行に絞る
    const long =
      '今日は朝から雨が降っていたので傘を持って学校へ行き友達と楽しく遊びました';
    const { lines } = layoutSponsorName(long, 208, fixed);
    expect(lines).toBeGreaterThanOrEqual(4);
    const make = (name: string) =>
      Array.from({ length: 24 }, (_, i) => ({
        ...sponsor(i + 1, 'planC'),
        name: i === 0 ? name : 's',
      }));
    // 24件=4行(6列)。先頭行だけ高くなり、合計が704を超えれば末尾行が次ページへ
    const short = paginateSponsors(make('s'), fixed);
    const tall = paginateSponsors(make(long), fixed);
    expect(short.map((p) => p.length)).toEqual([4]);
    expect(tall.map((p) => p.length)).toEqual([3, 1]);
  });

  it('最長文節が枠幅を超えると倍率<1、収まれば1', () => {
    // 「あ」×30 は1文節で720px > 440
    const s = layoutSponsorName('あ'.repeat(30), 440, fixed);
    expect(s.scale).toBeCloseTo(440 / 720);
    expect(s.lines).toBe(1);
    expect(layoutSponsorName('あいう', 440, fixed).scale).toBe(1);
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

  it('今日に枠の無いステージは出さず、残りの色の添字をずらさない', () => {
    const three: Timetable = {
      ...tt,
      stages: [{ id: 0, name: 'Z' }, ...tt.stages],
    };
    const rows = stageNow(three, new Date('2026-11-14T09:00:00+09:00'));
    expect(rows.map((r) => [r.stage.id, r.colorIndex])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('別の日の枠だけのステージは出さない', () => {
    const rows = stageNow(tt, new Date('2026-11-15T09:00:00+09:00'));
    expect(rows).toEqual([]);
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

describe('animatedNeighbors', () => {
  const layout = (id: number, animated: boolean): PlaylistEntry => ({
    key: `${id}:0`,
    page: 0,
    slide: {
      id,
      durationSec: 10,
      kind: 'layout',
      layout: 'title',
      tone: 'normal',
      animated,
      title: 't',
      subtext: null,
      content1Html: '',
      content2Html: '',
    },
  });
  const plain = (id: number): PlaylistEntry => ({
    key: `${id}:0`,
    page: 0,
    slide: { id, durationSec: 10, kind: 'parking' },
  });

  it('animated が2枚連続なら互いに前後', () => {
    const l = [plain(1), layout(2, true), layout(3, true), plain(4)];
    expect(animatedNeighbors(l, '2:0')).toEqual({ prev: false, next: true });
    expect(animatedNeighbors(l, '3:0')).toEqual({ prev: true, next: false });
  });
  it('前後とも animated でなければ両方 false', () => {
    const l = [plain(1), layout(2, true), layout(3, false)];
    expect(animatedNeighbors(l, '2:0')).toEqual({ prev: false, next: false });
  });
  it('1件だけの animated は自分自身が前後', () => {
    expect(animatedNeighbors([layout(1, true)], '1:0')).toEqual({
      prev: true,
      next: true,
    });
    expect(animatedNeighbors([layout(1, false)], '1:0')).toEqual({
      prev: false,
      next: false,
    });
  });
  it('末尾から先頭へ循環する', () => {
    const l = [layout(1, true), plain(2), layout(3, true)];
    expect(animatedNeighbors(l, '1:0')).toEqual({ prev: true, next: false });
    expect(animatedNeighbors(l, '3:0')).toEqual({ prev: false, next: true });
  });
});
