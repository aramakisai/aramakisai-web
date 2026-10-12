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
    expect(SignageGroups.hooks?.afterChange).toHaveLength(2);
    expect(SignageSlides.hooks?.afterChange).toHaveLength(2);
    expect(SignageSlides.hooks?.afterDelete).toHaveLength(1);
    expect(Telops.hooks?.afterChange).toHaveLength(1);
    expect(Telops.hooks?.afterDelete).toHaveLength(1);
    expect(SignageSettings.hooks?.afterChange).toHaveLength(1);
    expect(FestivalMeta.hooks?.afterChange).toHaveLength(1);
  });
});
