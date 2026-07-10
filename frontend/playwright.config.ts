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

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
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
