import { describe, expect, it } from 'vitest';
import {
  EXCHANGE_TOKEN_TTL_SECONDS,
  issueExchangeToken,
  verifyExchangeToken,
} from './exchange-token';
import { signStamp } from './stamp-signature';

const SECRET = 'test-secret-0123456789-0123456789-abcd'; // gitleaks:allow
const VID = '3f2b8c1e-6a4d-4e8b-9c1d-2a7f5b6c8d90';
const NOW = new Date('2026-11-14T03:00:00Z');
const after = (s: number) => new Date(NOW.getTime() + s * 1000);

describe('exchange-token', () => {
  it('発行直後は valid、期限は 300 秒後', async () => {
    const t = await issueExchangeToken(SECRET, VID, NOW);
    expect(EXCHANGE_TOKEN_TTL_SECONDS).toBe(300);
    expect(t.expiresAt).toBe(after(300).toISOString());
    expect(await verifyExchangeToken(SECRET, VID, t.token, NOW)).toBe('valid');
    expect(await verifyExchangeToken(SECRET, VID, t.token, after(299))).toBe(
      'valid',
    );
  });

  it('300 秒後は expired', async () => {
    const t = await issueExchangeToken(SECRET, VID, NOW);
    expect(await verifyExchangeToken(SECRET, VID, t.token, after(300))).toBe(
      'expired',
    );
  });

  it('別の匿名ID・別の秘密値は invalid', async () => {
    const t = await issueExchangeToken(SECRET, VID, NOW);
    expect(await verifyExchangeToken(SECRET, 'other-id', t.token, NOW)).toBe(
      'invalid',
    );
    expect(await verifyExchangeToken('other', VID, t.token, NOW)).toBe(
      'invalid',
    );
  });

  it('期限の改変・署名の改変・形式不正は invalid (期限切れでも署名が先)', async () => {
    const t = await issueExchangeToken(SECRET, VID, NOW);
    const [exp, mac] = t.token.split('.');
    expect(
      await verifyExchangeToken(
        SECRET,
        VID,
        `${Number(exp) + 1000}.${mac}`,
        NOW,
      ),
    ).toBe('invalid');
    expect(
      await verifyExchangeToken(
        SECRET,
        VID,
        `${exp}.${mac!.slice(0, -1)}A`,
        NOW,
      ),
    ).toBe('invalid');
    expect(
      await verifyExchangeToken(
        SECRET,
        VID,
        `${Number(exp) - 1}.${mac}`,
        after(1000),
      ),
    ).toBe('invalid');
    for (const bad of [
      '',
      'x',
      `${exp}`,
      `${exp}.`,
      `a.${mac}`,
      `${exp}.${mac}.z`,
    ]) {
      expect(await verifyExchangeToken(SECRET, VID, bad, NOW)).toBe('invalid');
    }
  });

  it('企画QRの署名は invalid', async () => {
    const stamp = await signStamp(SECRET, 12, 'exhibit');
    const exp = Math.floor(NOW.getTime() / 1000) + 300;
    expect(await verifyExchangeToken(SECRET, VID, `${exp}.${stamp}`, NOW)).toBe(
      'invalid',
    );
  });
});
