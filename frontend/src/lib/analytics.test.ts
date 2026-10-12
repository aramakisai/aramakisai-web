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
});
