import { describe, expect, it } from 'vitest';
import { aggregate, isComplete, summarizeVisitor } from './stamp-aggregate';
import type { MypageStampTarget } from './stamp-progress';

const areas = [
  { id: 1, name: '体育館' },
  { id: 2, name: '中庭' },
];
const t = (id: number, areaId: number | null): MypageStampTarget => ({
  id,
  category: 'exhibit',
  displayName: `企画${id}`,
  organizationName: `団体${id}`,
  areaId,
});
const s = (exhibitionId: number, at = '2026-11-01T00:00:00Z') => ({
  exhibitionId,
  category: 'exhibit' as const,
  acquiredAt: at,
});
const targets = [t(1, 1), t(2, 1), t(3, 2), t(4, null)];

describe('isComplete', () => {
  it('全対象を取得していれば満たす (エリア無しの対象も含む)', () => {
    expect(isComplete(targets, [s(1), s(2), s(3), s(4)])).toBe(true);
  });
  it('1 組欠けていれば満たさない', () => {
    expect(isComplete(targets, [s(1), s(2), s(3)])).toBe(false);
  });
  it('対象が 0 件なら満たさない', () => {
    expect(isComplete([], [s(1)])).toBe(false);
  });
  it('非公開企画のスタンプは判定に使わない', () => {
    expect(isComplete([t(1, 1), t(2, 1)], [s(1), s(99), s(98)])).toBe(false);
    expect(isComplete([t(1, 1)], [s(1), s(99)])).toBe(true);
  });
});

describe('summarizeVisitor', () => {
  it('スタンプ数とエリアごとの取得数、カタログに無い分はエリア不明', () => {
    const r = summarizeVisitor(targets, areas, [s(1), s(2), s(4), s(99)]);
    expect(r.stampCount).toBe(4);
    expect(r.byArea).toEqual([
      { areaId: 1, areaName: '体育館', collected: 2 },
      { areaId: null, areaName: 'エリア不明', collected: 2 },
    ]);
  });
  it('記録が無ければ 0 件', () => {
    expect(summarizeVisitor(targets, areas, [])).toEqual({
      stampCount: 0,
      byArea: [],
    });
  });
});

describe('aggregate', () => {
  const v = (visitorId: string, id: number) => ({ visitorId, ...s(id) });
  const records = {
    stamps: [v('a', 1), v('a', 2), v('a', 4), v('b', 1), v('b', 99)],
    activeExchangeCount: 1,
  };
  const d = aggregate(targets, areas, records);

  it('参加端末数と交換済み数', () => {
    expect(d.participantCount).toBe(2);
    expect(d.activeExchangeCount).toBe(1);
  });
  it('組ごとの取得端末数と取得率', () => {
    expect(d.targets.find((x) => x.exhibitionId === 1)).toMatchObject({
      visitorCount: 2,
      rate: 1,
    });
    expect(d.targets.find((x) => x.exhibitionId === 2)).toMatchObject({
      visitorCount: 1,
      rate: 0.5,
    });
    expect(d.targets.find((x) => x.exhibitionId === 3)).toMatchObject({
      visitorCount: 0,
      rate: 0,
    });
  });
  it('エリアごとの取得数と平均取得率 (エリア不明は null)', () => {
    expect(d.areas).toEqual([
      { areaId: 1, areaName: '体育館', collected: 3, averagePercent: 75 },
      { areaId: 2, areaName: '中庭', collected: 0, averagePercent: 0 },
      {
        areaId: null,
        areaName: 'エリア不明',
        collected: 2,
        averagePercent: null,
      },
    ]);
  });
  it('スタンプ数の分布', () => {
    expect(d.distribution).toEqual([
      { stampCount: 1, visitorCount: 0 },
      { stampCount: 2, visitorCount: 1 },
      { stampCount: 3, visitorCount: 1 },
      { stampCount: 4, visitorCount: 0 },
    ]);
  });
  it('企画ごとに団体名とエリアを持つ', () => {
    expect(d.targets.find((x) => x.exhibitionId === 3)).toMatchObject({
      organizationName: '団体3',
      areaId: 2,
    });
    expect(d.targets.find((x) => x.exhibitionId === 4)?.areaId).toBeNull();
  });
  it('参加 0 なら率は 0', () => {
    const e = aggregate(targets, areas, { stamps: [], activeExchangeCount: 0 });
    expect(e.participantCount).toBe(0);
    expect(e.targets.every((x) => x.rate === 0)).toBe(true);
    expect(
      e.areas.every((x) => x.averagePercent === 0 || x.averagePercent === null),
    ).toBe(true);
  });
});
