import { expect, test, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
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

// 本物の ODPT に通信しないよう、リポジトリの fixture を返す
async function mockOdpt(page: Page) {
  const fixture = (name: string) =>
    readFileSync(`src/lib/__fixtures__/${name}.pb`);
  await page.route(`https://${ODPT_HOST}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const name = path.endsWith('trip_update')
      ? 'gtfs-rt-trip-update'
      : 'gtfs-rt-vehicle';
    return route.fulfill({
      status: 200,
      contentType: 'application/x-protobuf',
      // CORS ヘッダが無いとブラウザが fulfill した応答を読めない
      headers: { 'access-control-allow-origin': '*' },
      body: fixture(name),
    });
  });
}

function trackRequests(page: Page, origin: string) {
  const odpt: string[] = [];
  const sameOriginData: string[] = [];
  page.on('request', (req: Request) => {
    const url = new URL(req.url());
    // Next.js のリンクのプリフェッチ (本番ビルドのみ) は時刻表とは無関係
    if (req.headers()['next-router-prefetch']) return;
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

test('/access が専用ページとして出て、サイト設定の本文と時刻表・出典が出る', async ({
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
  await expect(
    page.getByRole('heading', { name: '群馬大学行バス時刻表' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '前橋駅行バス時刻表' }),
  ).toBeVisible();
  await expect(page.getByTestId('bus-campus-bound-timetable')).toContainText(
    '下線太字は群馬大学荒牧で降車',
  );
  await expect(page.getByTestId('bus-timetable')).toBeVisible();
  await expect(page.getByTestId('bus-data-notice')).toContainText(
    '表示4.0国際',
  );
  await expect(
    page.getByRole('link', { name: /関越交通 路線バスの時刻表/ }),
  ).toHaveAttribute('href', 'https://kan-etsu.net/pages/23/');
});

test.describe('ODPT へのリクエスト', () => {
  test('トップページ(開催中)と /access は ODPT にも Worker のデータ取得にも要求を出さない', async ({
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
    for (const path of ['/', '/access']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3_000);
    }
    expect(odpt).toEqual([]);
    expect(sameOriginData).toEqual([]);
  });
});

test.describe('サイネージのリアルタイム情報の取得', () => {
  test.setTimeout(150_000);

  test('ブラウザが ODPT から直接取得し、裏タブでは止まる', async ({
    page,
    baseURL,
  }) => {
    await mockOdpt(page);
    const { odpt } = trackRequests(page, new URL(baseURL!).origin);
    await page.goto('/signage');
    await expect
      .poll(() => odpt.length, { message: '初回の取得(2 フィード)' })
      .toBeGreaterThanOrEqual(2);
    expect(odpt.some((p) => p.endsWith('trip_update'))).toBe(true);
    expect(odpt.some((p) => p.endsWith('vehicle'))).toBe(true);

    const before = odpt.length;
    await page.waitForTimeout(POLL_WINDOW_MS);
    expect(odpt.length).toBeGreaterThan(before);

    await setVisibility(page, 'hidden');
    const hiddenAt = odpt.length;
    await page.waitForTimeout(POLL_WINDOW_MS);
    expect(odpt.length).toBe(hiddenAt);

    await setVisibility(page, 'visible');
    await expect.poll(() => odpt.length).toBeGreaterThan(hiddenAt);
  });
});

test('サイネージに発車案内と短い出典が出る', async ({ page }) => {
  await mockOdpt(page);
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
