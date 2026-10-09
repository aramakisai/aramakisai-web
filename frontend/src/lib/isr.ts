/** `next build` 中 (CMS が無いダミー環境を含む) の事前描画かどうか */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * ISR ページの CMS 取得用。ビルド時だけ失敗を空値に置き換え、実行時は例外のまま伝える。
 * 実行時に空や縮退の描画を返すと、その結果が次の再検証までキャッシュされて
 * 古い正常なページを上書きするため、例外で再検証を失敗させて古いページを保つ。
 */
export async function loadForIsr<T>(
  load: () => Promise<T>,
  emptyAtBuild: T,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isBuildPhase()) return emptyAtBuild;
    throw error;
  }
}
