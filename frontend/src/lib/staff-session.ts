import { fromBase64Url, toBase64Url } from './stamp-signature';

export const STAFF_SESSION_COOKIE = 'aramakisai_staff';
export const STAFF_SESSION_TTL_SECONDS = 12 * 3600;

export interface StaffIdentity {
  readonly subject: string;
  readonly email: string;
}

const encoder = new TextEncoder();

function importKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

// 接頭辞で企画QR・交換用QRと同じ秘密値を共用しても署名対象が重ならないようにする
function message(body: string) {
  return encoder.encode(`staff-session:${body}`);
}

export async function issueStaffSession(
  secret: string,
  identity: StaffIdentity,
  now: Date,
): Promise<string> {
  const exp = Math.floor(now.getTime() / 1000) + STAFF_SESSION_TTL_SECONDS;
  const body = toBase64Url(
    encoder.encode(
      JSON.stringify({ sub: identity.subject, email: identity.email, exp }),
    ),
  );
  const key = await importKey(secret, 'sign');
  const mac = await crypto.subtle.sign('HMAC', key, message(body));
  return `${body}.${toBase64Url(new Uint8Array(mac))}`;
}

export async function verifyStaffSession(
  secret: string,
  cookieValue: string,
  now: Date,
): Promise<StaffIdentity | null> {
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const mac = fromBase64Url(parts[1]!);
  if (!mac || mac.length !== 32) return null;
  const key = await importKey(secret, 'verify');
  if (!(await crypto.subtle.verify('HMAC', key, mac, message(parts[0]!)))) {
    return null;
  }
  const raw = fromBase64Url(parts[0]!);
  if (!raw) return null;
  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
  if (typeof claims !== 'object' || claims === null) return null;
  const { sub, email, exp } = claims as Record<string, unknown>;
  if (
    typeof sub !== 'string' ||
    typeof email !== 'string' ||
    typeof exp !== 'number' ||
    now.getTime() / 1000 >= exp
  ) {
    return null;
  }
  return { subject: sub, email };
}
