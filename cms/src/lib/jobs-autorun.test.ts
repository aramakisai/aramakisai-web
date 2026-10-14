import { afterEach, describe, expect, it, vi } from 'vitest';

import { shouldAutoRun } from './jobs-autorun';

describe('shouldAutoRun', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('未設定なら有効 (VITEST 以外)', () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('CMS_JOBS_AUTORUN', '');
    expect(shouldAutoRun()).toBe(true);
  });

  it("CMS_JOBS_AUTORUN='false' のときだけ無効", () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('CMS_JOBS_AUTORUN', 'false');
    expect(shouldAutoRun()).toBe(false);
  });

  it("'true' など false 以外は有効", () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('CMS_JOBS_AUTORUN', 'true');
    expect(shouldAutoRun()).toBe(true);
  });

  it('VITEST 下では無効', () => {
    vi.stubEnv('VITEST', 'true');
    expect(shouldAutoRun()).toBe(false);
  });
});
