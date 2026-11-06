import { expect, test, type Page } from '@playwright/test';
import { PHASE_OVERRIDE_COOKIE } from '../src/lib/phase';

// Depends on CMS collections: student_exhibitions

type GaCommand = readonly unknown[];
type GaParams = Record<string, unknown>;

async function readDataLayer(page: Page): Promise<GaCommand[]> {
  return page.evaluate(() =>
    (
      (window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ??
      []
    ).map((entry) => Array.from(entry)),
  );
}

async function events(page: Page, name: string): Promise<GaParams[]> {
  return (await readDataLayer(page))
    .filter((c) => c[0] === 'event' && c[1] === name)
    .map((c) => (c[2] ?? {}) as GaParams);
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1000);
}

test.describe('企画の一覧・履歴の GA4 計測', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    // 検証は dataLayer の中身だけで行い、GA4 へは何も送らない
    await page.route('**/gtag/js**', (route) => route.abort());
    await page.route('**/g/collect**', (route) => route.abort());
    await context.addCookies([
      { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: baseURL },
    ]);
  });

  test('企画一覧の表示・選択・絞り込みが一覧の種別と掲載位置つきで積まれ、検索語とシードは含まれない', async ({
    page,
  }) => {
    await page.goto('/exhibitions');
    await expect
      .poll(async () => (await events(page, 'view_item_list')).length)
      .toBe(1);
    const [view] = await events(page, 'view_item_list');
    expect(view).toMatchObject({
      item_list_id: 'exhibitions',
      item_list_name: 'exhibitions',
      list_filtered: 'false',
    });
    const items = view!.items as GaParams[];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({ index: 1 });
    expect(items[0]!.item_id).toMatch(/^\d+:[a-z]+$/);

    const term = 'zzz-検索語';
    await page.getByLabel('企画を検索').fill(term);
    await settle(page);
    const seed = await page.evaluate(() =>
      window.sessionStorage.getItem('aramakisai_exhibition_order_seed'),
    );
    expect(seed).not.toBeNull();
    const serialized = JSON.stringify(await readDataLayer(page));
    expect(serialized).not.toContain(encodeURIComponent(term));
    expect(serialized).not.toContain(term);
    expect(serialized).not.toContain(seed!);

    await page.getByLabel('企画を検索').fill('');
    await settle(page);
    const card = page.locator('main a[href^="/exhibitions/"]').first();
    const href = await card.getAttribute('href');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const selects = await events(page, 'select_item');
    expect(selects).toHaveLength(1);
    expect(selects[0]).toMatchObject({
      item_list_id: 'exhibitions',
      list_filtered: 'false',
    });
    const selected = (selects[0]!.items as GaParams[])[0]!;
    expect(href).toBe(
      `/exhibitions/${String(selected.item_id).replace(':', '/')}`,
    );
  });

  test('絞り込んだ状態の一覧は list_filtered が true になる', async ({
    page,
  }) => {
    await page.goto('/exhibitions?category=stage');
    await expect
      .poll(async () => (await events(page, 'view_item_list')).length)
      .toBeGreaterThan(0);
    expect((await events(page, 'view_item_list')).at(-1)).toMatchObject({
      item_list_id: 'exhibitions',
      list_filtered: 'true',
    });
  });

  test('トップページの注目企画の表示と選択が積まれる', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(async () => (await events(page, 'view_item_list')).length)
      .toBe(1);
    expect((await events(page, 'view_item_list'))[0]).toMatchObject({
      item_list_id: 'home_featured',
    });

    await page.locator('main a[href^="/exhibitions/"]').first().click();
    await expect(page).toHaveURL(/\/exhibitions\/\d+\/[a-z]+$/);
    expect((await events(page, 'select_item'))[0]).toMatchObject({
      item_list_id: 'home_featured',
    });
  });

  test('マイページのブックマーク・履歴の表示と履歴消去が積まれる', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/exhibitions');
    await page
      .getByRole('button', { name: /をブックマーク$/, pressed: false })
      .first()
      .click();
    const href = await page
      .locator('main a[href^="/exhibitions/"]')
      .first()
      .getAttribute('href');
    await page.goto(href!);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(window.localStorage.getItem('aramakisai_mypage') ?? '{}')
              .lists?.history?.length,
        ),
      )
      .toBe(1);

    await page.goto('/mypage#bookmarks');
    await expect
      .poll(async () =>
        (await events(page, 'view_item_list')).map((e) => e.item_list_id),
      )
      .toContain('mypage_bookmarks');

    await page.getByRole('tab', { name: '履歴' }).click();
    await expect
      .poll(async () =>
        (await events(page, 'view_item_list')).map((e) => e.item_list_id),
      )
      .toContain('mypage_history');

    await page
      .locator('#mypage-panel-history a[href^="/exhibitions/"]')
      .first()
      .click();
    await expect(page).toHaveURL(/\/exhibitions\/\d+\/[a-z]+$/);
    expect((await events(page, 'select_item')).at(-1)).toMatchObject({
      item_list_id: 'mypage_history',
    });

    await page.goto('/mypage#history');
    await page.getByRole('button', { name: '履歴を消去' }).click();
    await expect
      .poll(async () => (await events(page, 'history_clear')).length)
      .toBe(1);
    expect((await events(page, 'history_clear'))[0]).toMatchObject({
      item_count: 1,
    });
  });

  test('サイト内遷移の page_view に直前のページが page_referrer として付く', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/exhibitions');
    await expect
      .poll(async () => (await events(page, 'page_view')).length)
      .toBe(1);
    expect((await events(page, 'page_view'))[0]).not.toHaveProperty(
      'page_referrer',
    );

    await page.locator('main a[href^="/exhibitions/"]').first().click();
    await expect(page).toHaveURL(/\/exhibitions\/\d+\/[a-z]+$/);
    await expect
      .poll(async () => (await events(page, 'page_view')).length)
      .toBe(2);
    expect((await events(page, 'page_view'))[1]).toMatchObject({
      page_referrer: `${baseURL}/exhibitions`,
    });
  });
});
