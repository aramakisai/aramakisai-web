import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST' as string | undefined },
}));
vi.mock('@/env', () => envMock);

type W = Window & { dataLayer?: unknown[] };
type Analytics = typeof import('./analytics');

// 初期化済みフラグはモジュール内にあるため、テストごとに読み直す
async function load(): Promise<Analytics> {
  vi.resetModules();
  return import('./analytics');
}

const layer = () =>
  ((window as W).dataLayer ?? []).map((e) =>
    Array.from(e as ArrayLike<unknown>),
  );

function goto(url: string) {
  window.history.replaceState(null, '', url);
}

describe('analytics', () => {
  beforeEach(() => {
    delete (window as W).dataLayer;
    envMock.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST';
    vi.stubEnv('NODE_ENV', 'production');
    goto('/');
    document.head.innerHTML = '';
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('送信可否', () => {
    it('本番以外では dataLayer に何も積まない', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const a = await load();
      a.sendGaEvent('timetable', { result: 'date_corrected' });
      a.trackPageView();
      expect((window as W).dataLayer).toBeUndefined();
    });

    it('測定IDが無ければ何も積まない', async () => {
      envMock.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = undefined;
      const a = await load();
      a.sendGaEvent('timetable', { result: 'date_corrected' });
      expect((window as W).dataLayer).toBeUndefined();
    });

    it.each(['/signage', '/signage/foo'])('%s では何も積まない', async (p) => {
      goto(p);
      const a = await load();
      a.sendGaEvent('timetable', { result: 'date_corrected' });
      a.trackPageView();
      expect(a.isGaEnabled()).toBe(false);
      expect((window as W).dataLayer).toBeUndefined();
    });
  });

  describe('初期化順', () => {
    it('どの送信が最初でも js/set/config が先に1回だけ積まれる', async () => {
      const a = await load();
      a.sendGaEvent('timetable', { result: 'date_corrected' });
      a.sendGaEvent('motion', { result: 'reduce' });
      const l = layer();
      expect(l.map((e) => e[0])).toEqual([
        'js',
        'set',
        'config',
        'event',
        'event',
      ]);
      expect(l[2]).toEqual(['config', 'G-TEST', { send_page_view: false }]);
    });

    it('Arguments 形式で積む', async () => {
      const a = await load();
      a.sendGaEvent('motion', { result: 'full' });
      for (const e of (window as W).dataLayer!) {
        expect(Object.prototype.toString.call(e)).toBe('[object Arguments]');
      }
    });

    it('既存の dataLayer に追記する', async () => {
      (window as W).dataLayer = ['x'];
      const a = await load();
      a.sendGaEvent('motion', { result: 'full' });
      expect((window as W).dataLayer![0]).toBe('x');
      expect((window as W).dataLayer!.length).toBeGreaterThan(1);
    });
  });

  describe('URL整形', () => {
    it('q とハッシュを除き、他のクエリは残す', async () => {
      const a = await load();
      expect(
        a.sanitizeLocation(
          'https://e.com/exhibitions?q=abc&category=stage&page=2#token',
        ),
      ).toBe('https://e.com/exhibitions?category=stage&page=2');
      expect(a.sanitizeLocation('https://e.com/a?q=x#h')).toBe(
        'https://e.com/a',
      );
    });

    it('独自イベントに整形済み page_location が付き、category・page は残る', async () => {
      goto('/exhibitions?q=secret&category=stage&page=2#v=abc');
      const a = await load();
      a.sendGaEvent('exhibition_search', { item_count: 3 });
      const ev = layer().find((e) => e[0] === 'event')!;
      expect(ev[1]).toBe('exhibition_search');
      expect(ev[2]).toEqual({
        item_count: 3,
        page_location: `${window.location.origin}/exhibitions?category=stage&page=2`,
      });
    });

    it('既存の ExhibitionEventParams も型に載る', async () => {
      const a = await load();
      a.sendGaEvent('qr_stamp', {
        exhibition_id: 3,
        exhibition_category: 'exhibit',
        result: 'added',
      });
      const ev = layer().find((e) => e[0] === 'event')!;
      expect(ev[2]).toMatchObject({
        exhibition_id: 3,
        exhibition_category: 'exhibit',
        result: 'added',
      });
    });
  });

  describe('page_view', () => {
    it('set page_location の後に page_view を積む', async () => {
      goto('/a?q=x#h');
      const a = await load();
      a.trackPageView();
      const l = layer();
      const set = l.filter((e) => e[0] === 'set').at(-1)!;
      expect(set[1]).toEqual({ page_location: `${window.location.origin}/a` });
      expect(l.at(-1)).toEqual(['event', 'page_view']);
    });

    it('setPageLocation は page_view を積まない', async () => {
      const a = await load();
      a.setPageLocation();
      expect(layer().some((e) => e[1] === 'page_view')).toBe(false);
    });
  });

  describe('loadGtag', () => {
    const scripts = () =>
      document.querySelectorAll('script[src*="googletagmanager"]');

    it('load 後のアイドル時に1回だけ script を追加する', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        configurable: true,
      });
      const a = await load();
      a.loadGtag();
      a.loadGtag();
      vi.runAllTimers();
      expect(scripts()).toHaveLength(1);
      expect(scripts()[0].getAttribute('src')).toBe(
        'https://www.googletagmanager.com/gtag/js?id=G-TEST',
      );
    });

    it('送信不可なら読み込まない', async () => {
      vi.useFakeTimers();
      vi.stubEnv('NODE_ENV', 'development');
      const a = await load();
      a.loadGtag();
      vi.runAllTimers();
      expect(scripts()).toHaveLength(0);
    });
  });

  it('内部の例外は呼び出し元へ伝えない', async () => {
    const a = await load();
    Object.defineProperty(window, 'dataLayer', {
      get() {
        throw new Error('boom');
      },
      configurable: true,
    });
    try {
      expect(() => a.sendGaEvent('motion', { result: 'full' })).not.toThrow();
    } finally {
      delete (window as W).dataLayer;
    }
  });
});
