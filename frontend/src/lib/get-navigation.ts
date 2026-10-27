import { cache } from 'react';
import { cms } from './cms';
import {
  navigationFromCms,
  navigationItemsByPhase,
  type NavigationByPhase,
} from './navigation';

// layout が CMS の応答待ちで描画できなくならないよう、短く打ち切る
const NAVIGATION_TIMEOUT_MS = 3000;

/**
 * 全ページのヘッダーが依存するため、例外は投げず必ず表示可能なナビを返す
 * (layout で投げると global-error になる)。
 * CMS → 直近の正常値 (長期保持) → コード定数の順に縮退する。
 */
export const getNavigation = cache(async (): Promise<NavigationByPhase> => {
  const query = { depth: 1 };
  try {
    const fresh = await cms.findGlobal('navigation', query, {
      timeoutMs: NAVIGATION_TIMEOUT_MS,
      retained: 'save',
    });
    if (fresh.ok) return navigationFromCms(fresh.value);
    console.error(
      `ナビゲーションの取得に失敗 (${fresh.error.kind}): 直近の正常値を使います`,
    );
    const retained = await cms.findGlobal('navigation', query, {
      retained: 'read',
    });
    if (retained.ok) return navigationFromCms(retained.value);
  } catch (error) {
    console.error('ナビゲーションの変換に失敗しました', error);
  }
  console.error('直近の正常値が無いため、コード定数のナビゲーションを使います');
  return navigationItemsByPhase;
});
