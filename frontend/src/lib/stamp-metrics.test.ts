import { describe, expect, it, vi } from 'vitest';
import { recordRequest, type RequestMeasure } from './stamp-metrics';
import type { StampEnv } from './cloudflare-env';

const base: RequestMeasure = {
  endpoint: 'verify',
  outcome: 'added',
  status: 200,
  requestBytes: 120,
  responseBytes: 18,
  totalMs: 30,
  usage: { rowsRead: 1, rowsWritten: 2, durationMs: 12 },
};

const envWith = (writeDataPoint: (p: unknown) => void) =>
  ({
    STAMP_ENV: 'dev',
    STAMP_METRICS: { writeDataPoint },
  }) as unknown as StampEnv;

describe('recordRequest', () => {
  it('1 点の構成が仕様どおりで、匿名IDを含まない', () => {
    const write = vi.fn();
    recordRequest(envWith(write), base);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      indexes: ['verify'],
      blobs: ['dev', 'verify', 'added', '200'],
      doubles: [120, 18, 30, 12, 1, 2, 0],
    });
  });

  it('D1 を使わないときは D1 の値を 0 にする', () => {
    const write = vi.fn();
    recordRequest(envWith(write), { ...base, usage: null });
    expect(write.mock.calls[0][0].doubles).toEqual([120, 18, 30, 0, 0, 0, 0]);
  });

  it('D1 失敗を d1Failed=1 で残す', () => {
    const write = vi.fn();
    recordRequest(envWith(write), {
      ...base,
      outcome: 'failed',
      d1Failed: true,
    });
    expect(write.mock.calls[0][0].doubles[6]).toBe(1);
  });

  it('書き込みが例外を投げても本処理を落とさない', () => {
    const write = vi.fn(() => {
      throw new Error('ae down');
    });
    expect(() => recordRequest(envWith(write), base)).not.toThrow();
  });
});
