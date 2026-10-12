import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload';

export type NotifyTarget = 'pin' | 'snapshot';
export type SignageNotifyConfig = {
  readonly url: string;
  readonly accessClientId: string;
  readonly accessClientSecret: string;
};

const ENV_NAMES = ['SIGNAGE_NOTIFY_URL', 'SIGNAGE_NOTIFY_ACCESS_CLIENT_ID', 'SIGNAGE_NOTIFY_ACCESS_CLIENT_SECRET'];
const TIMEOUT_MS = 3_000;

export function readSignageNotifyConfig(
  env: Record<string, string | undefined> = process.env,
): SignageNotifyConfig | null {
  const url = env.SIGNAGE_NOTIFY_URL;
  const accessClientId = env.SIGNAGE_NOTIFY_ACCESS_CLIENT_ID;
  const accessClientSecret = env.SIGNAGE_NOTIFY_ACCESS_CLIENT_SECRET;
  return url && accessClientId && accessClientSecret ? { url, accessClientId, accessClientSecret } : null;
}

let warned = false;

/**
 * 待たずに送る。通知は commit より前に走るため、await すると保存が通知先の遅延に引きずられる。
 * 失敗してもハブの保険の取り直しと端末のポーリングで補われるので、保存は成功させる。
 */
export function notifySignage(
  targets: readonly NotifyTarget[],
  log: (message: string) => void,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): void {
  const config = readSignageNotifyConfig(env);
  if (!config) {
    if (!warned) {
      warned = true;
      const missing = ENV_NAMES.filter((name) => !env[name]);
      log(`サイネージへの保存時通知は無効です (未設定: ${missing.join(', ')})。端末の反映はポーリングに頼ります`);
    }
    return;
  }
  const fail = (reason: string) => log(`サイネージへの通知に失敗しました: ${reason}`);
  try {
    fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Access-Client-Id': config.accessClientId,
        'CF-Access-Client-Secret': config.accessClientSecret,
      },
      body: JSON.stringify({ targets }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Access のログイン 302 を追うと 200 の HTML を受けて、拒否が成功に見える
      redirect: 'manual',
    })
      .then((res) => {
        if (res.status !== 204) fail(`HTTP ${res.status}`);
      })
      .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

const logger = (req: { payload: { logger: { warn: (message: string) => void } } }) => (message: string) =>
  req.payload.logger.warn(message);

export function signageNotifyHook(targets: readonly NotifyTarget[]): CollectionAfterChangeHook & CollectionAfterDeleteHook {
  return ({ doc, req }) => {
    notifySignage(targets, logger(req));
    return doc;
  };
}

export function signageNotifyGlobalHook(targets: readonly NotifyTarget[]): GlobalAfterChangeHook {
  return ({ doc, req }) => {
    notifySignage(targets, logger(req));
    return doc;
  };
}
