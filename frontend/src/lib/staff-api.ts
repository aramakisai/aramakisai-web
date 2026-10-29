import { readStampEnv, type StampEnv } from './cloudflare-env';
import { requireStaff } from './staff-auth';
import {
  createStampRepository,
  type D1Usage,
  type StampRepository,
} from './stamp-db';
import { recordRequest, type MetricEndpoint } from './stamp-metrics';

export interface StaffApiContext {
  readonly env: StampEnv;
  readonly staff: string;
  readonly repo: StampRepository;
  readonly request: Request;
  readonly now: Date;
}

export interface StaffApiResult {
  readonly status: number;
  readonly body: unknown;
  readonly outcome: string;
  readonly usage?: D1Usage | null;
  readonly d1Failed?: boolean;
}

const HEADERS = { 'Cache-Control': 'no-store' };
const encoder = new TextEncoder();

// 認可・Origin 確認・計測を管理者 API の POST で共通にする。run は認可を通った後にだけ呼ばれる
export async function handleStaffPost(
  request: Request,
  endpoint: MetricEndpoint,
  run: (ctx: StaffApiContext) => Promise<StaffApiResult>,
): Promise<Response> {
  const started = Date.now();
  const requestBytes = Number(request.headers.get('content-length')) || 0;
  const read = await readStampEnv();
  const respond = (r: StaffApiResult): Response => {
    const text = JSON.stringify(r.body);
    if (read.ok) {
      recordRequest(read.env, {
        endpoint,
        outcome: r.outcome,
        status: r.status,
        requestBytes,
        responseBytes: encoder.encode(text).length,
        totalMs: Date.now() - started,
        usage: r.usage ?? null,
        d1Failed: r.d1Failed,
      });
    }
    return new Response(text, {
      status: r.status,
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
    });
  };

  if (!read.ok) {
    return respond({
      status: 503,
      body: { error: 'unavailable' },
      outcome: 'error',
    });
  }
  const { env } = read;
  // Cookie は SameSite=Lax だが、同一サイトの別オリジンからの POST を Origin で止める
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return respond({
      status: 403,
      body: { error: 'forbidden' },
      outcome: 'forbidden',
    });
  }
  const auth = await requireStaff(request, env);
  if (auth.kind === 'login_required') {
    return respond({
      status: 401,
      body: { error: 'login_required' },
      outcome: 'unauthorized',
    });
  }
  if (auth.kind === 'forbidden') {
    return respond({
      status: 403,
      body: { error: 'forbidden' },
      outcome: 'forbidden',
    });
  }
  try {
    return respond(
      await run({
        env,
        staff: auth.staff,
        repo: createStampRepository(env.STAMP_DB as never),
        request,
        now: new Date(),
      }),
    );
  } catch {
    return respond({
      status: 503,
      body: { error: 'unavailable' },
      outcome: 'error',
    });
  }
}
