import { expect, test, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';
import { PHASE_OVERRIDE_COOKIE } from '../src/lib/phase';

// Depends on CMS collections: student_exhibitions, sponsors

const CARD_LINKS = 'main a[href^="/exhibitions/"]';

async function cardHrefs(page: Page): Promise<string[]> {
  return page
    .locator(CARD_LINKS)
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
}

/** 並び順の確定を待ってから 1 ページ目のカードの並びを読む */
async function readOrder(page: Page, url = '/exhibitions'): Promise<string[]> {
  await page.goto(url);
  await expect(page.locator('[data-order-pending]')).toHaveCount(0);
  return cardHrefs(page);
}

test.describe('企画一覧のランダム順', () => {
  test.beforeAll(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';
    for (const collection of ['student_exhibitions']) {
      const checkResult = await checkCmsReachable(baseUrl, collection);
      if (checkResult.status === 'cms-dependency-error') {
        throw new Error(
          `CMS dependency error (${collection}): ${checkResult.detail}`,
        );
      }
    }
  });

  test.beforeEach(async ({ context, baseURL }) => {
    // 開催前フェーズでは /exhibitions が非公開のため、開催中に切り替える
    await context.addCookies([
      { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: baseURL },
    ]);
  });

  test('同じタブでは再読み込み・ページ送り・戻る・他ページ経由の後も並びが変わらない', async ({
    page,
  }) => {
    const first = await readOrder(page);
    test.skip(first.length < 5, '企画が少なく並びを検証できません');

    await page.reload();
    await expect(page.locator('[data-order-pending]')).toHaveCount(0);
    expect(await cardHrefs(page)).toEqual(first);

    const next = page
      .getByRole('navigation', { name: 'ページ送り' })
      .locator('a:not([aria-label])')
      .filter({ hasText: /^2$/ });
    if ((await next.count()) > 0) {
      await next.click();
      await expect(page).toHaveURL(/[?&]page=2\b/);
      await page.goBack();
      await expect(page.locator('[data-order-pending]')).toHaveCount(0);
      expect(await cardHrefs(page)).toEqual(first);
    }

    await page.goto('/mypage');
    expect(await readOrder(page)).toEqual(first);
  });

  test('新しいブラウザコンテキストでは並びが変わる', async ({
    page,
    browser,
    baseURL,
  }) => {
    const first = await readOrder(page);
    test.skip(first.length < 5, '企画が少なく並びを検証できません');

    const other = await browser.newContext();
    try {
      await other.addCookies([
        { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: baseURL },
      ]);
      const otherPage = await other.newPage();
      expect(await readOrder(otherPage)).not.toEqual(first);
    } finally {
      await other.close();
    }
  });

  test('初期表示では並び確定前のカードが見えない', async ({ page }) => {
    // 並び確定前 (data-order-pending なし = 見える状態) に描かれたカードの並びを記録する
    await page.addInitScript(() => {
      const w = window as unknown as { __visibleOrders: string[] };
      w.__visibleOrders = [];
      const snapshot = () => {
        if (document.querySelector('[data-order-pending]')) return;
        const links = document.querySelectorAll(
          'main a[href^="/exhibitions/"]',
        );
        if (links.length === 0) return;
        const order = Array.from(links)
          .map((el) => el.getAttribute('href'))
          .join(',');
        if (w.__visibleOrders.at(-1) !== order) w.__visibleOrders.push(order);
      };
      new MutationObserver(snapshot).observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    });
    const order = await readOrder(page);
    test.skip(order.length < 5, '企画が少なく並びを検証できません');

    const visible = await page.evaluate(
      () =>
        (window as unknown as { __visibleOrders: string[] }).__visibleOrders,
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(new Set(visible)).toEqual(new Set([order.join(',')]));
  });

  test('絞り込み後もタブの並びでの相対順が保たれる', async ({ page }) => {
    const first = await readOrder(page);
    test.skip(first.length < 5, '企画が少なく並びを検証できません');

    const category = first[0]!.split('/')[3]!;
    const all = [...first];
    const nav = page.getByRole('navigation', { name: 'ページ送り' });
    const numberLinks = nav.locator('a:not([aria-label])');
    const pageCount =
      (await nav.count()) === 0 || (await numberLinks.count()) === 0
        ? 1
        : Number(await numberLinks.last().innerText());
    for (let p = 2; p <= pageCount; p++) {
      all.push(...(await readOrder(page, `/exhibitions?page=${p}`)));
    }
    const expected = all.filter((href) => href.endsWith(`/${category}`));

    const filtered = await readOrder(page, `/exhibitions?category=${category}`);
    expect(filtered).toEqual(expected.slice(0, filtered.length));
    expect(filtered.length).toBeGreaterThan(0);
  });
});
