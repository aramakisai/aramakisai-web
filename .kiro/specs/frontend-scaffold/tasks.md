# Implementation Plan

- [ ] 1. Next.js プロジェクト基盤のセットアップ
- [ ] 1.1 `frontend/` ディレクトリに Next.js 15 App Router プロジェクトを初期化し、全依存パッケージをインストールする
  - `frontend/package.json` を作成し、dependencies に `next@^15`、`react`、`react-dom`、`@opennextjs/cloudflare`、`@directus/sdk` を記載する
  - devDependencies に `typescript`、`@types/react`、`@types/node`、`@t3-oss/env-nextjs`、`zod`、`wrangler` を記載する
  - scripts に `dev`、`build`、`type-check`（`tsc --noEmit`）、`preview`、`deploy` を定義する
  - `pnpm install` を実行して `pnpm-lock.yaml` を生成し、Git のコミット対象に含める
  - `pnpm install` がエラーなく完了し、`pnpm-lock.yaml` が存在すること
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 5.4_

- [ ] 1.2 TypeScript strict 設定を追加し、型チェックが機能することを確認する
  - `tsconfig.json` を App Router 向けに設定し、`strict: true`、`moduleResolution: "bundler"`、`paths`（`@/*: ["./src/*"]`）を有効にする
  - `pnpm type-check`（`tsc --noEmit`）がクリーンなプロジェクトで exit 0 で完了すること
  - 意図的に型エラーを含むファイルを追加した場合に非ゼロ終了することを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 1.3 ディレクトリ骨格と `.gitignore` を整備する
  - `src/app/`、`src/components/`（`.gitkeep`）、`src/lib/`、`public/` を作成する
  - リポジトリルートの `.gitignore` に `node_modules/`、`.next/`、`.open-next/`、`*.local`、`.env`、`.env.local`、`.env.*.local` を追加する
  - 指定ディレクトリがすべて存在し、`.gitignore` が除外パターンを網羅していること
  - _Requirements: 4.1, 4.3, 4.4, 6.4_

- [ ] 2. Cloudflare Workers 設定と環境変数バリデーションの実装
- [ ] 2.1 (P) OpenNext Cloudflare アダプターの設定ファイルを作成する
  - `next.config.ts` に `initOpenNextCloudflareForDev()` を追加し、ローカル開発で Cloudflare バインディングにアクセスできるようにする
  - `open-next.config.ts` を `defineCloudflareConfig()` で作成する
  - `wrangler.toml` に `name = "aramakisai-web"`、`main = ".open-next/worker.js"`、`compatibility_date = "2024-12-30"`、`compatibility_flags = ["nodejs_compat"]`、`assets.directory = ".open-next/assets"` を設定する
  - `pnpm build` が完了し、`.open-next/` に Workers 互換成果物が生成されること
  - _Requirements: 3.1, 3.2, 3.5_
  - _Boundary: CloudflareRuntimeConfig_

- [ ] 2.2 (P) 環境変数バリデーションと `.env.example` を実装する
  - `src/env.ts` に `@t3-oss/env-nextjs` と `zod` を使用し、`NEXT_PUBLIC_DIRECTUS_URL`（`z.string().url()`）と `NEXT_PUBLIC_SITE_URL`（`z.string().url()`）のスキーマを定義する
  - `runtimeEnv` に手動分割代入（`process.env.NEXT_PUBLIC_DIRECTUS_URL` 等）でバンドラーの NEXT_PUBLIC_ 制約に対応する
  - `.env.example` に全必須変数のキー・プレースホルダー・コメントを記載し、実値は含めない
  - いずれかの変数が未設定のままビルドを実行すると ZodError でビルドが失敗すること
  - _Requirements: 5.3, 6.1, 6.2, 6.3_
  - _Boundary: EnvValidator_

- [ ] 3. Directus SDK クライアントを実装する
  - `src/lib/directus.ts` で `createDirectus(env.NEXT_PUBLIC_DIRECTUS_URL).with(rest())` パターンを使用してクライアントを初期化する
  - クライアントをスキーマ型パラメーター付きの named export（`export const directus`）として公開する
  - Node.js 専用 API（`fs`、`crypto` 等）を使用せず Fetch API のみに依存する
  - `import { directus } from '@/lib/directus'` でコンパイルエラーが発生しないこと
  - _Depends: 2.2_
  - _Requirements: 5.1, 5.2, 5.5_

- [ ] 4. App Shell の実装とビルド統合検証
- [ ] 4.1 Root Layout と placeholder Page を実装する
  - `src/app/layout.tsx` に `<html lang="ja"><body>{children}</body></html>` の Root Layout と `export const metadata` を実装する
  - `src/app/page.tsx` にプレースホルダーテキストのみの page コンポーネントを実装する（スタイル・コンテンツはスコープ外）
  - ランタイムディレクティブ（`export const runtime = 'edge'`）をいずれのファイルにも含めない
  - `pnpm dev` で `http://localhost:3000` にアクセスしてページが表示されること
  - _Requirements: 1.4, 3.4, 4.2_

- [ ] 4.2 ビルド・型チェック・環境変数バリデーションを統合検証する
  - `pnpm type-check` が `src/` 配下の全ファイルを検証し exit 0 で完了すること
  - `pnpm build` が Next.js ビルドと OpenNext 変換を完了し、`.open-next/` に成果物を生成すること
  - `NEXT_PUBLIC_DIRECTUS_URL` を未設定にしてビルドを実行し、ZodError で失敗することを確認する
  - 3 つの検証がすべてパスし、scaffold が CI で動作可能な状態であること
  - _Requirements: 1.3, 2.2, 3.3_
