import type { StampEnv } from './cloudflare-env';

export async function allowAnonymousRequest(
  env: StampEnv,
  request: Request,
): Promise<boolean> {
  try {
    const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const { success } = await env.STAMP_RATE_LIMITER.limit({ key });
    return success;
  } catch {
    // 制限基盤の障害でスタンプ取得を止めない
    return true;
  }
}
