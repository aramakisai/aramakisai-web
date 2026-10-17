// OpenNext の生成物はビルド後にしか存在しない。存在の有無で型エラーの有無が変わるので ts-expect-error ではなく ts-ignore を使う
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import openNext from '../.open-next/worker.js';

type NotifyTarget = 'pin' | 'snapshot';

interface HubStub {
  fetch(request: Request): Promise<Response>;
  notify(targets: readonly NotifyTarget[]): Promise<void>;
}

export interface SiteEntryEnv {
  readonly SIGNAGE_HUB: {
    idFromName(name: string): unknown;
    get(id: unknown): HubStub;
  };
}

// ハブは固定名の1インスタンス。signage-hub 側の固定名と揃える
const HUB_NAME = 'signage-hub';

function isTargets(value: unknown): value is NotifyTarget[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((t) => t === 'pin' || t === 'snapshot')
  );
}

async function handleNotify(request: Request, hub: HubStub): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const targets = (body as { targets?: unknown } | null)?.targets;
  if (!isTargets(targets)) return new Response('Bad Request', { status: 400 });
  await hub.notify(targets);
  return new Response(null, { status: 204 });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    // Origin: null など URL でない値
    return false;
  }
}

function handleWs(
  request: Request,
  hub: HubStub,
): Promise<Response> | Response {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Upgrade Required', { status: 426 });
  }
  // Access の cookie はクロスサイトの WebSocket にも付くため、Origin で同一オリジンに限る
  if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 });
  return hub.fetch(request);
}

// 旧 2025 年版サイトの配信元。同一 zone の proxied A レコードで、旧サーバーは
// Host: aramakisai.com でだけ 2025 年版を返す
const ARCHIVE_2025_ORIGIN = 'origin-2025.aramakisai.com';

// /20250 などを拾わないよう、/2025 の直後は終端か / に限る
export function isArchive2025Path(pathname: string): boolean {
  return pathname === '/2025' || pathname.startsWith('/2025/');
}

const siteEntry = {
  async fetch(
    request: Request,
    env: SiteEntryEnv,
    ctx: unknown,
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isArchive2025Path(pathname)) {
      // URL を書き換えず接続先だけ差し替える。送信先が自 Worker の zone なので
      // 通常の fetch だと自分自身に戻りループする
      // tsconfig の lib に cf が無いため RequestInit を拡張して渡す
      const init: RequestInit & { cf: { resolveOverride: string } } = {
        cf: { resolveOverride: ARCHIVE_2025_ORIGIN },
      };
      const res = await fetch(request, init);
      // 旧サイトは閲覧可能にしつつ検索結果からは外す。fetch の Response は
      // ヘッダが immutable なので作り直す
      const out = new Response(res.body, res);
      out.headers.set('X-Robots-Tag', 'noindex');
      return out;
    }
    if (pathname === '/api/signage/ws' || pathname === '/api/signage/notify') {
      const hub = env.SIGNAGE_HUB.get(env.SIGNAGE_HUB.idFromName(HUB_NAME));
      return pathname === '/api/signage/ws'
        ? handleWs(request, hub)
        : handleNotify(request, hub);
    }
    return openNext.fetch(request, env, ctx);
  },
};

export default siteEntry;
