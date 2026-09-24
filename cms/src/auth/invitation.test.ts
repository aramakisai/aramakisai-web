import { describe, expect, it } from 'vitest';

import { INVITATION_EXPIRATION_MS } from './invitation';

describe('INVITATION_EXPIRATION_MS', () => {
  it('72 時間をミリ秒で表す', () => {
    expect(INVITATION_EXPIRATION_MS).toBe(72 * 60 * 60 * 1000);
  });
});
