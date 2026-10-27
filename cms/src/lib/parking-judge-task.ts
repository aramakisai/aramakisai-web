import { relationId } from '../collections/parking-cameras';
import type { ParkingDb } from './parking-db';
import { judgeImage, type JudgeMode, type JudgeOutcome } from './parking-judge';
import { createParkingJudgeRate } from './parking-judge-rate';

export type Judge = (jpeg: Buffer, mode: JudgeMode, isCurrent: () => Promise<boolean>) => Promise<JudgeOutcome>;

// 判定は cms-worker の 1 プロセスだけが実行するため、モジュール 1 つの計数が全カメラ分になる
const rate = createParkingJudgeRate();

export function createJudge(apiKey: string): Judge {
  return (jpeg, mode, isCurrent) =>
    judgeImage(jpeg, mode, {
      apiKey,
      rate,
      fetchImpl: fetch,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      isCurrent,
    });
}

export function warnIfJudgeUnconfigured(warn: (message: string) => void, apiKey = process.env.GEMINI_API_KEY): void {
  if (!apiKey) warn('GEMINI_API_KEY が未設定のため、駐車場の画像の判定は not_configured で失敗として記録されます');
}

type JudgeDb = Pick<ParkingDb, 'find' | 'findByID' | 'update' | 'logger'>;

interface RunArgs {
  readonly payload: JudgeDb;
  readonly snapshotId: number;
  /** JPEG の base64 */
  readonly image: string;
  /** GEMINI_API_KEY が無いときは null */
  readonly judge: Judge | null;
  readonly now?: () => Date;
}

export async function runJudgeParkingSnapshot({
  payload,
  snapshotId,
  image,
  judge,
  now = () => new Date(),
}: RunArgs): Promise<void> {
  const load = () =>
    payload.findByID({ collection: 'parking_snapshots', id: snapshotId, depth: 0, disableErrors: true, overrideAccess: true });
  const snapshot = await load();
  if (!snapshot) return;
  const cameraId = relationId(snapshot.camera);

  const record = (data: Record<string, unknown>) =>
    payload.update({
      collection: 'parking_snapshots',
      id: snapshotId,
      data: { judged_at: now().toISOString(), ...data },
      overrideAccess: true,
    });
  const warn = (reason: string) =>
    payload.logger.warn(`parking-judge: camera=${cameraId} snapshot=${snapshotId} ${reason}`);

  if (!judge) {
    await record({ judge_status: 'failed', judge_error: 'not_configured' });
    warn('failed: not_configured');
    return;
  }

  const outcome = await judge(
    Buffer.from(image, 'base64'),
    relationId(snapshot.lot) === null ? 'quality_only' : 'congestion_and_quality',
    async () => (await load()) !== null,
  );

  if (outcome.kind === 'superseded') return;
  if (outcome.kind === 'rate_limited') {
    await record({ judge_status: 'skipped', judge_error: 'rate_limited' });
    warn('skipped: rate_limited');
    return;
  }
  if (outcome.kind === 'failed') {
    const error = `api_error: ${outcome.detail}`;
    await record({ judge_status: 'failed', judge_error: error });
    warn(`failed: ${error}`);
    return;
  }

  const { congestion, quality, model } = outcome;
  const unknown = congestion === 'unknown';
  await record({
    judge_status: unknown ? 'failed' : 'succeeded',
    judge_error: unknown ? 'unknown' : congestion !== null && quality === null ? 'invalid_quality' : null,
    congestion,
    image_quality: quality,
    judge_model: model,
  });
  if (unknown) warn('failed: unknown');

  if (quality) await updateExposureBasis(payload, cameraId, snapshot, quality);

  if (congestion === null || unknown) return;
  // 判定の間に割り当てが外れた・付け替えられた画像は、カメラ側のフックが lot を NULL にしている
  const current = await load();
  const lot = current ? relationId(current.lot) : null;
  if (lot === null) return;
  const { docs } = await payload.find({
    collection: 'parking_statuses',
    where: { lot: { equals: lot } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (!docs[0]) return;
  // 値が同じでも更新して updatedAt を新しくする。手入力の値も上書きする
  await payload.update({
    collection: 'parking_statuses',
    id: docs[0].id,
    data: { status: congestion },
    overrideAccess: true,
  });
}

async function updateExposureBasis(
  payload: JudgeDb,
  cameraId: number | string | null,
  snapshot: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  quality: string,
): Promise<void> {
  if (cameraId === null) return;
  const camera = await payload.findByID({
    collection: 'parking_cameras',
    id: cameraId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
  });
  if (!camera) return;
  const basisAt = camera.exposure_basis?.captured_at as string | null | undefined;
  if (basisAt && Date.parse(snapshot.captured_at) <= Date.parse(basisAt)) return;
  await payload.update({
    collection: 'parking_cameras',
    id: cameraId,
    data: { exposure_basis: { quality, exposure: snapshot.exposure, captured_at: snapshot.captured_at } },
    overrideAccess: true,
  });
}
