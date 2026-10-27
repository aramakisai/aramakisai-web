import type { ParkingStatus as CmsParkingStatus } from '@/cms-types';

export type ParkingStatus = NonNullable<CmsParkingStatus['status']>;

export interface ParkingImage {
  /** 縮小版 (sizes.web) の絶対 URL。縮小版が無いときだけ原寸 */
  readonly url: string;
  /** 撮影時刻 (ISO 8601) */
  readonly capturedAt: string;
  readonly width: number;
  readonly height: number;
}

export interface ParkingLot {
  readonly id: number;
  readonly name: string;
  /** 当日でない、または未設定のとき null */
  readonly status: ParkingStatus | null;
  /** 空き状況ドキュメントの更新時刻。駐車場名の編集では変わらない。当日でないとき null */
  readonly updatedAt: string | null;
  /** 当日でない・監視時間外・画像が無いとき null。割り当ての有無は区別しない */
  readonly image: ParkingImage | null;
}

export interface ParkingResponse {
  readonly isEventDay: boolean;
  readonly lots: readonly ParkingLot[];
  readonly fetchedAt: string;
}

export const STALE_AFTER_MS = 30 * 60 * 1000;

export function isStale(updatedAt: string, now: Date): boolean {
  return now.getTime() - new Date(updatedAt).getTime() > STALE_AFTER_MS;
}

export const IMAGE_STALE_AFTER_MS = 15 * 60 * 1000;

/** 状態の古さ (`>` 30 分) と違い、撮影から 15 分ちょうどで古い画像とする */
export function isImageStale(capturedAt: string, now: Date): boolean {
  return now.getTime() - new Date(capturedAt).getTime() >= IMAGE_STALE_AFTER_MS;
}
