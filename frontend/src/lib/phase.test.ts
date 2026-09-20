import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
