import { describe, expect, it } from 'vitest';
import { groupStampsByArea, type MypageStampTarget } from './stamp-progress';
import type { SavedExhibitionRef } from './mypage-storage';

const areas = [
  { id: 2, name: '中庭' },
  { id: 1, name: '体育館' },
  { id: 3, name: '空きエリア' },
];
const t = (
  id: number,
  areaId: number | null,
  category: MypageStampTarget['category'] = 'exhibit',
): MypageStampTarget => ({ id, category, displayName: `企画${id}`, areaId });
const s = (
  id: number,
  savedAt: string,
  category: SavedExhibitionRef['category'] = 'exhibit',
): SavedExhibitionRef => ({ id, category, savedAt });

describe('groupStampsByArea', () => {
  const targets = [t(1, 2), t(2, 2), t(3, 2), t(4, 1), t(5, null)];

  it('エリアの並びを保ち、分母0のエリアは返さない', () => {
    const { areas: out } = groupStampsByArea(targets, areas, []);
    expect(out.map((a) => a.areaId)).toEqual([2, 1]);
  });

  it('取得0件は0%、取得率は切り捨て', () => {
    const none = groupStampsByArea(targets, areas, []).areas[0];
    expect(none).toMatchObject({ total: 3, collected: 0, percent: 0 });
    const one = groupStampsByArea(targets, areas, [s(1, 'a')]).areas[0];
    expect(one).toMatchObject({ collected: 1, percent: 33 });
    const two = groupStampsByArea(targets, areas, [s(1, 'a'), s(2, 'b')])
      .areas[0];
    expect(two.percent).toBe(66);
  });

  it('全取得で100%', () => {
    const all = groupStampsByArea(targets, areas, [s(4, 'a')]).areas[1];
    expect(all.percent).toBe(100);
  });

  it('取得済みは新しい順', () => {
    const out = groupStampsByArea(targets, areas, [
      s(1, '2026-11-03T10:00:00.000Z'),
      s(3, '2026-11-03T12:00:00.000Z'),
      s(2, '2026-11-03T11:00:00.000Z'),
    ]).areas[0];
    expect(out.stamps.map((x) => x.id)).toEqual([3, 2, 1]);
    expect(out.stamps[0].displayName).toBe('企画3');
  });

  it('エリアを持たない組は「その他」に入れ、分母・分子に含めない', () => {
    const out = groupStampsByArea(targets, areas, [s(5, 'a')]);
    expect(out.others.map((x) => x.id)).toEqual([5]);
    expect(out.areas.every((a) => a.collected === 0)).toBe(true);
  });

  it('対象に無い組(非公開・削除・カテゴリ解除)はどこにも入れない', () => {
    const out = groupStampsByArea(targets, areas, [
      s(99, 'a'),
      s(1, 'a', 'vendor'),
    ]);
    expect(out.areas.every((a) => a.collected === 0)).toBe(true);
    expect(out.others).toEqual([]);
  });

  it('同じ企画でもカテゴリが違えば別の組', () => {
    const out = groupStampsByArea(
      [t(1, 2, 'exhibit'), t(1, 2, 'vendor')],
      areas,
      [s(1, 'a', 'vendor')],
    );
    expect(out.areas[0]).toMatchObject({ total: 2, collected: 1, percent: 50 });
  });
});
