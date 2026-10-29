import { describe, expect, it, vi } from 'vitest';
import {
  noticeTelops,
  stageStartNotices,
  STAGE_NOTICE_LEAD_MS,
} from './signage-stage-notice';
import type { Timetable, TimetablePerformance } from './timetable';

function perf(
  id: number,
  stageId: number,
  start: string,
  name = `p${id}`,
  date = '2026-11-14',
): TimetablePerformance {
  const startAt = new Date(`${date}T${start}+09:00`).toISOString();
  return {
    id,
    stageId,
    name,
    href: null,
    slot: { dateKey: date, startAt, endAt: startAt },
  };
}

vi.mock('./cms', () => ({ cms: {} }));

const stages = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
];
const tt = (performances: TimetablePerformance[]): Timetable => ({
  days: [],
  stages,
  performances,
});
const at = (t: string, date = '2026-11-14') => new Date(`${date}T${t}+09:00`);
const ids = (n: readonly { performanceId: number }[]) =>
  n.map((x) => x.performanceId);

describe('stageStartNotices', () => {
  const t = tt([perf(1, 1, '10:00:00')]);

  it('3分前ちょうどを含む', () => {
    expect(ids(stageStartNotices(t, at('09:57:00')))).toEqual([1]);
  });

  it('開始時刻ちょうどを含まない', () => {
    expect(stageStartNotices(t, at('10:00:00'))).toEqual([]);
  });

  it('3分1秒前を含まない', () => {
    expect(stageStartNotices(t, at('09:56:59'))).toEqual([]);
  });

  it('開始1ms前まで含む', () => {
    const now = new Date(Date.parse(at('10:00:00').toISOString()) - 1);
    expect(ids(stageStartNotices(t, now))).toEqual([1]);
  });

  it('別の日の同じ時刻を含まない', () => {
    expect(stageStartNotices(t, at('09:58:00', '2026-11-15'))).toEqual([]);
  });

  it('表示名が空・空白だけの枠を除く', () => {
    const e = tt([perf(1, 1, '10:00:00', ''), perf(2, 1, '10:00:00', '  　')]);
    expect(stageStartNotices(e, at('09:58:00'))).toEqual([]);
  });

  it('ステージが見つからない枠を除く', () => {
    const e = tt([perf(1, 99, '10:00:00')]);
    expect(stageStartNotices(e, at('09:58:00'))).toEqual([]);
  });

  it('ステージ順、同じステージ内は開始の早い順に並べる', () => {
    const e = tt([
      perf(1, 2, '10:00:00'),
      perf(2, 1, '10:01:00'),
      perf(3, 1, '10:00:30'),
      perf(4, 3, '10:00:00'),
    ]);
    expect(ids(stageStartNotices(e, at('09:58:00')))).toEqual([3, 2, 1, 4]);
  });

  it('ステージ名・色の添字・開始時刻を持ち、色は全ステージ内の位置', () => {
    const e = tt([perf(1, 3, '10:00:00', 'バンド')]);
    expect(stageStartNotices(e, at('09:58:00'))).toEqual([
      {
        performanceId: 1,
        name: 'バンド',
        stageName: 'C',
        colorIndex: 2,
        startAt: new Date('2026-11-14T10:00:00+09:00').toISOString(),
      },
    ]);
  });

  it('同じ入力に同じ結果を返す', () => {
    const e = tt([perf(1, 2, '10:00:00'), perf(2, 1, '10:00:00')]);
    expect(stageStartNotices(e, at('09:58:00'))).toEqual(
      stageStartNotices(e, at('09:58:00')),
    );
  });

  it('リードは3分', () => {
    expect(STAGE_NOTICE_LEAD_MS).toBe(180_000);
  });
});

describe('noticeTelops', () => {
  it('IDは出演枠IDの負数、チップはステージ名、本文は「まもなく〇〇が始まります」、対象は来場者', () => {
    const n = stageStartNotices(
      tt([perf(7, 1, '10:00:00', 'バンド')]),
      at('09:58:00'),
    );
    expect(noticeTelops(n)).toEqual([
      {
        id: -7,
        audience: 'visitor',
        target: 'A',
        body: 'まもなくバンドが始まります',
      },
    ]);
  });
});
