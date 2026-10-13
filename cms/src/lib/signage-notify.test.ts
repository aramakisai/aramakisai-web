import { describe, expect, it, vi } from 'vitest';

import { notifySignage, readSignageNotifyConfig, signageNotifyGlobalHook, signageNotifyHook } from './signage-notify';

const env = {
  SIGNAGE_NOTIFY_URL: 'https://example.test/api/signage/notify',
  SIGNAGE_NOTIFY_ACCESS_CLIENT_ID: 'id',
  SIGNAGE_NOTIFY_ACCESS_CLIENT_SECRET: 'secret',
};

describe('readSignageNotifyConfig', () => {
  it('3 つ揃えば設定を返す', () => {
    expect(readSignageNotifyConfig(env)).toEqual({
      url: env.SIGNAGE_NOTIFY_URL,
      accessClientId: 'id',
      accessClientSecret: 'secret',
    });
  });

  it('1 つでも欠ければ null', () => {
    expect(readSignageNotifyConfig({ ...env, SIGNAGE_NOTIFY_ACCESS_CLIENT_SECRET: '' })).toBeNull();
    expect(readSignageNotifyConfig({})).toBeNull();
  });
});

describe('notifySignage', () => {
  it('設定が揃わなければ送らず、警告はプロセスにつき 1 回', () => {
    const fetchImpl = vi.fn();
    const log = vi.fn();
    notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, {});
    notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, {});
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('SIGNAGE_NOTIFY_URL');
  });

  it('Access のヘッダと targets の本文で POST する', () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    notifySignage(['pin', 'snapshot'], vi.fn(), fetchImpl as unknown as typeof fetch, env);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(env.SIGNAGE_NOTIFY_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'secret',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body)).toEqual({ targets: ['pin', 'snapshot'] });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fetch が reject しても例外を出さず警告に残す', async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    expect(() => notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, env)).not.toThrow();
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(log.mock.calls[0][0]).toContain('boom');
  });

  it('fetch が同期的に throw しても例外を出さない', () => {
    const log = vi.fn();
    const fetchImpl = vi.fn(() => {
      throw new Error('sync');
    });
    expect(() => notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, env)).not.toThrow();
    expect(log).toHaveBeenCalled();
  });

  it('リダイレクトを追わず、Access のログイン 302 を失敗として警告する', async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, env);
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('manual');
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(log.mock.calls[0][0]).toContain('302');
  });

  it('204 以外の 2xx も失敗として警告する', async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, env);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(log.mock.calls[0][0]).toContain('200');
  });

  it('HTTP エラーも警告に残す', async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    notifySignage(['pin'], log, fetchImpl as unknown as typeof fetch, env);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(log.mock.calls[0][0]).toContain('403');
  });
});

describe('フック', () => {
  it('コレクションのフックは doc を返す', () => {
    const doc = { id: 1 };
    const warn = vi.fn();
    const hook = signageNotifyHook(['pin']);
    expect(hook({ doc, req: { payload: { logger: { warn } } } } as never)).toBe(doc);
  });

  it('グローバルのフックは doc を返す', () => {
    const doc = { pinned_slide: 1 };
    const warn = vi.fn();
    const hook = signageNotifyGlobalHook(['pin']);
    expect(hook({ doc, req: { payload: { logger: { warn } } } } as never)).toBe(doc);
  });
});

describe('対象の配線', () => {
  it('設計の対象表どおりにフックが付いている', async () => {
    const { SignageGroups } = await import('../collections/signage-groups');
    const { SignageSlides } = await import('../collections/signage-slides');
    const { Telops } = await import('../collections/telops');
    const { SignageSettings } = await import('../globals/signage-settings');
    const { FestivalMeta } = await import('../globals/festival-meta');
    const { SiteSettings } = await import('../globals/site-settings');
    expect(SignageGroups.hooks?.afterChange).toHaveLength(2);
    expect(SignageSlides.hooks?.afterChange).toHaveLength(2);
    expect(SignageSlides.hooks?.afterDelete).toHaveLength(1);
    expect(Telops.hooks?.afterChange).toHaveLength(1);
    expect(Telops.hooks?.afterDelete).toHaveLength(1);
    expect(SignageSettings.hooks?.afterChange).toHaveLength(1);
    expect(FestivalMeta.hooks?.afterChange).toHaveLength(1);
    expect(SiteSettings.hooks?.afterChange).toHaveLength(1);
  });

  it('グループは表示切替で加わるスライドの中身のため pin と snapshot を通知する', async () => {
    const { SignageGroups } = await import('../collections/signage-groups');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const req = { payload: { logger: { warn: vi.fn() } } };
    const change = SignageGroups.hooks?.afterChange?.at(-1);
    const del = SignageGroups.hooks?.afterDelete?.at(-1);
    await change?.({ doc: {}, req } as never);
    await del?.({ doc: {}, req } as never);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) expect(JSON.parse(call[1].body)).toEqual({ targets: ['pin', 'snapshot'] });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
