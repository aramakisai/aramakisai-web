import { AsyncLocalStorage } from 'node:async_hooks';

import type { UploadConfig } from 'payload';

// modifyResponseHeaders はリクエストを受け取らないため、同じ非同期の流れで先に走る handlers で
// 認証の有無だけを覚えておく。ローカルディスクと storage-s3 のどちらの配信でも同じ順序で呼ばれる
const authenticated = new AsyncLocalStorage<boolean>();

export const recordFileRequestAuth: NonNullable<UploadConfig['handlers']>[number] = (req) => {
  authenticated.enterWith(Boolean(req.user));
};

/**
 * 配信するファイルを別の種類として解釈させない。認証済みの取得は非公開の画像にも成功するため、
 * Cloudflare の拡張子ベースの既定キャッシュに載って匿名にも配られないよう共有キャッシュを禁じる。
 */
export const modifyFileResponseHeaders: NonNullable<UploadConfig['modifyResponseHeaders']> = ({ headers }) => {
  headers.set('X-Content-Type-Options', 'nosniff');
  if (authenticated.getStore()) headers.set('Cache-Control', 'private, no-store');
};
