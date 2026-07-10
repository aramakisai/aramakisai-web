import { expect, test } from '@playwright/test';
import { checkDirectusReachable } from '../scripts/directus-check';

// Depends on Directus collections: festival_meta, page_home
// 規約: テストファイル冒頭で依存するコレクションを明記する

// テンプレートのためスキップする（Playwrightの実行対象外とするため）
// 実際にテストを作成する際は .skip を外してください
test.describe.skip('Directus 連携画面のE2Eテストテンプレート', () => {
  test.beforeAll(async () => {
    // 規約: テスト実行前に Directus の疎通確認を行い、
    // Staging Directus のダウンなど環境依存のエラーとフロントエンドのバグを切り分ける
    const baseUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
    // 依存するコレクションに対して読み取り確認を行う
    const checkResult = await checkDirectusReachable(baseUrl, 'festival_meta');

    if (checkResult.status === 'directus-dependency-error') {
      throw new Error(`Directus dependency error: ${checkResult.detail}`);
    }
  });

  test('Directus から取得したデータが画面に表示されていること (Read Only)', async ({
    page,
  }) => {
    // 規約: このテストではデータの書き込み（作成・更新・削除）を行わず、読み取り(GET)のみを行う
    await page.goto('/some-directus-page');

    // 規約: Directus からフェッチしたデータがDOMに反映されていることをアサートする
    // 例: collection由来の特定のテキストが存在するか確認
    await expect(page.locator('main')).toContainText(
      'Directusから取得したテキスト',
    );
  });
});
