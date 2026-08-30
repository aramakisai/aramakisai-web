import { expect, test } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: festival_meta, page_home
// 規約: テストファイル冒頭で依存するコレクションを明記する

// テンプレートのためスキップする（Playwrightの実行対象外とするため）
// 実際にテストを作成する際は .skip を外してください
test.describe.skip('CMS 連携画面のE2Eテストテンプレート', () => {
  test.beforeAll(async () => {
    // 規約: テスト実行前に CMS の疎通確認を行い、
    // CMS のダウンなど環境依存のエラーとフロントエンドのバグを切り分ける
    const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';
    // 依存するコレクションに対して読み取り確認を行う
    const checkResult = await checkCmsReachable(baseUrl, 'festival_meta');

    if (checkResult.status === 'cms-dependency-error') {
      throw new Error(`CMS dependency error: ${checkResult.detail}`);
    }
  });

  test('CMS から取得したデータが画面に表示されていること (Read Only)', async ({
    page,
  }) => {
    // 規約: このテストではデータの書き込み（作成・更新・削除）を行わず、読み取り(GET)のみを行う
    await page.goto('/some-cms-page');

    // 規約: CMS からフェッチしたデータがDOMに反映されていることをアサートする
    // 例: collection由来の特定のテキストが存在するか確認
    await expect(page.locator('main')).toContainText(
      'CMSから取得したテキスト',
    );
  });
});
