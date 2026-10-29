import { readStampEnv, type StampEnv } from './cloudflare-env';
import type { D1Usage } from './stamp-db';
import { allowAnonymousRequest } from './rate-limit';
import { recordRequest, type MetricEndpoint } from './stamp-metrics';

export interface StampReply {
  readonly status: number;
  readonly body: unknown;
  readonly outcome: string;
  readonly usage?: D1Usage | null;
  readonly d1Failed?: boolean;
}

const encoder = new TextEncoder();

// 来場者向け API 共通の枠: env 取得 → 本文読み取り → IP 制限 → 処理 → 計測 1 点。
// env が取れないときは計測先も無いため、計測せずに応答だけ返す
export async function runStampApi(
  request: Request,
  endpoint: MetricEndpoint,
  envFailure: Pick<StampReply, 'status' | 'body'>,
  handler: (env: StampEnv, text: string) => Promise<StampReply>,
): Promise<Response> {
  const startedAt = Date.now();
  const text = request.method === 'GET' ? '' : await request.text();
  const result = await readStampEnv();
  let reply: StampReply;
  if (!result.ok) {
    return Response.json(envFailure.body, {
      status: envFailure.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const { env } = result;
  if (await allowAnonymousRequest(env, request)) {
    reply = await handler(env, text);
  } else {
    reply = {
      status: 429,
      body: { result: 'rate_limited' },
      outcome: 'rate_limited',
    };
  }
  const payload = JSON.stringify(reply.body);
  recordRequest(env, {
    endpoint,
    outcome: reply.outcome,
    status: reply.status,
    requestBytes: encoder.encode(text).length,
    responseBytes: encoder.encode(payload).length,
    totalMs: Date.now() - startedAt,
    usage: reply.usage ?? null,
    d1Failed: reply.d1Failed,
  });
  return new Response(payload, {
    status: reply.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
