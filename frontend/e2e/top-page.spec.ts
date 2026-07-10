import { expect, Page, test } from '@playwright/test';

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
    if (msg.type() === 'error') {
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
