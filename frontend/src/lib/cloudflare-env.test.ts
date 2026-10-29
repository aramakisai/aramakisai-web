import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCloudflareContext = vi.fn();
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext }));

import { readStampEnv } from './cloudflare-env';

const full = () => ({
  STAMP_DB: {},
  STAMP_METRICS: {},
  STAMP_RATE_LIMITER: {},
  STAMP_SIGNING_SECRET: 's',
  STAMP_ENV: 'preview',
  STAFF_OIDC_ISSUER: 'https://idp.example',
  STAFF_OIDC_CLIENT_ID: 'id',
  STAFF_OIDC_CLIENT_SECRET: 'secret',
});

describe('readStampEnv', () => {
  beforeEach(() => {
    getCloudflareContext.mockReset();
  });

  it('全て揃っていれば ok', async () => {
    getCloudflareContext.mockReturnValue({ env: full() });
    const r = await readStampEnv();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.env.STAMP_ENV).toBe('preview');
  });

  it.each(['prod', 'dev', 'preview'])(
    'STAMP_ENV=%s を受け付ける',
    async (v) => {
      getCloudflareContext.mockReturnValue({
        env: { ...full(), STAMP_ENV: v },
      });
      expect((await readStampEnv()).ok).toBe(true);
    },
  );

  it('STAMP_ENV が欠けても preview に落とさず失敗する', async () => {
    const rest: Record<string, unknown> = full();
    delete rest.STAMP_ENV;
    getCloudflareContext.mockReturnValue({ env: rest });
    expect(await readStampEnv()).toEqual({ ok: false, missing: ['STAMP_ENV'] });
  });

  it('STAMP_ENV が不正値なら失敗する', async () => {
    getCloudflareContext.mockReturnValue({
      env: { ...full(), STAMP_ENV: 'staging' },
    });
    expect(await readStampEnv()).toEqual({ ok: false, missing: ['STAMP_ENV'] });
  });

  it('欠けた値とバインディングを全て列挙する', async () => {
    getCloudflareContext.mockReturnValue({
      env: { ...full(), STAMP_DB: undefined, STAFF_OIDC_ISSUER: '' },
    });
    expect(await readStampEnv()).toEqual({
      ok: false,
      missing: ['STAMP_DB', 'STAFF_OIDC_ISSUER'],
    });
  });

  it('preview は OIDC クライアント情報が無くても ok、prod では失敗', async () => {
    const rest: Record<string, unknown> = full();
    delete rest.STAFF_OIDC_CLIENT_ID;
    delete rest.STAFF_OIDC_CLIENT_SECRET;
    getCloudflareContext.mockReturnValue({ env: rest });
    const r = await readStampEnv();
    expect(r.ok && r.env.STAFF_OIDC_CLIENT_ID).toBe('');
    getCloudflareContext.mockReturnValue({
      env: { ...rest, STAMP_ENV: 'prod' },
    });
    expect(await readStampEnv()).toEqual({
      ok: false,
      missing: ['STAFF_OIDC_CLIENT_ID', 'STAFF_OIDC_CLIENT_SECRET'],
    });
  });

  it('コンテキスト取得が例外でも失敗として返す', async () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error('no ctx');
    });
    const r = await readStampEnv();
    expect(r.ok).toBe(false);
  });
});
