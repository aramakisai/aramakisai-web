import {
  isInPeriod,
  readRelayConfig,
  type ChannelName,
  type QuakeEnv,
} from './relay-config';
import type { QuakeRelayRpc } from './rpc';

const CHANNELS: readonly ChannelName[] = ['p2p', 'wolfxEew', 'wolfxEqlist'];
const BY_MAX = 254;

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function authorized(request: Request, token: string): boolean {
  const header = request.headers.get('Authorization') ?? '';
  const prefix = 'Bearer ';
  return (
    safeEqual(
      header.startsWith(prefix) ? header.slice(prefix.length) : '',
      token,
    ) && header.startsWith(prefix)
  );
}

const text = (status: number, body: string) => new Response(body, { status });

export async function handleRequest(
  request: Request,
  env: QuakeEnv,
  relay: () => QuakeRelayRpc,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const { method } = request;
  const inject = /^\/dev\/inject\/([^/]+)$/.exec(pathname);

  const known =
    (method === 'GET' && pathname === '/status') ||
    (method === 'POST' && pathname === '/dismiss') ||
    (method === 'POST' && inject !== null);
  if (!known) return text(404, 'Not Found');

  const parsed = readRelayConfig(env);
  if (!parsed.ok) return text(503, 'Service Unavailable');
  const { config } = parsed;
  if (inject && !config.devInject) return text(404, 'Not Found');
  if (!authorized(request, config.token)) return text(401, 'Unauthorized');

  if (inject) {
    const channel = CHANNELS.find((c) => c === inject[1]);
    if (!channel) return text(400, 'Unknown channel');
    const result = await relay().inject(channel, await request.text());
    return new Response(null, { status: result === 'accepted' ? 204 : 202 });
  }

  if (pathname === '/status') return Response.json(await relay().status());

  let by: unknown;
  try {
    by = ((await request.json()) as { by?: unknown } | null)?.by;
  } catch {
    return text(400, 'Bad Request');
  }
  if (typeof by !== 'string' || by.length < 1 || by.length > BY_MAX)
    return text(400, 'Bad Request');
  const result = await relay().dismiss(by);
  return result.ok ? Response.json(result.status) : text(502, 'publish failed');
}

/** 期間外はDOを起こさない */
export async function handleScheduled(
  env: QuakeEnv,
  now: number,
  relay: () => QuakeRelayRpc,
): Promise<void> {
  const parsed = readRelayConfig(env);
  if (!parsed.ok || !isInPeriod(parsed.config, now)) return;
  await relay().ensure();
}
