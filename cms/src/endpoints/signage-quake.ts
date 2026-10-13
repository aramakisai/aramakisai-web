import type { Endpoint, PayloadHandler } from 'payload';

import { isExecutive, toCmsUser } from '../access/roles';
import { callRelay, readRelayConfig } from '../lib/signage-quake-relay';

const MAX_EMAIL_LENGTH = 254;

/** 固定表示を保存できる実行委員だけに開く。解除者の記録(by)は認証したユーザーのメールで、管理画面からの本文は受けない */
export function relayHandler(
  path: '/status' | '/dismiss',
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): PayloadHandler {
  return async (req) => {
    const user = toCmsUser(req.user);
    if (!isExecutive(user)) return Response.json({ error: 'forbidden' }, { status: 403 });
    const config = readRelayConfig(env);
    if (!config) return Response.json({ error: 'not_configured' }, { status: 503 });

    let by: string | null = null;
    if (path === '/dismiss') {
      const email = (req.user as { email?: unknown } | null)?.email;
      if (typeof email !== 'string' || email.length < 1 || email.length > MAX_EMAIL_LENGTH) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
      }
      by = email;
    }
    const result = await callRelay(config, path, by, fetchImpl);
    if (!result.ok) return Response.json({ error: 'relay_unreachable' }, { status: 502 });
    return Response.json(result.status);
  };
}

export const signageQuakeEndpoints: Endpoint[] = [
  { path: '/signage-quake', method: 'get', handler: relayHandler('/status') },
  { path: '/signage-quake/dismiss', method: 'post', handler: relayHandler('/dismiss') },
];
