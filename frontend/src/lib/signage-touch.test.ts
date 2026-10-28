import { describe, expect, it } from 'vitest';
import {
  nextTouchState,
  toTouchHref,
  TOUCH_DESTINATIONS,
  IDLE_TIMEOUT_MS,
  CLOSE_FADE_MS,
  type TouchState,
} from './signage-touch';

const CLOSED: TouchState = { kind: 'closed' };
const open = (destination: 'map' | null = null, idleSince = 0): TouchState => ({
  kind: 'open',
  destination,
  idleSince,
});

describe('定数', () => {
  it('5つの行き先と端末用パス', () => {
    expect(TOUCH_DESTINATIONS.map((d) => [d.key, d.label, d.path])).toEqual([
      ['map', '構内マップ', '/signage/touch/map'],
      ['exhibitions', '企画一覧', '/signage/touch/exhibitions'],
      ['timetable', 'タイムテーブル', '/signage/touch/timetable'],
      ['parking', '駐車場', '/signage/touch/parking'],
      ['topics', 'トピック', '/signage/touch/topics'],
    ]);
    expect(IDLE_TIMEOUT_MS).toBe(60_000);
    expect(CLOSE_FADE_MS).toBe(600);
  });
});

describe('nextTouchState', () => {
  it('closed: 横置きのタップで開く', () => {
    expect(
      nextTouchState(CLOSED, { type: 'tap', at: 5, orientation: 'landscape' }),
    ).toEqual(open(null, 5));
  });
  it('closed: 縦置きのタップは無視', () => {
    expect(
      nextTouchState(CLOSED, { type: 'tap', at: 5, orientation: 'portrait' }),
    ).toBe(CLOSED);
  });
  it('closed: 他のイベントは何もしない(速報含む)', () => {
    for (const e of [
      { type: 'select', destination: 'map', at: 1 },
      { type: 'activity', at: 1 },
      { type: 'tick', at: 1 },
      { type: 'back' },
      { type: 'quake', active: true },
      { type: 'quake', active: false },
      { type: 'fadeEnd' },
    ] as const) {
      expect(nextTouchState(CLOSED, e)).toBe(CLOSED);
    }
  });

  it('open: 行き先選択で行き先と計測を更新', () => {
    expect(
      nextTouchState(open(null, 0), {
        type: 'select',
        destination: 'map',
        at: 9,
      }),
    ).toEqual(open('map', 9));
  });
  it('open: destination null でトップへ戻り計測を更新', () => {
    expect(
      nextTouchState(open('map', 0), {
        type: 'select',
        destination: null,
        at: 7,
      }),
    ).toEqual(open(null, 7));
  });
  it('open: 操作で計測を0に戻す', () => {
    expect(
      nextTouchState(open('map', 0), { type: 'activity', at: 30_000 }),
    ).toEqual(open('map', 30_000));
  });
  it('open: tick は60秒未満なら変えず、60秒でclosing', () => {
    const s = open('map', 1000);
    expect(
      nextTouchState(s, { type: 'tick', at: 1000 + IDLE_TIMEOUT_MS - 1 }),
    ).toBe(s);
    expect(
      nextTouchState(s, { type: 'tick', at: 1000 + IDLE_TIMEOUT_MS }),
    ).toEqual({
      kind: 'closing',
    });
  });
  it('open: back で closing', () => {
    expect(nextTouchState(open('map'), { type: 'back' })).toEqual({
      kind: 'closing',
    });
  });
  it('open: 速報開始で quakeHeld(行き先保持)、解除は無関係', () => {
    expect(
      nextTouchState(open('map'), { type: 'quake', active: true }),
    ).toEqual({
      kind: 'quakeHeld',
      destination: 'map',
    });
    const s = open('map');
    expect(nextTouchState(s, { type: 'quake', active: false })).toBe(s);
  });
  it('open: 固定開始で closing(行き先は保持しない)', () => {
    expect(nextTouchState(open('map'), { type: 'pin' })).toEqual({
      kind: 'closing',
    });
  });
  it('closed: 固定開始は無視', () => {
    const s: TouchState = { kind: 'closed' };
    expect(nextTouchState(s, { type: 'pin' })).toBe(s);
  });
  it('open: tap・fadeEnd は無視', () => {
    const s = open('map');
    expect(
      nextTouchState(s, { type: 'tap', at: 1, orientation: 'landscape' }),
    ).toBe(s);
    expect(nextTouchState(s, { type: 'fadeEnd' })).toBe(s);
  });

  it('quakeHeld: tap・activity・tick・select・backを無視', () => {
    const s: TouchState = { kind: 'quakeHeld', destination: 'map' };
    for (const e of [
      { type: 'tap', at: 1, orientation: 'landscape' },
      { type: 'activity', at: 1 },
      { type: 'tick', at: 999_999 },
      { type: 'select', destination: 'parking', at: 1 },
      { type: 'back' },
      { type: 'quake', active: true },
    ] as const) {
      expect(nextTouchState(s, e)).toBe(s);
    }
  });
  it('quakeHeld: 速報解除で closing', () => {
    expect(
      nextTouchState(
        { kind: 'quakeHeld', destination: null },
        { type: 'quake', active: false },
      ),
    ).toEqual({ kind: 'closing' });
  });

  it('closing: fadeEnd で closed、他は無視', () => {
    const s: TouchState = { kind: 'closing' };
    expect(nextTouchState(s, { type: 'fadeEnd' })).toEqual(CLOSED);
    expect(
      nextTouchState(s, { type: 'tap', at: 1, orientation: 'landscape' }),
    ).toBe(s);
    expect(nextTouchState(s, { type: 'tick', at: 1e9 })).toBe(s);
    expect(nextTouchState(s, { type: 'quake', active: true })).toBe(s);
    expect(nextTouchState(s, { type: 'back' })).toBe(s);
  });
});

describe('toTouchHref', () => {
  it.each([
    ['/exhibitions/1/stage', '/signage/touch/exhibitions/1/stage'],
    ['/topics/3', '/signage/touch/topics/3'],
    ['/exhibitions', '/signage/touch/exhibitions'],
    ['/topics', '/signage/touch/topics'],
    ['/signage/touch/map', '/signage/touch/map'],
    [
      '/signage/touch/exhibitions/1/stage',
      '/signage/touch/exhibitions/1/stage',
    ],
    ['#top', '#top'],
  ])('%s -> %s', (from, to) => {
    expect(toTouchHref(from)).toBe(to);
  });
  it.each([
    'https://example.com/',
    '//example.com/exhibitions',
    '/mypage',
    '/guide/access',
    '/map',
    'mailto:a@example.com',
    'tel:0000',
    '',
  ])('%s は遮断', (href) => {
    expect(toTouchHref(href)).toBeNull();
  });
});
