import { describe, expect, it, vi } from 'vitest';
import { checkDirectusReachable } from './directus-check';

describe('checkDirectusReachable', () => {
  it('returns ok on successful 2xx response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const result = await checkDirectusReachable(
      'http://directus',
      'test_collection',
      fetchImpl,
    );
    expect(result).toEqual({ status: 'ok' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://directus/items/test_collection?limit=1',
    );
  });

  it('returns directus-dependency-error on HTTP error (e.g. 403, 500)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 403, statusText: 'Forbidden' }),
      );
    const result = await checkDirectusReachable(
      'http://directus',
      'test_collection',
      fetchImpl,
    );
    expect(result).toEqual({
      status: 'directus-dependency-error',
      detail: 'HTTP error: 403 Forbidden',
    });
  });

  it('returns directus-dependency-error on network exception', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const result = await checkDirectusReachable(
      'http://directus',
      'test_collection',
      fetchImpl,
    );
    expect(result).toEqual({
      status: 'directus-dependency-error',
      detail: 'Network error: fetch failed',
    });
  });
});
