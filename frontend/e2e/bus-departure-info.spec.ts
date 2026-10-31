import { expect, test, type Page, type Request } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: site_settings

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL ?? 'http://localhost:3100';
const ODPT_HOST = 'api-public.odpt.org';
// use-bus-realtime.ts の取得間隔(30 秒)を 1 周以上またげる待ち時間
const POLL_WINDOW_MS = 33_000;

test.beforeAll(async () => {
  const result = await checkCmsReachable(CMS_URL, 'globals/site_settings');
  if (result.status === 'cms-dependency-error') {
    throw new Error(`CMS dependency error: ${result.detail}`);
  }
});

function trackRequests(page: Page, origin: string) {
  const odpt: string[] = [];
  const sameOriginData: string[] = [];
  page.on('request', (req: Request) => {
    const url = new URL(req.url());
    if (url.host === ODPT_HOST) odpt.push(url.pathname);
    else if (
      url.origin === origin &&
      ['fetch', 'xhr'].includes(req.resourceType())
    ) {
      sameOriginData.push(req.url());
    }
  });
  return { odpt, sameOriginData };
}

async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => s,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test('/access が専用ページとして出て、サイト設定の本文が反映される', async ({
  page,
}) => {
  const res = await fetch(`${CMS_URL}/api/globals/site_settings?depth=0`);
  const settings = (await res.json()) as { access_content_html?: string };
  const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/
    .exec(settings.access_content_html ?? '')?.[1]
    ?.replace(/<[^>]+>/g, '');
  expect(heading, 'サイト設定のアクセス本文に h2 が必要').toBeTruthy();

  await page.goto('/access');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('main')).toContainText(heading!);
  await expect(page.getByTestId('bus-departure-board')).toBeVisible();
  await expect(page.getByTestId('bus-data-notice')).toContainText(
    '表示4.0国際',
  );
  await expect(
    page.getByRole('link', { name: /関越交通 路線バスの時刻表/ }),
  ).toHaveAttribute('href', 'https://kan-etsu.net/pages/23/');
});

test.describe('リアルタイム情報の取得', () => {
  test.setTimeout(150_000);

  test('開催中のトップページで ODPT からブラウザが直接取得し、Worker への取得が増えず、裏タブでは止まる', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: 'aramakisai_phase_override', value: 'live', url: baseURL! },
    ]);
    const { odpt, sameOriginData } = trackRequests(
      page,
      new URL(baseURL!).origin,
    );
    await page.goto('/');
    await expect(page.getByTestId('bus-departure-board')).toBeVisible();
    await expect
      .poll(() => odpt.length, { message: '初回の取得(2 フィード)' })
      .toBeGreaterThanOrEqual(2);
    expect(odpt.some((p) => p.endsWith('trip_update'))).toBe(true);
    expect(odpt.some((p) => p.endsWith('vehicle'))).toBe(true);
    await expect(
      page
        .getByTestId('bus-departure-row')
        .or(page.getByTestId('bus-departure-ended'))
        .first(),
    ).toBeVisible();

    // 30 秒の次回取得をまたぐ間、ODPT だけが増え、同一オリジン(Worker)への fetch/xhr は 0 件
    sameOriginData.length = 0;
    const before = odpt.length;
    await page.waitForTimeout(POLL_WINDOW_MS);
    expect(odpt.length).toBeGreaterThan(before);
    expect(sameOriginData).toEqual([]);

    await setVisibility(page, 'hidden');
    const hiddenAt = odpt.length;
    await page.waitForTimeout(POLL_WINDOW_MS);
    expect(odpt.length).toBe(hiddenAt);

    await setVisibility(page, 'visible');
    await expect.poll(() => odpt.length).toBeGreaterThan(hiddenAt);
  });
});

test('サイネージに発車案内と短い出典が出る', async ({ page }) => {
  await page.goto('/signage');
  const row = page
    .getByTestId('bus-departure-row')
    .or(page.getByTestId('bus-departure-ended'))
    .first();
  await expect(row).toBeVisible();
  await expect(page.getByTestId('bus-data-notice')).toHaveText(
    'データ: 関越交通(CC BY 4.0)・公共交通オープンデータセンター',
  );
});
