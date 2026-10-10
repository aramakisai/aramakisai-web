import { describe, expect, it } from 'vitest';
import type { SignageSlide, SignageSnapshot } from './signage';
import { missingSlideIds, withPin } from './signage-pin';

const slide = (id: number, title = 't'): SignageSlide => ({
  id,
  durationSec: 10,
  kind: 'layout',
  layout: 'title',
  tone: 'normal',
  title,
  subtext: null,
  content1Html: '',
  content2Html: '',
});
const snapshot = (pinnedSlideId: number | null): SignageSnapshot =>
  ({
    pinnedSlideId,
    slides: [slide(1), slide(2)],
  }) as unknown as SignageSnapshot;

const pin = (
  slideValue: SignageSlide | null,
  visibleSlideIds: readonly number[],
) => ({ serverNow: 'x', slide: slideValue, visibleSlideIds });

describe('withPin', () => {
  it('確認前(undefined)はスナップショットのまま', () => {
    const s = snapshot(1);
    expect(withPin(s, undefined)).toBe(s);
  });

  it('固定ありは pinnedSlideId と同IDのスライドを確認結果で置き換える', () => {
    const r = withPin(snapshot(null), pin(slide(2, '新'), [1, 2]));
    expect(r.pinnedSlideId).toBe(2);
    expect(r.slides).toHaveLength(2);
    expect(r.slides[1]).toMatchObject({ title: '新' });
  });

  it('スナップショットに無い固定スライドは末尾に加える', () => {
    const r = withPin(snapshot(null), pin(slide(9), [1, 2, 9]));
    expect(r.slides.map((s) => s.id)).toEqual([1, 2, 9]);
  });

  it('固定なしの確認結果はスナップショット側の固定を解除する', () => {
    const r = withPin(snapshot(1), pin(null, [1, 2]));
    expect(r.pinnedSlideId).toBeNull();
  });

  it('visibleSlideIds に無いスライドを外し、スナップショットの並びを保つ', () => {
    const s = {
      pinnedSlideId: null,
      slides: [slide(3), slide(1), slide(2)],
    } as unknown as SignageSnapshot;
    const r = withPin(s, pin(null, [2, 3]));
    expect(r.slides.map((x) => x.id)).toEqual([3, 2]);
  });

  it('表示対象が空なら slides も空になる', () => {
    expect(withPin(snapshot(null), pin(null, [])).slides).toEqual([]);
  });
});

describe('missingSlideIds', () => {
  it('確認前は空', () => {
    expect(missingSlideIds(snapshot(null), undefined)).toEqual([]);
  });

  it('スナップショットに無い表示対象のIDだけを返す', () => {
    expect(missingSlideIds(snapshot(null), pin(null, [1, 5, 2, 7]))).toEqual([
      5, 7,
    ]);
  });

  it('すべてあれば空', () => {
    expect(missingSlideIds(snapshot(null), pin(null, [2]))).toEqual([]);
  });
});
