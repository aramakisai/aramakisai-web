import { describe, expect, it } from 'vitest';
import { ROUTE_METADATA } from './route-metadata';

const ROUTES = [
  '/',
  '/announcements',
  '/exhibitions',
  '/topics',
  '/map',
  '/sponsors/local',
  '/sponsors/ad',
  '/faq',
  '/timetable',
  '/parking',
  '/access',
  '/mypage',
] as const;

describe('ROUTE_METADATA', () => {
  it('11 ルート分すべての定数を持つ', () => {
    expect(Object.keys(ROUTE_METADATA).sort()).toEqual([...ROUTES].sort());
  });

  it("'/access' の description は時刻表のみを述べる", () => {
    expect(ROUTE_METADATA['/access'].description).toBe(
      '荒牧祭の会場への行き方と、前橋駅行・群馬大学行のバス時刻表です。',
    );
  });

  it('広告協賛のタイトルと説明は承認済みの文言を使用する', () => {
    expect(ROUTE_METADATA['/sponsors/ad']).toEqual({
      title: '広告協賛',
      description:
        '荒牧祭2026にご協賛いただいた企業・団体と個人の皆様をご紹介します。',
    });
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
