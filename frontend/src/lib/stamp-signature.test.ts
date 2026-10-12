import { describe, expect, it } from 'vitest';
import {
  STAMP_CATEGORIES,
  isStampCategory,
  signStamp,
  verifyStamp,
} from './stamp-signature';

const SECRET = 'test-secret-0123456789-0123456789-abcd'; // gitleaks:allow

describe('stamp-signature', () => {
  it('stage を対象カテゴリから除く', () => {
    expect(STAMP_CATEGORIES).toEqual(['exhibit', 'vendor', 'other']);
    expect(isStampCategory('stage')).toBe(false);
    expect(isStampCategory('exhibit')).toBe(true);
    expect(isStampCategory('nope')).toBe(false);
  });

  it('パディング無しbase64urlの43文字で、同じ組なら同じ値', async () => {
    const a = await signStamp(SECRET, 12, 'exhibit');
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await signStamp(SECRET, 12, 'exhibit')).toBe(a);
  });

  it('組・秘密値が違えば異なる値', async () => {
    const a = await signStamp(SECRET, 12, 'exhibit');
    expect(await signStamp(SECRET, 13, 'exhibit')).not.toBe(a);
    expect(await signStamp(SECRET, 12, 'vendor')).not.toBe(a);
    expect(await signStamp('other-secret', 12, 'exhibit')).not.toBe(a);
  });

  it('正しい値だけ一致する', async () => {
    const sig = await signStamp(SECRET, 12, 'exhibit');
    expect(await verifyStamp(SECRET, 12, 'exhibit', sig)).toBe(true);
    expect(await verifyStamp(SECRET, 13, 'exhibit', sig)).toBe(false);
    expect(await verifyStamp(SECRET, 12, 'vendor', sig)).toBe(false);
    const tampered = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(await verifyStamp(SECRET, 12, 'exhibit', tampered)).toBe(false);
  });

  it('末尾の余りビットだけを変えた値も不一致', async () => {
    const sig = await signStamp(SECRET, 12, 'exhibit');
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(sig[42]);
    const tampered = sig.slice(0, 42) + alphabet[last ^ 1];
    expect(await verifyStamp(SECRET, 12, 'exhibit', tampered)).toBe(false);
  });

  it.each(['', 'abc', '!!!!', 'a'.repeat(44), 'a'.repeat(42), '=', '+/+/'])(
    '不正・長さ違いの値 %j は例外を投げず不一致',
    async (bad) => {
      await expect(verifyStamp(SECRET, 12, 'exhibit', bad)).resolves.toBe(
        false,
      );
    },
  );

  it('stage の算出・検証を受け付けない', async () => {
    await expect(signStamp(SECRET, 1, 'stage' as never)).rejects.toThrow();
    const sig = await signStamp(SECRET, 1, 'exhibit');
    await expect(verifyStamp(SECRET, 1, 'stage' as never, sig)).resolves.toBe(
      false,
    );
  });
});
