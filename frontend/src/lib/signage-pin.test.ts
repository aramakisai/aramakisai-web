import { describe, expect, it } from 'vitest';
import type { SignageSlide, SignageSnapshot } from './signage';
import { withPin } from './signage-pin';

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

describe('withPin', () => {
  it('確認前(undefined)はスナップショットのまま', () => {
    const s = snapshot(1);
    expect(withPin(s, undefined)).toBe(s);
  });

  it('固定ありは pinnedSlideId と同IDのスライドを確認結果で置き換える', () => {
    const r = withPin(snapshot(null), {
      serverNow: 'x',
      slide: slide(2, '新'),
    });
    expect(r.pinnedSlideId).toBe(2);
    expect(r.slides).toHaveLength(2);
    expect(r.slides[1]).toMatchObject({ title: '新' });
  });

  it('スナップショットに無い固定スライドは末尾に加える', () => {
    const r = withPin(snapshot(null), { serverNow: 'x', slide: slide(9) });
    expect(r.slides.map((s) => s.id)).toEqual([1, 2, 9]);
  });

  it('固定なしの確認結果はスナップショット側の固定を解除する', () => {
    const r = withPin(snapshot(1), { serverNow: 'x', slide: null });
    expect(r.pinnedSlideId).toBeNull();
  });
});
