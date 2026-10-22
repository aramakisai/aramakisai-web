import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const config = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'node_modules/**',
      'next-env.d.ts',
      'workers/worker-configuration.d.ts',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  prettier,
  {
    // eslint-config-next 16 が新規に有効化した React Compiler 系ルール。
    // 既存コードの挙動変更を伴う書き換えが必要なため、アップグレードとは切り離して無効化している
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
    },
  },
];

export default config;
