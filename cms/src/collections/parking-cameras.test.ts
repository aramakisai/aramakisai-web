import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { ParkingCameras, detachSnapshotsOnLotChange, deleteSnapshotsBeforeDelete, relationId } from './parking-cameras';

type F = { name: string; [key: string]: unknown };
const field = (name: string) => ParkingCameras.fields.find((f) => (f as F).name === name) as F;
const sub = (group: string, name: string) => (field(group).fields as F[]).find((f) => f.name === name)!;

describe('ParkingCameras 定義', () => {
  it('slug と一覧の列', () => {
    expect(ParkingCameras.slug).toBe('parking_cameras');
    expect(ParkingCameras.admin?.defaultColumns).toEqual([
      'name',
      'lot',
      'last_captured_at',
      'device_status.rssi',
      'device_status.failures',
      'device_status.received_at',
      'token_issued_at',
    ]);
    expect(ParkingCameras.access).toBeUndefined();
  });

  it('name は必須、lot は一意の単一リレーション', () => {
    expect(field('name')).toMatchObject({ type: 'text', required: true, maxLength: 255 });
    expect(field('lot')).toMatchObject({ type: 'relationship', relationTo: 'parking_lots', unique: true });
    expect(field('lot').hasMany).toBeUndefined();
    expect(field('lot').required).toBeFalsy();
  });

  it('token_hash は一意で、誰にも読み書きさせず画面にも出さない', () => {
    const f = field('token_hash') as F & { access: Record<string, () => boolean>; admin: { hidden: boolean } };
    expect(f.unique).toBe(true);
    expect(f.access.read()).toBe(false);
    expect(f.access.create()).toBe(false);
    expect(f.access.update()).toBe(false);
    expect(f.admin.hidden).toBe(true);
  });

  it('最後に判定を積んだ枠は画面に出ない', () => {
    expect((field('last_judged_window').admin as { hidden: boolean }).hidden).toBe(true);
  });

  it('システムが書く項目は画面で読み取りのみで、人は書けない', () => {
    const targets = [
      field('token_issued_at'),
      field('last_captured_at'),
      field('outage_notified_at'),
      sub('exposure_basis', 'quality'),
      sub('exposure_basis', 'exposure'),
      sub('exposure_basis', 'captured_at'),
      ...(field('device_status').fields as F[]),
    ];
    expect(targets).toHaveLength(12);
    for (const f of targets) {
      expect((f.admin as { readOnly: boolean }).readOnly, f.name).toBe(true);
      expect((f.access as { update: () => boolean }).update(), f.name).toBe(false);
    }
  });

  it('端末状態は 5 項目と受信時刻を持つ', () => {
    expect((field('device_status').fields as F[]).map((f) => f.name)).toEqual([
      'rssi',
      'uptime',
      'reset_reason',
      'failures',
      'firmware',
      'received_at',
    ]);
  });
});

describe('relationId', () => {
  it('ID・オブジェクト・空を正規化する', () => {
    expect(relationId(3)).toBe(3);
    expect(relationId({ id: 4 })).toBe(4);
    expect(relationId(undefined)).toBeNull();
    expect(relationId(null)).toBeNull();
  });
});

describe('割り当て変更フック', () => {
  const run = async (previousLot: unknown, lot: unknown, operation: 'create' | 'update' = 'update') => {
    const update = vi.fn();
    await (detachSnapshotsOnLotChange as CollectionAfterChangeHook)({
      doc: { id: 7, lot },
      previousDoc: { id: 7, lot: previousLot },
      operation,
      req: { payload: { update } },
    } as never);
    return update;
  };

  it('付け替え・外す・割り当てるで、そのカメラの割り当て済みの画像の lot を空にする', async () => {
    for (const [prev, next] of [[1, 2], [1, null], [null, 2]] as const) {
      const update = await run(prev, next);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'parking_snapshots',
          where: { camera: { equals: 7 }, lot: { exists: true } },
          data: { lot: null },
          overrideAccess: true,
        }),
      );
    }
  });

  it('割り当てが変わらなければ何もしない (ID とオブジェクトの違いは同じとみなす)', async () => {
    expect(await run(1, 1)).not.toHaveBeenCalled();
    expect(await run({ id: 1 }, 1)).not.toHaveBeenCalled();
    expect(await run(null, null)).not.toHaveBeenCalled();
  });

  it('作成時は何もしない', async () => {
    expect(await run(null, 2, 'create')).not.toHaveBeenCalled();
  });
});

describe('削除フック', () => {
  it('そのカメラの画像を削除する', async () => {
    const del = vi.fn();
    await (deleteSnapshotsBeforeDelete as CollectionBeforeDeleteHook)({
      id: 9,
      req: { payload: { delete: del } },
    } as never);
    expect(del).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'parking_snapshots',
        where: { camera: { equals: 9 } },
        overrideAccess: true,
      }),
    );
  });
});
