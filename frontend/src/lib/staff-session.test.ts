import { describe, expect, it } from 'vitest';
import {
  STAFF_SESSION_TTL_SECONDS,
  issueStaffSession,
  verifyStaffSession,
} from './staff-session';
import { toBase64Url } from './stamp-signature';

const SECRET = 'test-secret-0123456789-0123456789-abcd'; // gitleaks:allow
const ID = { subject: 'u-1', email: 'a@example.com' };
const NOW = new Date('2026-11-14T03:00:00Z');
const after = (s: number) => new Date(NOW.getTime() + s * 1000);
const enc = new TextEncoder();

describe('staff-session', () => {
  it('発行直後は識別子とメールを返し、12 時間で失効する', async () => {
    const c = await issueStaffSession(SECRET, ID, NOW);
    expect(STAFF_SESSION_TTL_SECONDS).toBe(12 * 3600);
    expect(await verifyStaffSession(SECRET, c, after(12 * 3600 - 1))).toEqual(
      ID,
    );
    expect(await verifyStaffSession(SECRET, c, after(12 * 3600))).toBeNull();
  });

  it('別の秘密値・本文の改ざん・署名の改ざんは null', async () => {
    const c = await issueStaffSession(SECRET, ID, NOW);
    const [body, mac] = c.split('.');
    expect(await verifyStaffSession('other', c, NOW)).toBeNull();
    const forged = toBase64Url(
      enc.encode(
        JSON.stringify({ sub: 'u-2', email: ID.email, exp: 9999999999 }),
      ),
    );
    expect(
      await verifyStaffSession(SECRET, `${forged}.${mac}`, NOW),
    ).toBeNull();
    expect(
      await verifyStaffSession(SECRET, `${body}.${mac!.slice(0, -1)}A`, NOW),
    ).toBeNull();
  });

  it('形式不正は null', async () => {
    const c = await issueStaffSession(SECRET, ID, NOW);
    for (const bad of ['', 'x', `${c}.z`, '.', 'a.b']) {
      expect(await verifyStaffSession(SECRET, bad, NOW)).toBeNull();
    }
  });

  it('署名が正しくても本文が想定の形でなければ null', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const body = toBase64Url(enc.encode(JSON.stringify({ sub: 1 })));
    const mac = await crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(`staff-session:${body}`),
    );
    expect(
      await verifyStaffSession(
        SECRET,
        `${body}.${toBase64Url(new Uint8Array(mac))}`,
        NOW,
      ),
    ).toBeNull();
  });

  it('企画QRの署名と同じ秘密値でも接頭辞で別物になる', async () => {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const body = toBase64Url(
      enc.encode(JSON.stringify({ sub: 'u', email: 'e', exp: 9999999999 })),
    );
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    expect(
      await verifyStaffSession(
        SECRET,
        `${body}.${toBase64Url(new Uint8Array(mac))}`,
        NOW,
      ),
    ).toBeNull();
  });
});
