import { describe, expect, it, vi } from 'vitest';
import { waitForPreview } from './wait-for-preview';

describe('waitForPreview', () => {
  it('returns reachable as soon as the preview responds with a 2xx status', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const result = await waitForPreview({
      url: 'https://preview.example.workers.dev',
      headers: {},
      timeoutMs: 5000,
      maxAttempts: 5,
      fetchImpl,
    });

    expect(result).toEqual({ status: 'reachable' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns access-denied immediately on a 403 without consuming remaining retries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 403 }));

    const result = await waitForPreview({
      url: 'https://preview.example.workers.dev',
      headers: { 'CF-Access-Client-Id': 'bad' },
      timeoutMs: 5000,
      maxAttempts: 5,
      fetchImpl,
    });

    expect(result).toEqual({ status: 'access-denied', httpStatus: 403 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns timeout after exhausting maxAttempts on repeated network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await waitForPreview({
      url: 'https://preview.example.workers.dev',
      headers: {},
      timeoutMs: 60000,
      maxAttempts: 3,
      retryDelayMs: 1,
      fetchImpl,
    });

    expect(result).toEqual({ status: 'timeout', attempts: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('returns timeout once the overall timeout elapses, even if attempts remain', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await waitForPreview({
      url: 'https://preview.example.workers.dev',
      headers: {},
      timeoutMs: 10,
      maxAttempts: 100,
      retryDelayMs: 20,
      fetchImpl,
    });

    expect(result.status).toBe('timeout');
    expect(fetchImpl.mock.calls.length).toBeLessThan(100);
  });
});
