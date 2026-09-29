import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Node 22+ の実験的グローバル localStorage (--webstorage、既定で有効) が
// jsdom 環境の window.localStorage を未定義のまま上書きするため、テスト実行の
// worker に渡す前に無効化して jsdom 側の実装を使わせる
process.env.NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  '--no-experimental-webstorage',
]
  .filter(Boolean)
  .join(' ');

export default defineConfig({
  plugins: [react()],
  test: {
    // 大半のテストは DOM を使わない (lib/scripts の純粋関数)。jsdom 起動コストが
    // 支配的なため既定は node にし、DOM が要るファイルだけ jsdom に切り替える
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
      ['src/lib/use-focus-trap.test.ts', 'jsdom'],
      ['src/lib/use-motion-preference.test.ts', 'jsdom'],
      ['src/lib/use-now.test.ts', 'jsdom'],
      ['src/lib/background-shapes/obstacles.test.ts', 'jsdom'],
    ],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ は Playwright (`pnpm test:e2e`) 専用。vitest (`pnpm test`) とは独立させる
    exclude: ['node_modules/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
