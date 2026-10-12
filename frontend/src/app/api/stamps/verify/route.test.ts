import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({
  env: {
    STAMP_SIGNING_SECRET: 'test-secret-0123456789-0123456789', // gitleaks:allow
  } as Record<string, unknown>,
  throws: false,
}));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    if (ctx.throws) throw new Error('no context');
    return { env: ctx.env };
  },
}));

import { signStamp } from '@/lib/stamp-signature';
import { POST } from './route';

const SECRET = 'test-secret-0123456789-0123456789'; // gitleaks:allow
const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/stamps/verify', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

async function valid(res: Response) {
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  return (await res.json()) as { valid: boolean };
}

describe('POST /api/stamps/verify', () => {
  beforeEach(() => {
    ctx.env = { STAMP_SIGNING_SECRET: SECRET };
    ctx.throws = false;
  });

  it('正しい値で一致', async () => {
    const signature = await signStamp(SECRET, 5, 'exhibit');
    const res = await post({ id: 5, category: 'exhibit', signature });
    expect(res.status).toBe(200);
    expect(await valid(res)).toEqual({ valid: true });
  });

  it('誤った値・別の組の値は不一致', async () => {
    const signature = await signStamp(SECRET, 5, 'exhibit');
    expect(
      await valid(await post({ id: 6, category: 'exhibit', signature })),
    ).toEqual({ valid: false });
    expect(
      await valid(
        await post({ id: 5, category: 'exhibit', signature: 'x'.repeat(43) }),
      ),
    ).toEqual({ valid: false });
  });

  it('stage・未知カテゴリは不一致', async () => {
    const signature = await signStamp(SECRET, 5, 'exhibit');
    for (const category of ['stage', 'unknown', 1, null]) {
      expect(await valid(await post({ id: 5, category, signature }))).toEqual({
        valid: false,
      });
    }
  });

  it('不正な id・長すぎる検証値・型違いは不一致', async () => {
    const signature = await signStamp(SECRET, 5, 'exhibit');
    for (const id of [0, -1, 1.5, '5', null, undefined]) {
      expect(
        await valid(await post({ id, category: 'exhibit', signature })),
      ).toEqual({ valid: false });
    }
    expect(
      await valid(
        await post({ id: 5, category: 'exhibit', signature: 'a'.repeat(65) }),
      ),
    ).toEqual({ valid: false });
    expect(
      await valid(await post({ id: 5, category: 'exhibit', signature: 5 })),
    ).toEqual({ valid: false });
    expect(await valid(await post([1, 2]))).toEqual({ valid: false });
    expect(await valid(await post('null'))).toEqual({ valid: false });
  });

  it('秘密値が未設定・空・取得不可なら不一致', async () => {
    const signature = await signStamp(SECRET, 5, 'exhibit');
    const body = { id: 5, category: 'exhibit', signature };
    ctx.env = {};
    expect(await valid(await post(body))).toEqual({ valid: false });
    ctx.env = { STAMP_SIGNING_SECRET: '' };
    expect(await valid(await post(body))).toEqual({ valid: false });
    ctx.throws = true;
    expect(await valid(await post(body))).toEqual({ valid: false });
  });

  it('JSON として読めなければ 400', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('リクエスト内容をログに出さない', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    await post({ id: 5, category: 'exhibit', signature: 'abc' });
    await post('{bad');
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    vi.restoreAllMocks();
  });
});
