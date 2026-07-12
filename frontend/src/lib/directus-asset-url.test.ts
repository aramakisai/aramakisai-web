import { describe, expect, it, vi } from 'vitest';
import { toAssetUrl } from './directus-asset-url';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
  },
}));

describe('toAssetUrl', () => {
  it('fileIdがnullの場合、nullを返す', () => {
    expect(toAssetUrl(null)).toBeNull();
  });

  it('fileIdが指定された場合、正しいURLを返す', () => {
    expect(toAssetUrl('1234-abcd')).toBe(
      'http://localhost:8055/assets/1234-abcd',
    );
  });
});
