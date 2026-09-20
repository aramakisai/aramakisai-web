import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PRE_EVENT_PUBLIC_PATHS,
  PRE_EVENT_PUBLIC_PREFIXES,
  isPublicPath,
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
