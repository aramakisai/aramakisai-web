import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PRE_EVENT_PUBLIC_PATHS,
  PRE_EVENT_PUBLIC_PREFIXES,
  isPublicPath,
  BUILD_PHASE,
  resolvePhase,
  visibleNavItems,
} from './phase';

describe('phase 定数', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('BUILD_PHASE の初期値は開催前フェーズである', async () => {
    const { BUILD_PHASE } = await import('./phase');
    expect(BUILD_PHASE).toBe('pre_event');
  });

  it('PHASE_OVERRIDE_COOKIE は空でない文字列を持つ', async () => {
    const { PHASE_OVERRIDE_COOKIE } = await import('./phase');
    expect(typeof PHASE_OVERRIDE_COOKIE).toBe('string');
    expect(PHASE_OVERRIDE_COOKIE.length).toBeGreaterThan(0);
  });

  it('NODE_ENV が development のとき DEV_OVERRIDE_ENABLED は真になる', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { DEV_OVERRIDE_ENABLED } = await import('./phase');
    expect(DEV_OVERRIDE_ENABLED).toBe(true);
  });

  it('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE=true のとき DEV_OVERRIDE_ENABLED は真になる', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', 'true');
    const { DEV_OVERRIDE_ENABLED } = await import('./phase');
    expect(DEV_OVERRIDE_ENABLED).toBe(true);
  });

  it('本番相当 (development でも override フラグ true でもない) のとき DEV_OVERRIDE_ENABLED は偽になる', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { DEV_OVERRIDE_ENABLED } = await import('./phase');
    expect(DEV_OVERRIDE_ENABLED).toBe(false);
  });
});

describe('isPublicPath', () => {
  it.each(PRE_EVENT_PUBLIC_PATHS)(
    '開催前フェーズで公開対象一覧のパス %s は公開と判定する',
    (path) => {
      expect(isPublicPath(path, 'pre_event')).toBe(true);
    },
  );

  it('開催前フェーズで公開対象一覧に無いパスは非公開と判定する', () => {
    expect(isPublicPath('/topics', 'pre_event')).toBe(false);
    expect(isPublicPath('/exhibitions', 'pre_event')).toBe(false);
    expect(isPublicPath('/map', 'pre_event')).toBe(false);
  });

  it.each(PRE_EVENT_PUBLIC_PREFIXES)(
    '開催前フェーズで前置詞 %s に前方一致するパスは公開と判定する',
    (prefix) => {
      expect(isPublicPath(`${prefix}123`, 'pre_event')).toBe(true);
    },
  );

  it('開催前フェーズで許可外の slug は非公開と判定する', () => {
    expect(isPublicPath('/some-other-page', 'pre_event')).toBe(false);
  });

  it('開催中フェーズではすべてのパスを公開と判定する', () => {
    expect(isPublicPath('/topics', 'live')).toBe(true);
    expect(isPublicPath('/anything', 'live')).toBe(true);
    expect(isPublicPath('/', 'live')).toBe(true);
  });
});

describe('resolvePhase (開発用フラグが真のビルド)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('Cookie 未設定のとき BUILD_PHASE を適用元 constant で返す', async () => {
    const { resolvePhase } = await import('./phase');
    expect(resolvePhase(undefined)).toEqual({
      phase: BUILD_PHASE,
      source: 'constant',
    });
  });

  it('Cookie が妥当な値のとき、そのフェーズを適用元 override で返す', async () => {
    const { resolvePhase } = await import('./phase');
    expect(resolvePhase('live')).toEqual({ phase: 'live', source: 'override' });
    expect(resolvePhase('pre_event')).toEqual({
      phase: 'pre_event',
      source: 'override',
    });
  });

  it('Cookie が語彙に含まれない不正な値のとき、例外を投げず BUILD_PHASE へ落とす', async () => {
    const { resolvePhase } = await import('./phase');
    expect(resolvePhase('not-a-phase')).toEqual({
      phase: BUILD_PHASE,
      source: 'constant',
    });
  });
});

describe('resolvePhase (開発用フラグが偽のビルド)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('妥当な Cookie 値を与えても常に BUILD_PHASE を返す', async () => {
    const { resolvePhase } = await import('./phase');
    expect(resolvePhase('live')).toEqual({
      phase: BUILD_PHASE,
      source: 'constant',
    });
  });

  it('不正な Cookie 値を与えても常に BUILD_PHASE を返す', async () => {
    const { resolvePhase } = await import('./phase');
    expect(resolvePhase('not-a-phase')).toEqual({
      phase: BUILD_PHASE,
      source: 'constant',
    });
  });

  it('Cookie 未設定でも BUILD_PHASE を返す', async () => {
    const { resolvePhase } = await import('./phase');
    expect(resolvePhase(undefined)).toEqual({
      phase: BUILD_PHASE,
      source: 'constant',
    });
  });
});

describe('visibleNavItems', () => {
  const items = [
    { href: '/', label: 'TOP' },
    { href: '/#about', label: '荒牧祭について' },
    { href: '/announcements', label: 'お知らせ' },
    { href: '/topics', label: 'トピックス' },
    { href: '/exhibitions', label: '企画一覧' },
  ] as const;

  it('開催前フェーズで非公開のリンク先を持つ項目を除去する', () => {
    const result = visibleNavItems(items, 'pre_event');
    expect(result.map((item) => item.href)).toEqual([
      '/',
      '/#about',
      '/announcements',
    ]);
  });

  it('アンカー付きのパスを誤って除去しない', () => {
    const result = visibleNavItems(items, 'pre_event');
    expect(result.some((item) => item.href === '/#about')).toBe(true);
  });

  it('開催中フェーズではすべての項目を残す', () => {
    const result = visibleNavItems(items, 'live');
    expect(result).toHaveLength(items.length);
  });
});
