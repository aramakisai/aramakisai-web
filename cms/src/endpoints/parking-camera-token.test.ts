import type { PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { hashCameraToken } from '../lib/parking-camera-token';
import { parkingCameraTokenEndpoints, tokenHandler } from './parking-camera-token';

const executive = { id: 1, role: 'executive', email: 'exec@example.com' };

function setup(user: unknown, camera: unknown = { id: 7 }) {
  const payload = {
    findByID: vi.fn().mockResolvedValue(camera),
    update: vi.fn().mockResolvedValue({}),
  };
  const req = { user, payload, routeParams: { id: '7' } } as unknown as PayloadRequest;
  return { payload, req };
}

describe('エンドポイントの登録', () => {
  it('POST と DELETE を /:id/token に置く', () => {
    expect(parkingCameraTokenEndpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'post /:id/token',
      'delete /:id/token',
    ]);
  });
});

describe('tokenHandler', () => {
  it('実行委員でなければ 403 で何も読み書きしない', async () => {
    for (const user of [null, { id: 2, role: 'student_exhibitor', email: 's@example.com' }]) {
      for (const method of ['post', 'delete'] as const) {
        const { payload, req } = setup(user);
        expect((await tokenHandler(method)(req)).status).toBe(403);
        expect(payload.findByID).not.toHaveBeenCalled();
        expect(payload.update).not.toHaveBeenCalled();
      }
    }
  });

  it('カメラが無ければ 404', async () => {
    for (const method of ['post', 'delete'] as const) {
      const { payload, req } = setup(executive, null);
      expect((await tokenHandler(method)(req)).status).toBe(404);
      expect(payload.update).not.toHaveBeenCalled();
    }
  });

  it('発行は 43 文字の値を返し、保存するのはそのハッシュと発行時刻だけ', async () => {
    const { payload, req } = setup(executive);
    const res = await tokenHandler('post')(req);
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const args = payload.update.mock.calls[0][0] as { id: number; overrideAccess: boolean; data: Record<string, unknown> };
    expect(String(args.id)).toBe('7');
    expect(args.overrideAccess).toBe(true);
    expect(args.data.token_hash).toBe(hashCameraToken(token));
    expect(typeof args.data.token_issued_at).toBe('string');
    expect(JSON.stringify(args)).not.toContain(token);
  });

  it('発行し直すたびに別の値とハッシュになる', async () => {
    const { payload, req } = setup(executive);
    const a = (await (await tokenHandler('post')(req)).json()) as { token: string };
    const b = (await (await tokenHandler('post')(req)).json()) as { token: string };
    expect(a.token).not.toBe(b.token);
    const hashes = payload.update.mock.calls.map((c) => (c[0] as { data: { token_hash: string } }).data.token_hash);
    expect(hashes[0]).not.toBe(hashes[1]);
  });

  it('無効化はハッシュと発行時刻を空にして 204', async () => {
    const { payload, req } = setup(executive);
    const res = await tokenHandler('delete')(req);
    expect(res.status).toBe(204);
    expect((payload.update.mock.calls[0][0] as { data: unknown }).data).toEqual({
      token_hash: null,
      token_issued_at: null,
    });
  });
});
