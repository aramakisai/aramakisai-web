import type { Payload, PayloadRequest } from 'payload';

import { loadVisibleSlideIds } from './signage-visibility';

/**
 * 固定中のスライドが表示対象から外れたら固定を外す。
 * 外さないと帯・列だけが固定中を示し、再び表示に戻した時に予告なく固定へ戻る
 */
export async function releasePinIfHidden(payload: Payload, req: PayloadRequest): Promise<void> {
  const settings = await payload.findGlobal({ slug: 'signage_settings', depth: 0, overrideAccess: true, req });
  const pinned = settings.pinned_slide;
  if (pinned === null || pinned === undefined) return;
  const pinnedId = typeof pinned === 'object' ? pinned.id : pinned;
  if ((await loadVisibleSlideIds(payload, req)).includes(pinnedId)) return;
  await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: null }, overrideAccess: true, req });
}
