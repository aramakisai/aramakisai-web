import { fromBase64Url, toBase64Url } from './stamp-signature';

export const EXCHANGE_TOKEN_TTL_SECONDS = 300;

export interface ExchangeToken {
  readonly token: string;
  readonly expiresAt: string;
}

export type ExchangeTokenCheck = 'valid' | 'expired' | 'invalid';

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

// 接頭辞で企画QRの署名 (`<id>:<category>`) と署名対象が重ならないようにする
function message(visitorId: string, expiresAtSec: number) {
  return encoder.encode(`exchange:${visitorId}:${expiresAtSec}`);
}

export async function issueExchangeToken(
  secret: string,
  visitorId: string,
  now: Date,
): Promise<ExchangeToken> {
  const exp = Math.floor(now.getTime() / 1000) + EXCHANGE_TOKEN_TTL_SECONDS;
  const key = await importKey(secret, 'sign');
  const mac = await crypto.subtle.sign('HMAC', key, message(visitorId, exp));
  return {
    token: `${exp}.${toBase64Url(new Uint8Array(mac))}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export async function verifyExchangeToken(
  secret: string,
  visitorId: string,
  token: string,
  now: Date,
): Promise<ExchangeTokenCheck> {
  const parts = token.split('.');
  if (parts.length !== 2 || !/^\d{1,15}$/.test(parts[0]!)) return 'invalid';
  const exp = Number(parts[0]);
  const mac = fromBase64Url(parts[1]!);
  if (!mac || mac.length !== 32) return 'invalid';
  const key = await importKey(secret, 'verify');
  // 期限より先に署名を検証し、改変された期限の値で結果が変わらないようにする
  if (
    !(await crypto.subtle.verify('HMAC', key, mac, message(visitorId, exp)))
  ) {
    return 'invalid';
  }
  return now.getTime() / 1000 >= exp ? 'expired' : 'valid';
}
