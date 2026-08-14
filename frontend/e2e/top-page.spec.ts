import { expect, Page, test } from '@playwright/test';

/**
 * Google Maps埋め込みiframe自身が発する内部テレメトリping (gen_204) はCORSで
 * 常に失敗するが、Google側の既知の挙動でありアプリの不具合ではないため無視する。
 * ブラウザは同じ失敗に対して詳細メッセージ (maps.googleapis.comを含む) と、
 * URLを含まない汎用の "Failed to load resource: net::ERR_FAILED" の2行を出す。
 * 本アプリはDirectusをサーバー側fetchで取得しクライアント側XHRを持たないため、
 * このアプリのクライアントで汎用ERR_FAILEDが出る経路はMaps埋め込み以外に無い。
 */
function isKnownBenignThirdPartyNoise(text: string): boolean {
  if (text.includes('maps.googleapis.com')) return true;
  return text === 'Failed to load resource: net::ERR_FAILED';
}

/**
 * クライアント側の未処理例外やコンソールエラーを監視・蓄積するヘルパー関数
 */
function setupErrorTracker(page: Page): string[] {
  const errors: string[] = [];

  // 未処理例外をキャッチ
  page.on('pageerror', (exception) => {
    errors.push(
      `[Unhandled Exception] ${exception.message}\n${exception.stack || ''}`,
    );
  });

  // コンソールエラー（Reactのハイドレーション失敗など）をキャッチ
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isKnownBenignThirdPartyNoise(msg.text())) {
      errors.push(`[Console Error] ${msg.text()}`);
    }
  });

  return errors;
}

test('トップページが到達可能で主要な DOM 要素が描画される', async ({
  page,
}) => {
  const errors = setupErrorTracker(page);

  await page.goto('/');
  await expect(page.locator('main')).toContainText('荒牧祭');

  // エラーが蓄積されていないことを検証
  expect(
    errors,
    `ルートパス '/' でクライアント側のエラーが検出されました:\n${errors.join('\n---\n')}`,
  ).toEqual([]);
});
