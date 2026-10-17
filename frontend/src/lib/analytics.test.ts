import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST' as string | undefined },
}));
vi.mock('@/env', () => envMock);

import { sendGaEvent } from './analytics';

type W = Window & { dataLayer?: unknown[] };

describe('sendGaEvent', () => {
  beforeEach(() => {
    delete (window as W).dataLayer;
    envMock.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST';
  });
  afterEach(() => vi.unstubAllEnvs());

  it('本番かつ測定IDありのとき gtag 形式 (Arguments) で積む', () => {
    vi.stubEnv('NODE_ENV', 'production');
    sendGaEvent('qr_stamp', {
      exhibition_id: 3,
      exhibition_category: 'exhibit',
    });
    const layer = (window as W).dataLayer!;
    expect(layer).toHaveLength(1);
    const entry = layer[0] as ArrayLike<unknown>;
    expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    expect(Array.from(entry)).toEqual([
      'event',
      'qr_stamp',
      { exhibition_id: 3, exhibition_category: 'exhibit' },
    ]);
  });

  it('既存の dataLayer に追記する', () => {
    vi.stubEnv('NODE_ENV', 'production');
    (window as W).dataLayer = ['x'];
    sendGaEvent('qr_stamp', { exhibition_id: 1, exhibition_category: 'other' });
    expect((window as W).dataLayer).toHaveLength(2);
  });

  it('本番でなければ何もしない', () => {
    vi.stubEnv('NODE_ENV', 'development');
    sendGaEvent('qr_stamp', { exhibition_id: 1, exhibition_category: 'other' });
    expect((window as W).dataLayer).toBeUndefined();
  });

  it('測定IDが無ければ何もしない', () => {
    vi.stubEnv('NODE_ENV', 'production');
    envMock.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = undefined;
    sendGaEvent('qr_stamp', { exhibition_id: 1, exhibition_category: 'other' });
    expect((window as W).dataLayer).toBeUndefined();
  });

  it.each(['bookmark_add', 'bookmark_remove'] as const)(
    '%s は stage を含め2項目だけを積む',
    (name) => {
      vi.stubEnv('NODE_ENV', 'production');
      sendGaEvent(name, { exhibition_id: 7, exhibition_category: 'stage' });
      const entry = (window as W).dataLayer![0] as ArrayLike<unknown>;
      expect(Array.from(entry)).toEqual([
        'event',
        name,
        { exhibition_id: 7, exhibition_category: 'stage' },
      ]);
    },
  );

  it('bookmark_add は本番以外・測定IDなしでは送らない', () => {
    vi.stubEnv('NODE_ENV', 'development');
    sendGaEvent('bookmark_add', {
      exhibition_id: 1,
      exhibition_category: 'stage',
    });
    vi.stubEnv('NODE_ENV', 'production');
    envMock.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = undefined;
    sendGaEvent('bookmark_remove', {
      exhibition_id: 1,
      exhibition_category: 'stage',
    });
    expect((window as W).dataLayer).toBeUndefined();
  });
});
