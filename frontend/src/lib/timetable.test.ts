import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerformanceSlot, Stage } from '@/cms-types';
import { cms } from './cms';
import {
  combineJstDateTime,
  findActivePerformances,
  getExhibitionPerformances,
  getTimetable,
  toTimetable,
  isPerformanceActive,
  resolveInitialDayKey,
  type TimetableDay,
} from './timetable';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const stage = (id: number, sort: number | null, name = `S${id}`) =>
  ({ id, name, sort }) as Stage;
// 開催日は JST 暦日の UTC 正午、時刻は JST 時刻のみ意味を持つ
const slot = (
  id: number,
  o: Partial<PerformanceSlot> & { stage?: number | Stage } = {},
) =>
  ({
    id,
    stage_id: o.stage ?? 1,
    event_date: '2026-11-14T03:00:00.000Z',
    start_at: '1970-01-01T01:00:00.000Z',
    end_at: '1970-01-01T02:00:00.000Z',
    title: '表示名',
    ...o,
  }) as PerformanceSlot;
const eventDays = [
  {
    id: 'b',
    start_at: '2026-11-15T01:00:00.000Z',
    end_at: '2026-11-15T08:00:00.000Z',
    label: '',
  },
  {
    id: 'a',
    start_at: '2026-11-14T01:00:00.000Z',
    end_at: '2026-11-14T08:00:00.000Z',
    label: '1日目',
  },
] as never;
const pub = (id: number, name: string | null) =>
  ({ id, status: 'published', organization_name: name }) as never;

describe('toTimetable', () => {
  const build = (slots: PerformanceSlot[], stages = [stage(1, 0)]) =>
    toTimetable({ eventDays, stages, performanceSlots: slots });

  it('開催日を日順に並べ、ラベル未入力は日付から作る', () => {
    expect(build([]).days).toEqual([
      { key: '2026-11-14', label: '1日目' },
      { key: '2026-11-15', label: '11月15日(日)' },
    ]);
  });

  it('ステージは sort 昇順・同値は id 昇順', () => {
    const r = build([], [stage(3, 1), stage(2, 1), stage(1, 5)]);
    expect(r.stages.map((s) => s.id)).toEqual([2, 3, 1]);
  });

  it('出演枠は開始時刻昇順で、時刻は自身の開催日から合成する', () => {
    const r = build([
      slot(1, {
        start_at: '1970-01-01T05:00:00.000Z',
        end_at: '1970-01-01T06:00:00.000Z',
      }),
      slot(2),
    ]);
    expect(r.performances.map((p) => p.id)).toEqual([2, 1]);
    expect(r.performances[0].slot).toEqual({
      dateKey: '2026-11-14',
      startAt: '2026-11-14T01:00:00.000Z',
      endAt: '2026-11-14T02:00:00.000Z',
    });
  });

  it('公開団体は団体名とステージ詳細への遷移先を持つ', () => {
    const p = build([slot(1, { exhibition_id: pub(7, '軽音部') })])
      .performances[0];
    expect(p.name).toBe('軽音部');
    expect(p.href).toBe('/exhibitions/7/stage');
  });

  it('団体なしは表示名で遷移先なし', () => {
    const p = build([slot(1)]).performances[0];
    expect(p).toMatchObject({ name: '表示名', href: null });
  });

  it('非公開団体(IDのまま)は表示名があれば団体なし扱い、無ければ除く', () => {
    const r = build([
      slot(1, { exhibition_id: 9 as never }),
      slot(2, { exhibition_id: 9 as never, title: null }),
    ]);
    expect(r.performances.map((p) => [p.id, p.href])).toEqual([[1, null]]);
  });

  it('開催日・時刻の欠損や不正、未知のステージの枠は除く', () => {
    const r = build([
      slot(1, { event_date: undefined as never }),
      slot(2, { start_at: 'x' }),
      slot(3, { end_at: null as never }),
      slot(4, { stage: 99 }),
      slot(5),
    ]);
    expect(r.performances.map((p) => p.id)).toEqual([5]);
  });

  it('stage_id が展開済みオブジェクトでも扱える', () => {
    expect(
      build([slot(1, { stage: stage(1, 0) })]).performances[0].stageId,
    ).toBe(1);
  });
});

describe('findActivePerformances', () => {
  it('現在出演中の枠をステージ順に返す', () => {
    const tt = toTimetable({
      eventDays,
      stages: [stage(1, 2), stage(2, 1)],
      performanceSlots: [
        slot(1, { stage: 1 }),
        slot(2, { stage: 2 }),
        slot(3, {
          stage: 2,
          start_at: '1970-01-01T03:00:00.000Z',
          end_at: '1970-01-01T04:00:00.000Z',
        }),
      ],
    });
    const now = new Date('2026-11-14T01:30:00.000Z');
    expect(findActivePerformances(tt, now).map((p) => p.id)).toEqual([2, 1]);
  });
});

describe('getTimetable', () => {
  it('取得失敗は例外を投げる', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    });
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { docs: [], totalDocs: 0 },
    });
    await expect(getTimetable()).rejects.toThrow();
  });
});

describe('getExhibitionPerformances', () => {
  const ok = (docs: unknown[]) => ({
    ok: true as const,
    value: { docs, totalDocs: docs.length } as never,
  });
  const setup = (docs: unknown[]) => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: { event_days: eventDays } as never,
    });
    vi.mocked(cms.findMany).mockResolvedValue(ok(docs));
  };

  it('開催日・開始時刻の昇順で、開催日程外の日付は日付ラベルで表す', async () => {
    setup([
      slot(1, {
        stage: stage(1, 0, '野外'),
        event_date: '2026-11-15T03:00:00.000Z',
      }),
      slot(2, {
        stage: stage(1, 0, '野外'),
        event_date: '2026-11-20T03:00:00.000Z',
      }),
      slot(3, {
        stage: stage(2, 0, '体育館'),
        event_date: '2026-11-14T03:00:00.000Z',
      }),
    ]);
    const r = await getExhibitionPerformances(7);
    expect(r).toEqual({
      kind: 'loaded',
      value: [
        {
          stageName: '体育館',
          dayLabel: '1日目',
          startAt: '2026-11-14T01:00:00.000Z',
          endAt: '2026-11-14T02:00:00.000Z',
        },
        {
          stageName: '野外',
          dayLabel: '11月15日(日)',
          startAt: '2026-11-15T01:00:00.000Z',
          endAt: '2026-11-15T02:00:00.000Z',
        },
        {
          stageName: '野外',
          dayLabel: '11月20日(金)',
          startAt: '2026-11-20T01:00:00.000Z',
          endAt: '2026-11-20T02:00:00.000Z',
        },
      ],
    });
  });

  it('取得失敗は例外にせず error を返す', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: { event_days: eventDays } as never,
    });
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    });
    expect(await getExhibitionPerformances(7)).toEqual({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });
  });
});

describe('combineJstDateTime', () => {
  it('開催日のJST暦日とJST時刻から絶対時刻を作る', () => {
    // 開催日は JST 暦日の UTC 正午、時刻は JST 10:30 = 01:30Z
    expect(combineJstDateTime('2026-11-14', '1970-01-01T01:30:00.000Z')).toBe(
      '2026-11-14T01:30:00.000Z',
    );
  });

  it('JSTの0時直前(前日15:59Z)は同じ暦日の23:59になる', () => {
    expect(combineJstDateTime('2026-11-14', '2026-01-01T14:59:00.000Z')).toBe(
      '2026-11-14T14:59:00.000Z',
    );
  });

  it('JSTの0時ちょうど(前日15:00Z)は暦日の00:00になる', () => {
    expect(combineJstDateTime('2026-11-14', '2026-01-01T15:00:00.000Z')).toBe(
      '2026-11-13T15:00:00.000Z',
    );
  });

  it('時刻側の日付部分は無視する', () => {
    expect(combineJstDateTime('2026-11-15', '2020-05-05T05:00:00.000Z')).toBe(
      '2026-11-15T05:00:00.000Z',
    );
  });
});

describe('resolveInitialDayKey', () => {
  const days: TimetableDay[] = [
    { key: '2026-11-14', label: '1日目' },
    { key: '2026-11-15', label: '2日目' },
  ];

  it('現在のJST暦日が開催日にあればその日', () => {
    expect(resolveInitialDayKey(days, new Date('2026-11-15T03:00:00Z'))).toBe(
      '2026-11-15',
    );
  });

  it('UTCでは前日でもJSTで開催日ならその日(JST 0時直後)', () => {
    expect(resolveInitialDayKey(days, new Date('2026-11-14T15:00:00Z'))).toBe(
      '2026-11-15',
    );
  });

  it('JST 0時直前は前日のまま', () => {
    expect(resolveInitialDayKey(days, new Date('2026-11-14T14:59:59Z'))).toBe(
      '2026-11-14',
    );
  });

  it('期間外なら最初の開催日', () => {
    expect(resolveInitialDayKey(days, new Date('2026-10-01T00:00:00Z'))).toBe(
      '2026-11-14',
    );
    expect(resolveInitialDayKey(days, new Date('2027-01-01T00:00:00Z'))).toBe(
      '2026-11-14',
    );
  });

  it('開催日程が空ならnull', () => {
    expect(resolveInitialDayKey([], new Date())).toBeNull();
  });
});

describe('isPerformanceActive', () => {
  const slot = {
    dateKey: '2026-11-14',
    startAt: '2026-11-14T01:00:00.000Z',
    endAt: '2026-11-14T02:00:00.000Z',
  };

  it('開始ちょうどは真', () => {
    expect(isPerformanceActive(slot, new Date(slot.startAt))).toBe(true);
  });

  it('終了ちょうどは偽', () => {
    expect(isPerformanceActive(slot, new Date(slot.endAt))).toBe(false);
  });

  it('開始前と終了後は偽、区間内は真', () => {
    expect(isPerformanceActive(slot, new Date('2026-11-14T00:59:59Z'))).toBe(
      false,
    );
    expect(isPerformanceActive(slot, new Date('2026-11-14T01:30:00Z'))).toBe(
      true,
    );
  });

  it('別の日の同時刻は偽', () => {
    expect(isPerformanceActive(slot, new Date('2026-11-15T01:30:00Z'))).toBe(
      false,
    );
  });
});
