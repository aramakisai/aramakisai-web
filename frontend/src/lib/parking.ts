import type { ParkingStatus as CmsParkingStatus } from '@/cms-types';

export type ParkingStatus = NonNullable<CmsParkingStatus['status']>;

export interface ParkingLot {
  readonly id: number;
  readonly name: string;
  readonly status: ParkingStatus;
  /** 空き状況ドキュメントの更新時刻。駐車場名の編集では変わらない */
  readonly updatedAt: string;
}

export interface ParkingSnapshot {
  readonly lots: readonly ParkingLot[];
  readonly fetchedAt: string;
}

export type ParkingResponse =
  { readonly enabled: false } | ({ readonly enabled: true } & ParkingSnapshot);

export const STALE_AFTER_MS = 30 * 60 * 1000;

export function isStale(lot: ParkingLot, now: Date): boolean {
  return now.getTime() - new Date(lot.updatedAt).getTime() > STALE_AFTER_MS;
}
