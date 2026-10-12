import type { ExhibitionCategory } from './exhibitions';

export type StampCategory = Exclude<ExhibitionCategory, 'stage'>;

// exhibitions.ts の実行時 import は cms/env を連鎖して引き込み、QR 出力スクリプトが
// 環境変数検証で落ちるため、型だけ共有してリテラルで持つ
export const STAMP_CATEGORIES: readonly StampCategory[] = [
  'exhibit',
  'vendor',
  'other',
];

export function isStampCategory(value: string): value is StampCategory {
  return (STAMP_CATEGORIES as readonly string[]).includes(value);
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

function message(id: number, category: StampCategory): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${id}:${category}`);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    // atob は末尾の余りビットを無視するため、末尾 1 文字を変えた値も同じバイト列になる。
    // 正規形と一致しない値は改変として扱う
    return toBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

export async function signStamp(
  secret: string,
  id: number,
  category: StampCategory,
): Promise<string> {
  if (!isStampCategory(category)) {
    throw new Error(`unsupported stamp category: ${category}`);
  }
  const key = await importKey(secret, 'sign');
  const mac = await crypto.subtle.sign('HMAC', key, message(id, category));
  return toBase64Url(new Uint8Array(mac));
}

export async function verifyStamp(
  secret: string,
  id: number,
  category: StampCategory,
  signature: string,
): Promise<boolean> {
  if (!isStampCategory(category)) return false;
  const mac = fromBase64Url(signature);
  // HMAC-SHA256 は 32 バイト。長さ違いは verify に渡さず不一致にする
  if (!mac || mac.length !== 32) return false;
  const key = await importKey(secret, 'verify');
  return crypto.subtle.verify('HMAC', key, mac, message(id, category));
}
