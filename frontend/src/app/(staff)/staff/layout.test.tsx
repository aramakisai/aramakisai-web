import { describe, expect, it } from 'vitest';
import { metadata } from './layout';

describe('StaffLayout', () => {
  it('検索エンジンにインデックスさせない', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
