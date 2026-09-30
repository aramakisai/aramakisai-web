import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookiesMock = vi.fn();
vi.mock('next/headers', () => ({ cookies: () => cookiesMock() }));

async function load(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', enabled ? 'true' : 'false');
  return (await import('./request-phase')).getRequestPhase;
}

describe('getRequestPhase', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({ get: () => ({ value: 'live' }) });
  });

  it('フラグが偽なら cookies() を呼ばず BUILD_PHASE を返す', async () => {
    const getRequestPhase = await load(false);
    expect(await getRequestPhase()).toEqual({
      phase: 'pre_event',
      source: 'constant',
    });
    expect(cookiesMock).not.toHaveBeenCalled();
  });

  it('フラグが真なら cookie の値を使う', async () => {
    const getRequestPhase = await load(true);
    expect(await getRequestPhase()).toEqual({
      phase: 'live',
      source: 'override',
    });
  });
});
