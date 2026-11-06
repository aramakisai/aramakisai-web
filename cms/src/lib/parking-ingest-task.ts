import { randomBytes } from 'node:crypto';

import type { ParkingDb } from './parking-db';

type IngestDb = Pick<ParkingDb, 'create' | 'update' | 'delete' | 'db' | 'jobs' | 'logger'>;

interface RunArgs {
  readonly payload: IngestDb;
  readonly cameraId: number;
  /** 割り当てが無いカメラは null */
  readonly lot: number | null;
  readonly exposure: number;
  /** ISO 8601 */
  readonly capturedAt: string;
  /** 判定枠の番号 (撮影時刻 / 枠の秒数) */
  readonly window: number;
  /** JPEG の base64 */
  readonly image: string;
}

/** 保存の失敗は例外で返す (ジョブが failed になる)。古い画像の削除と判定の登録の失敗は記録だけにする */
export async function runIngestParkingSnapshot({
  payload,
  cameraId,
  lot,
  exposure,
  capturedAt,
  window,
  image,
}: RunArgs): Promise<void> {
  const data = Buffer.from(image, 'base64');
  const snapshot = await payload.create({
    collection: 'parking_snapshots',
    data: { camera: cameraId, lot, exposure, captured_at: capturedAt, judge_status: 'pending' },
    file: { data, mimetype: 'image/jpeg', name: `${randomBytes(16).toString('hex')}.jpg`, size: data.length },
    overrideAccess: true,
  });
  const snapshotId = snapshot.id as number;
  await payload.update({
    collection: 'parking_cameras',
    id: cameraId,
    data: { last_captured_at: capturedAt },
    overrideAccess: true,
  });

  try {
    await payload.delete({
      collection: 'parking_snapshots',
      where: { and: [{ camera: { equals: cameraId } }, { id: { not_equals: snapshotId } }] },
      overrideAccess: true,
    });
  } catch (err) {
    payload.logger.warn(`parking-ingest: old snapshot cleanup failed camera=${cameraId}: ${String(err)}`);
  }

  try {
    // 検索と更新を1文にしないと、同じカメラの2枚が同時に届いたとき両方が枠を取れてしまう
    const claimed = await payload.db.pool.query(
      `update parking_cameras set last_judged_window = $1
       where id = $2 and (last_judged_window is null or last_judged_window < $1)`,
      [window, cameraId],
    );
    if (claimed.rowCount === 1) {
      await payload.jobs.queue({ task: 'judgeParkingSnapshot', input: { snapshotId, image } });
    } else {
      await payload.update({
        collection: 'parking_snapshots',
        id: snapshotId,
        data: { judge_status: 'skipped', judge_error: 'same_window' },
        overrideAccess: true,
      });
    }
  } catch (err) {
    payload.logger.warn(`parking-ingest: judge enqueue failed camera=${cameraId} snapshot=${snapshotId}: ${String(err)}`);
  }
}
