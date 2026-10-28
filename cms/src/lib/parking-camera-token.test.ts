import { describe, expect, it } from 'vitest';

import { generateCameraToken, hashCameraToken } from './parking-camera-token';

describe('parking-camera-token', () => {
  it('発行値は 43 文字の base64url で毎回異なる', () => {
    const a = generateCameraToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateCameraToken()).not.toBe(a);
  });

  it('同じ値は同じハッシュ (SHA-256 hex) になり、違う値は違うハッシュになる', () => {
    expect(hashCameraToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashCameraToken('abc')).not.toBe(hashCameraToken('abd'));
  });
});
