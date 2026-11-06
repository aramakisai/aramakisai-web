import { expect, test, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';
import { PHASE_OVERRIDE_COOKIE } from '../src/lib/phase';

// Depends on CMS collections: student_exhibitions

const DETAIL_HREF = /^\/exhibitions\/\d+\/[a-z]+$/;

async function historyCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('aramakisai_mypage');
    return raw ? (JSON.parse(raw).lists?.history?.length ?? 0) : 0;
  });
}

test.describe('閲覧履歴', () => {
  test.beforeAll(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';
    const checkResult = await checkCmsReachable(baseUrl, 'student_exhibitions');
    if (checkResult.status === 'cms-dependency-error') {
      throw new Error(
        `CMS dependency error (student_exhibitions): ${checkResult.detail}`,
      );
    }
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: baseURL },
    ]);
  });

  test('詳細の閲覧が新しい順に履歴タブへ並び、項目から詳細を開け、消去で空になってもブックマークは残る', async ({
    page,
  }) => {
    // タブはスマートフォン幅 (1024px 未満) でしか表示されない
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/exhibitions');
    const hrefs = (
      await page
        .locator('main a[href^="/exhibitions/"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))
    ).filter((h) => DETAIL_HREF.test(h));
    const targets = Array.from(new Set(hrefs)).slice(0, 3);
    test.skip(targets.length < 3, '企画が少なく履歴を検証できません');

    await page
      .getByRole('button', { name: /をブックマーク$/, pressed: false })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: /をブックマーク$/, pressed: true }),
    ).toHaveCount(1);

    for (const [i, href] of targets.entries()) {
      await page.goto(href);
      await expect.poll(() => historyCount(page)).toBe(i + 1);
      // 閲覧日時は ISO 文字列の比較で並べるため、同一ミリ秒の衝突を避ける
      await page.waitForTimeout(5);
    }

    await page.goto('/mypage#history');
    const panel = page.locator('#mypage-panel-history');
    const links = panel.locator('a[href^="/exhibitions/"]');
    await expect(links).toHaveCount(3);
    expect(
      await links.evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')),
      ),
    ).toEqual([...targets].reverse());

    await links.first().click();
    await expect(page).toHaveURL(new RegExp(`${targets[2]}$`));
    await page.goBack();

    await page.getByRole('tab', { name: '履歴' }).click();
    await page.getByRole('button', { name: '履歴を消去' }).click();
    await expect(panel.getByText('履歴はありません')).toBeVisible();
    expect(await historyCount(page)).toBe(0);

    await page.getByRole('tab', { name: 'ブックマーク' }).click();
    await expect(
      page.locator('#mypage-panel-bookmarks a[href^="/exhibitions/"]'),
    ).toHaveCount(1);
  });
});
