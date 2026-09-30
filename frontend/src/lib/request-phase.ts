import { cookies } from 'next/headers';
import {
  DEV_OVERRIDE_ENABLED,
  PHASE_OVERRIDE_COOKIE,
  resolvePhase,
  type ResolvedPhase,
} from '@/lib/phase';

export async function getRequestPhase(): Promise<ResolvedPhase> {
  // 本番で cookies() を呼ぶとルートが動的化して ISR に載らないため、フラグが偽なら呼ばない
  if (!DEV_OVERRIDE_ENABLED) return resolvePhase(undefined);
  return resolvePhase((await cookies()).get(PHASE_OVERRIDE_COOKIE)?.value);
}
