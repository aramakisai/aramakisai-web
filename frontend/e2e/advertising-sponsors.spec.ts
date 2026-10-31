import { expect, test, type Page } from '@playwright/test';

async function openPage(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      return route.continue();
    return route.abort();
  });
  await page.goto('/sponsors/ad', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: '広告協賛', exact: true }),
  ).toBeVisible();
}

// PC 寸法の上限 (Figma 1410:26 / 1408:2)。幅 x 高さ
const CARD_MAX = {
  planA: [548, 234.857],
  planB: [357.333, 178.667],
  planC: [268, 134],
} as const;
const LOGO_MAX = {
  planA: [460, 170],
  planB: [300, 120],
  planC: [220, 86],
} as const;

test.describe('広告協賛 fixture E2E', { tag: '@local-fixture' }, () => {
  test.skip(
    process.env.E2E_LOCAL_APP !== '1',
    '専用のローカル fixture 環境でのみ実行',
  );
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  for (const width of [1440, 1023, 390]) {
    test(`${width}px の列・カード寸法・配置`, async ({ page }) => {
      await openPage(page, width);
      const pc = width >= 1024;
      const columns = pc ? [2, 3, 4, 3, 3] : [1, 2, 2, 2, 2];
      const lists = [
        ...['planA', 'planB', 'planC', 'planD'].map(
          (tier) => `ul[data-tier="${tier}"]`,
        ),
        'ul[aria-labelledby="personal-sponsors-heading"]',
      ];
      for (const [index, selector] of lists.entries()) {
        const list = page.locator(selector);
        expect(
          await list.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
          ),
        ).toBe(columns[index]);
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);

      const body = await page.locator('h1').evaluate((el) => {
        const rect = el.parentElement!.parentElement!.getBoundingClientRect();
        return { x: rect.x, width: rect.width };
      });
      for (const [index, tier] of (
        ['planA', 'planB', 'planC'] as const
      ).entries()) {
        const items = page.locator(`ul[data-tier="${tier}"] > li`);
        const [maxW, maxH] = CARD_MAX[tier];
        const first = (await items.first().boundingBox())!;
        // 1024px 未満は上限で止まる。1023px は PC 寸法ちょうど
        if (width === 1023) {
          expect(first.width).toBeCloseTo(maxW, 1);
          expect(first.height).toBeCloseTo(maxH, 1);
          const logo = (await items.first().locator('img').boundingBox())!;
          expect(logo.width).toBeCloseTo(LOGO_MAX[tier][0], 0);
          expect(logo.height).toBeCloseTo(LOGO_MAX[tier][1], 0);
        }
        expect(first.width / first.height).toBeCloseTo(
          index === 0 ? 7 / 3 : 2,
          1,
        );
        // ロゴは領域内に収まり、縦横比を保つ
        const image = items.first().locator('img');
        expect(
          await image.evaluate((img) => getComputedStyle(img).objectFit),
        ).toBe('contain');
      }
      if (width === 1023) {
        // 各行のまとまりが本文の中で左右中央、D と個人の一覧は B の行と同じ幅
        const rowLeft = async (selector: string) =>
          (await page.locator(selector).boundingBox())!.x;
        const bLeft = body.x + (body.width - 726.667) / 2;
        for (const selector of [
          'ul[data-tier="planB"]',
          'ul[data-tier="planD"]',
          lists[4],
        ])
          expect(await rowLeft(selector)).toBeCloseTo(bLeft, 1);
        expect(await rowLeft('ul[data-tier="planA"]')).toBeCloseTo(
          body.x + (body.width - 548) / 2,
          1,
        );
      }
      for (const text of [
        '架空D企業名がとても長くても省略せず折り返して表示されます',
        '架空の長い個人協賛者名が省略されず折り返して表示されます様',
      ]) {
        const item = page.getByText(text);
        expect(
          await item.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
      }
    });
  }

  test('リンクのホバーとキーボードフォーカス', async ({ page }) => {
    await openPage(page, 1440);
    const linked = page.locator('ul[data-tier="planA"] > li').first();
    const plain = page.locator('ul[data-tier="planA"] > li').nth(1);
    const link = linked.getByRole('link');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(plain.getByRole('link')).toHaveCount(0);
    const shadow = (el: Element) => getComputedStyle(el).boxShadow;
    expect(await linked.evaluate(shadow)).toBe('none');
    await linked.hover();
    await expect.poll(() => linked.evaluate(shadow)).not.toBe('none');
    await plain.hover();
    expect(await plain.evaluate(shadow)).toBe('none');
    const noLogo = page.locator('ul[data-tier="planC"] > li', {
      hasText: '架空ロゴなしC',
    });
    await noLogo.hover();
    await expect
      .poll(() =>
        noLogo
          .locator('.mansai-spectrum-line')
          .evaluate((el) => getComputedStyle(el).scale),
      )
      .toBe('1');
    expect(await noLogo.evaluate(shadow)).toBe('none');
    for (
      let i = 0;
      i < 30 && !(await link.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((el) =>
        parseFloat(getComputedStyle(el).outlineWidth),
      ),
    ).toBeGreaterThan(0);
  });
});
