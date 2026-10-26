import { describe, expect, it, vi } from 'vitest';
import { buildTouchQrUrl } from './signage-touch-qr';

// exhibitions.ts / campus-map.ts は cms.ts (env.ts の起動時検証を含む) に依存するためモックする
vi.mock('./cms', () => ({ cms: {} }));

const ORIGIN = 'https://aramakisai.example.com';
const utm = (content: string) =>
  `utm_source=signage&utm_medium=qr&utm_campaign=touch_navigation&utm_content=${content}`;

describe('buildTouchQrUrl', () => {
  it.each([
    [null, '/', 'home'],
    ['/signage/touch/map', '/map', 'map'],
    ['/signage/touch/exhibitions', '/exhibitions', 'exhibitions'],
    [
      '/signage/touch/exhibitions/1/stage',
      '/exhibitions/1/stage',
      'exhibition_detail',
    ],
    ['/signage/touch/timetable', '/timetable', 'timetable'],
    ['/signage/touch/parking', '/parking', 'parking'],
    ['/signage/touch/topics', '/topics', 'topics'],
    ['/signage/touch/topics/3', '/topics/3', 'topic_detail'],
  ])('%s', (path, expected, content) => {
    expect(buildTouchQrUrl(ORIGIN, path)).toBe(
      `${ORIGIN}${expected}?${utm(content)}`,
    );
  });

  it('企画一覧の絞り込みを既存の組み立てで含める(ページは含めない)', () => {
    const url = new URL(
      buildTouchQrUrl(ORIGIN, '/signage/touch/exhibitions', {
        q: 'カレー',
        categories: ['stage'],
        areaIds: [2],
      }),
    );
    expect(url.pathname).toBe('/exhibitions');
    expect(url.searchParams.get('q')).toBe('カレー');
    expect(url.searchParams.get('category')).toBe('stage');
    expect(url.searchParams.get('area')).toBe('2');
    expect(url.searchParams.get('utm_content')).toBe('exhibitions');
  });

  it('構内マップの絞り込み', () => {
    const url = new URL(
      buildTouchQrUrl(ORIGIN, '/signage/touch/map', {
        q: '',
        categories: [],
        selectedAreaId: 4,
      }),
    );
    expect(url.pathname).toBe('/map');
    expect(url.searchParams.get('area')).toBe('4');
    expect(url.searchParams.get('utm_campaign')).toBe('touch_navigation');
  });

  it('絞り込みが対象外のパスでは無視', () => {
    expect(
      buildTouchQrUrl(ORIGIN, '/signage/touch/parking', {
        q: 'x',
        categories: [],
        areaIds: [],
      }),
    ).toBe(`${ORIGIN}/parking?${utm('parking')}`);
  });
});
