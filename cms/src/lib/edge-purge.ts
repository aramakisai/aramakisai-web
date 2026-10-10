import { optionalEnv } from '../env';

export type PurgeConfig = { zoneId: string; token: string; origin: string };
export type PurgeTargets = { files: string[]; prefixes: string[] };
type PurgeableMedia = { id: number | string; filename?: string | null; sizes?: object | null };

/**
 * Free プランの上限 (公式 https://developers.cloudflare.com/cache/how-to/purge-cache/):
 * 単一ファイル purge は 1 リクエスト 100 URL、プレフィックス purge は 1 リクエスト 100 件。
 * 単一ファイルは毎秒 800 URL まで、プレフィックスは Free だと 1 分 5 リクエストまで。
 */
export const PURGE_BATCH_SIZE = 100;

export function readPurgeConfig(env: Record<string, string | undefined> = process.env): PurgeConfig | null {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const token = env.CLOUDFLARE_PURGE_TOKEN;
  const origin = env.CMS_PUBLIC_URL?.replace(/\/+$/, '');
  return zoneId && token && origin ? { zoneId, token, origin } : null;
}

let warned = false;
/** 未設定のまま動かしていることを、プロセスにつき 1 回だけ知らせる */
export function warnIfPurgeUnconfigured(log: (message: string) => void): void {
  if (warned || readPurgeConfig()) return;
  warned = true;
  const missing = ['CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_PURGE_TOKEN', 'CMS_PUBLIC_URL'].filter(
    (name) => !optionalEnv(name),
  );
  log(
    `エッジキャッシュの purge は無効です (未設定: ${missing.join(', ')})。非公開化した画像が CDN に残り続ける可能性があります`,
  );
}

/**
 * 画像 1 件分の purge 対象。
 * - serve: /api/media/serve/<id>/ 配下をプレフィックスで消す。サイズ名は URL に任意の文字列を
 *   取れ、どれも 302 として別々にキャッシュされるため、列挙ではなく配下全体で取りこぼしを防ぐ。
 * - file: ファイル名がサイズごとに異なりプレフィックスでは他の画像を巻き込むため、原本と各サイズを URL で指定する。
 *   URL の形は Payload の generateFilePathOrURL (`/api/media/file/<encodeURIComponent(filename)>`) に合わせる。
 */
export function mediaPurgeTargets(origin: string, doc: PurgeableMedia): PurgeTargets {
  const filenames = new Set<string>();
  if (doc.filename) filenames.add(doc.filename);
  for (const size of Object.values((doc.sizes ?? {}) as Record<string, { filename?: string | null } | null>)) {
    if (size?.filename) filenames.add(size.filename);
  }
  return {
    files: [...filenames].map((name) => `${origin}/api/media/file/${encodeURIComponent(name)}`),
    // プレフィックスはスキームを含めない仕様
    prefixes: [`${origin.replace(/^https?:\/\//, '')}/api/media/serve/${doc.id}/`],
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * purge を Cloudflare に発行する。1 回でも失敗したら throw する (呼び出し側のジョブ再試行に任せる)。
 * purge は冪等なので、再試行で成功済みの分を再送しても害はない。
 */
export async function purgeEdgeCache(
  config: PurgeConfig,
  targets: PurgeTargets,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const bodies = [
    ...chunk(targets.files, PURGE_BATCH_SIZE).map((files) => ({ files })),
    ...chunk(targets.prefixes, PURGE_BATCH_SIZE).map((prefixes) => ({ prefixes })),
  ];
  for (const body of bodies) {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; errors?: unknown } | null;
    if (!res.ok || json?.success !== true) {
      throw new Error(`Cloudflare purge に失敗しました (HTTP ${res.status}): ${JSON.stringify(json?.errors ?? null)}`);
    }
  }
}
