import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    // 統合テストが祭基本情報のグローバルを書き換えるため、ファイル間の並列実行を避ける
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
