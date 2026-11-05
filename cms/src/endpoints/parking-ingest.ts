import type { Endpoint, PayloadHandler } from 'payload';

import { relationId } from '../collections/parking-cameras';
import { hashCameraToken } from '../lib/parking-camera-token';
import type { ParkingDb } from '../lib/parking-db';
import { appendDeviceLog, decodeDeviceLog, readDeviceStatus } from '../lib/parking-device-status';
import { nextExposure, type ExposureBasis } from '../lib/parking-exposure';
import { limitedSharp } from '../lib/image-limits';
import { isWithinMonitorWindow } from '../lib/parking-monitor';

const MAX_BYTES = 1024 * 1024;
const MAX_FUTURE_SEC = 120;
const MAX_PAST_SEC = 600;
const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_MONITOR = { start: '09:00', end: '17:30' };

export interface IngestDeps {
  readonly now: () => Date;
  readonly windowSeconds: number;
}

export function readWindowSeconds(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.PARKING_JUDGE_WINDOW_SECONDS);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_WINDOW_SECONDS;
}

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** 上限を超えた時点で読むのをやめる。超えたら null */
async function readLimited(body: ReadableStream<Uint8Array> | null): Promise<Buffer | null> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function isJpeg(contentType: string | null, data: Buffer): Promise<boolean> {
  if (contentType?.split(';')[0].trim().toLowerCase() !== 'image/jpeg') return false;
  if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) return false;
  try {
    return (await limitedSharp(data).metadata()).format === 'jpeg';
  } catch {
    return false;
  }
}

export function ingestHandler(
  deps: IngestDeps = { now: () => new Date(), windowSeconds: readWindowSeconds() },
): PayloadHandler {
  return async (req) => {
    const payload = req.payload as unknown as ParkingDb;
    const received = deps.now();

    const token = /^Bearer (\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
    if (!token) return fail('unauthorized', 401);
    const { docs } = await payload.find({
      collection: 'parking_cameras',
      where: { token_hash: { equals: hashCameraToken(token) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const camera = docs[0];
    if (!camera) return fail('unauthorized', 401);

    // 端末の不調で画像が拒否されていても、状態だけは遠隔で見えるよう検証より先に書く
    const device = readDeviceStatus(req.headers);
    // 不正な値は無視してログを変えない。group の更新で log が消えないよう既存値を書き戻す
    const added = decodeDeviceLog(req.headers.get('x-device-log'));
    const existingLog = (camera.device_status as { log?: string | null } | null | undefined)?.log ?? null;
    const log = added === null ? existingLog : appendDeviceLog(existingLog, received, added);
    await payload.update({
      collection: 'parking_cameras',
      id: camera.id,
      data: {
        device_status: {
          rssi: device.rssi,
          uptime: device.uptime,
          reset_reason: device.resetReason,
          failures: device.failures,
          firmware: device.firmware,
          log,
          received_at: received.toISOString(),
        },
      },
      overrideAccess: true,
    });

    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return fail('too_large', 413);
    const data = await readLimited(req.body as ReadableStream<Uint8Array> | null);
    if (!data) return fail('too_large', 413);
    if (!(await isJpeg(req.headers.get('content-type'), data))) return fail('not_jpeg', 415);

    const exposureHeader = req.headers.get('x-exposure');
    if (exposureHeader === null || !/^-?\d+$/.test(exposureHeader)) return fail('invalid_exposure', 400);
    const exposure = Number(exposureHeader) + 0;
    if (exposure < -2 || exposure > 2) return fail('invalid_exposure', 400);

    const capturedHeader = req.headers.get('x-captured-at');
    if (capturedHeader === null || !/^\d+$/.test(capturedHeader)) return fail('invalid_captured_at', 400);
    const capturedSec = Number(capturedHeader);
    const diffSec = capturedSec - received.getTime() / 1000;
    if (diffSec > MAX_FUTURE_SEC || -diffSec > MAX_PAST_SEC) return fail('invalid_captured_at', 400);
    const capturedAt = new Date(capturedSec * 1000);

    const settings = await payload.findGlobal({ slug: 'site_settings', depth: 0, overrideAccess: true });
    const monitor = { ...DEFAULT_MONITOR, ...(settings.parking_monitor ?? {}) };
    if (!isWithinMonitorWindow(capturedAt, monitor)) return Response.json({});

    const basis = camera.exposure_basis as
      | { quality?: ExposureBasis['quality']; exposure?: number; captured_at?: string }
      | null
      | undefined;
    const response =
      basis?.quality && typeof basis.exposure === 'number' && basis.captured_at
        ? nextExposure({ quality: basis.quality, exposure: basis.exposure, capturedAt: basis.captured_at }, received)
        : null;

    try {
      await payload.jobs.queue({
        task: 'ingestParkingSnapshot',
        input: {
          cameraId: camera.id,
          lot: relationId(camera.lot),
          exposure,
          capturedAt: capturedAt.toISOString(),
          window: Math.floor(capturedSec / deps.windowSeconds),
          image: data.toString('base64'),
        },
      });
    } catch (err) {
      payload.logger.warn(`parking-ingest: enqueue failed camera=${camera.id}: ${String(err)}`);
      return fail('internal', 500);
    }

    return Response.json(response === null ? {} : { exposure: response });
  };
}

export const parkingIngestEndpoints: Endpoint[] = [{ path: '/parking-ingest', method: 'post', handler: ingestHandler() }];
