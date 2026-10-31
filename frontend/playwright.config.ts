import { defineConfig, devices } from '@playwright/test';

// このファイルは Playwright（Node.js プロセス）としてのみ実行される。
// frontend/src の Edge Runtime 制約（Node.js 専用 API 不可）は
// テスト対象のアプリケーションコードにのみ適用され、テストランナー自体には適用されない。

const cfAccessHeaders: Record<string, string> = {};
if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
  cfAccessHeaders['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
  cfAccessHeaders['CF-Access-Client-Secret'] =
    process.env.CF_ACCESS_CLIENT_SECRET;
}

// ローカルでは開発サーバーを make 経由で起動する運用のため、Playwright 自身は CI でだけ起動する
const useLocalApp = !!process.env.CI && process.env.E2E_LOCAL_APP === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // fixture CMS は固定ポートを 1 つの CMS として参照されるため、全 spec で共有して 1 回だけ起動する
  globalSetup: useLocalApp ? './e2e/fixtures/global-setup.ts' : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  webServer: useLocalApp
    ? {
        command:
          'pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3011',
        url: 'http://127.0.0.1:3011',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  use: {
    // CI ではプレビュー URL、local では localhost をデフォルトにする (Requirement 1.1, 1.2)
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    extraHTTPHeaders:
      Object.keys(cfAccessHeaders).length > 0 ? cfAccessHeaders : undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
