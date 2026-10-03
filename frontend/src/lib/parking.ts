import type { ParkingStatus as CmsParkingStatus } from '@/cms-types';

export type ParkingStatus = NonNullable<CmsParkingStatus['status']>;

export interface ParkingLot {
  readonly id: number;
  readonly name: string;
  /** 当日でない、または未設定のとき null */
  readonly status: ParkingStatus | null;
  /** 空き状況ドキュメントの更新時刻。駐車場名の編集では変わらない。当日でないとき null */
  readonly updatedAt: string | null;
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
