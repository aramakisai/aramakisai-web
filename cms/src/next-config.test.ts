import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('next.config の headers', () => {
  it('全パスに includeSubDomains・preload なしの HSTS を付ける', async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toContainEqual({
      source: '/:path*',
      headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }],
    });
  });
});
