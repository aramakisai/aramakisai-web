import { describe, expect, it } from 'vitest';
import { ROUTE_METADATA } from './route-metadata';

const ROUTES = [
  '/',
  '/announcements',
  '/exhibitions',
  '/topics',
  '/map',
] as const;

describe('ROUTE_METADATA', () => {
  it('5 ルート分すべての定数を持つ', () => {
    expect(Object.keys(ROUTE_METADATA).sort()).toEqual([...ROUTES].sort());
  });

  it("'/' の title は null (サイトタイトルそのものを使う)", () => {
    expect(ROUTE_METADATA['/'].title).toBeNull();
  });

  it("'/' 以外は非空の title を持つ", () => {
    for (const route of ROUTES.filter((r) => r !== '/')) {
      expect(ROUTE_METADATA[route].title).toEqual(expect.any(String));
      expect(ROUTE_METADATA[route].title).not.toBe('');
    }
  });

  it('すべてのルートの description が 120 文字以内である', () => {
    for (const route of ROUTES) {
      expect(ROUTE_METADATA[route].description.length).toBeLessThanOrEqual(120);
      expect(ROUTE_METADATA[route].description.length).toBeGreaterThan(0);
    }
  });
});
