import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import { withRegionalCache } from '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache';
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue';

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: 'long-lived',
    // 既定ではヒットのたびに waitUntil 内で R2 get・JSON 変換・cache.put を行い CPU を食う。
    // 代償として古いエントリが colo に最長 revalidate (60 秒) 残る。
    shouldLazilyUpdateOnCacheHit: false,
  }),
  // ponytail: isolate 単位の重複排除のみ。重複再生成が問題になれば doQueue へ
  queue: memoryQueue,
});
