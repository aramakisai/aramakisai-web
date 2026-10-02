import type { ParkingLot as CmsParkingLot } from '@/cms-types';

export type ParkingStatus = CmsParkingLot['status'];

export type ParkingLot = Pick<
  CmsParkingLot,
  'id' | 'name' | 'status' | 'updatedAt'
>;

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
