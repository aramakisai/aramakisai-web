import type { Endpoint, PayloadHandler } from 'payload';

import { isExecutive, toCmsUser } from '../access/roles';
import { generateCameraToken, hashCameraToken } from '../lib/parking-camera-token';
import type { ParkingDb } from '../lib/parking-db';

/** 実行委員だけに開く。値は発行の応答でだけ返し、保存するのはハッシュのみ */
export function tokenHandler(method: 'post' | 'delete'): PayloadHandler {
  return async (req) => {
    if (!isExecutive(toCmsUser(req.user))) return Response.json({ error: 'forbidden' }, { status: 403 });
    const payload = req.payload as unknown as ParkingDb;
    const id = req.routeParams?.id as string | number;
    const camera = await payload.findByID({
      collection: 'parking_cameras',
      id,
      depth: 0,
      disableErrors: true,
      overrideAccess: true,
    });
    if (!camera) return Response.json({ error: 'not_found' }, { status: 404 });

    if (method === 'delete') {
      await payload.update({
        collection: 'parking_cameras',
        id,
        data: { token_hash: null, token_issued_at: null },
        overrideAccess: true,
      });
      return new Response(null, { status: 204 });
    }

    const token = generateCameraToken();
    await payload.update({
      collection: 'parking_cameras',
      id,
      data: { token_hash: hashCameraToken(token), token_issued_at: new Date().toISOString() },
      overrideAccess: true,
    });
    return Response.json({ token });
  };
}

export const parkingCameraTokenEndpoints: Endpoint[] = [
  { path: '/:id/token', method: 'post', handler: tokenHandler('post') },
  { path: '/:id/token', method: 'delete', handler: tokenHandler('delete') },
];
