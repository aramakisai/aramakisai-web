import { describe, expect, it } from 'vitest';

import { INVITATION_EXPIRATION_MS } from './invitation';

describe('INVITATION_EXPIRATION_MS', () => {
  it('100 年先で、JS Date と Postgres timestamp の範囲に収まる', () => {
    expect(INVITATION_EXPIRATION_MS).toBe(100 * 365 * 24 * 60 * 60 * 1000);
    expect(Number.isFinite(new Date(Date.now() + INVITATION_EXPIRATION_MS).getTime())).toBe(true);
  });
});
