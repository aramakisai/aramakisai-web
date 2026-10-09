import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';

import type { Media } from '../payload-types';
import { mediaPurgeTargets, readPurgeConfig } from '../lib/edge-purge';

/** 未認証で読める状態か。used_in_published は null が常に公開、true が公開、false だけが非公開 */
const isPublic = (doc: Pick<Media, 'used_in_published'>): boolean => doc.used_in_published !== false;

function fileKey(doc: Media): string {
  const sizes = (doc.sizes ?? {}) as Record<string, { filename?: string | null } | null>;
  return JSON.stringify([doc.filename, Object.keys(sizes).sort().map((k) => [k, sizes[k]?.filename])]);
}

// purge の発行は commit 後に走るジョブに載せる。保存の本処理は Cloudflare に依存させず、
// 失敗はジョブの再試行とログに任せる。read replica の遅れで古い公開状態を再キャッシュしないよう少し待つ
const REPLICA_LAG_GRACE_MS = 10_000;

async function queuePurge(req: Parameters<CollectionAfterDeleteHook>[0]['req'], doc: Media): Promise<void> {
  const config = readPurgeConfig();
  if (!config) return;
  const input = mediaPurgeTargets(config.origin, doc);
  await req.payload.jobs.queue({
    task: 'purgeMediaEdgeCache',
    input,
    waitUntil: new Date(Date.now() + REPLICA_LAG_GRACE_MS),
    req,
  });
}

/**
 * 公開状態だった画像が、非公開になった・ファイルが差し替わったときに旧 URL を purge する。
 * 判定を syncMediaPublication などの更新側ではなく afterChange に置くのは、where 指定の一括更新を含め
 * どの経路 (used_in_published の同期・管理画面・API) の更新もドキュメントごとにこのフックを通り、
 * 更新前後の値を比べるだけで取りこぼさないため。
 */
export const purgeEdgeCacheAfterChange: CollectionAfterChangeHook<Media> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || !previousDoc) return doc;
  const becamePrivate = !isPublic(doc);
  if (isPublic(previousDoc) && (becamePrivate || fileKey(previousDoc) !== fileKey(doc))) {
    await queuePurge(req, previousDoc);
  }
  return doc;
};

export const purgeEdgeCacheAfterDelete: CollectionAfterDeleteHook<Media> = async ({ doc, req }) => {
  if (isPublic(doc)) await queuePurge(req, doc);
  return doc;
};
