import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notFound } from 'next/navigation';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

describe('E2EErrorTriggerPage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('DEV_OVERRIDE_ENABLED が偽 (本番相当) のとき notFound() を呼ぶだけで例外は投げない', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { default: E2EErrorTriggerPage } = await import('./page');

    await expect(E2EErrorTriggerPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('DEV_OVERRIDE_ENABLED が真のとき意図的な例外を投げる', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { default: E2EErrorTriggerPage } = await import('./page');

    cookieGet.mockReturnValue(undefined);
    await expect(E2EErrorTriggerPage()).rejects.toThrow('e2e-error-trigger');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('Cookie e2e_retry_ok があれば例外を投げず回復後の本文を返す', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    cookieGet.mockImplementation((n: string) =>
      n === 'e2e_retry_ok' ? { value: '1' } : undefined,
    );
    const { default: E2EErrorTriggerPage } = await import('./page');

    const el = await E2EErrorTriggerPage();
    expect(JSON.stringify(el)).toContain('回復しました');
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('DEV_OVERRIDE_ENABLED が偽 (本番相当) のとき notFound を呼ぶ', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { generateMetadata } = await import('./page');

    expect(() => generateMetadata()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });
});
