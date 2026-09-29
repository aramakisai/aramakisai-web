import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notFound } from 'next/navigation';

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

    expect(() => E2EErrorTriggerPage()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('DEV_OVERRIDE_ENABLED が真のとき意図的な例外を投げる', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { default: E2EErrorTriggerPage } = await import('./page');

    expect(() => E2EErrorTriggerPage()).toThrow('e2e-error-trigger');
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
