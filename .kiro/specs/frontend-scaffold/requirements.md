# Requirements Document

## Project Description (Input)
荒牧祭ホームページのフロントエンド (Next.js + @cloudflare/next-on-pages) をフルスクラッチで構築する。
Directus をヘッドレス CMS として使用し、Cloudflare Pages にデプロイする。
cicd-pipeline spec の前提となる基盤であり、ビルド・型チェック・デプロイが通る最小構成を確立する。

## Introduction

本仕様は `aramakisai-web` リポジトリの Next.js フロントエンドプロジェクトをゼロから構築するものである。
アプリケーションコード (ページ実装・デザイン) は対象外とし、CI/CD が機能する最小限の骨格を確立することが目的。
`cicd-pipeline` spec はこの spec の完了を前提とする。

## Boundary Context

- **In scope**:
  - `frontend/` ディレクトリ以下の Next.js プロジェクト一式 (App Router)
  - `@cloudflare/next-on-pages` および Edge Runtime 対応設定
  - TypeScript 設定・`package.json` スクリプト
  - `wrangler.toml` (Cloudflare Pages ビルド設定)
  - Directus クライアント初期化 (`src/lib/directus.ts`)
  - 環境変数の型定義と読み取り方針
  - `.gitignore` / リポジトリ直下の構成ファイル
- **Out of scope**:
  - ページコンポーネント実装・デザイン・コンテンツ取得ロジック
  - Directus スキーマ定義
  - GitHub Actions ワークフロー (cicd-pipeline spec で扱う)
  - Cloudflare Pages プロジェクトの作成・連携 (cicd-pipeline spec で扱う)
- **Adjacent expectations**:
  - `@cloudflare/next-on-pages` の Edge Runtime 制約上、Node.js 専用 API (`fs`, `path`, `crypto` 等) は使用不可
  - 環境変数は `.env` ファイル禁止。`NEXT_PUBLIC_*` は Cloudflare Pages ダッシュボードで管理
  - Directus エンドポイントは `NEXT_PUBLIC_DIRECTUS_URL` で切り替え (preview: stg-api / prod: api)

---

## Requirements

### Requirement 1: Next.js プロジェクト初期化

**Objective:** 開発者として、`frontend/` ディレクトリに Next.js App Router プロジェクトが存在し、ローカルで開発サーバーが起動できることを望む。

#### Acceptance Criteria

1. The frontend scaffold shall create a `frontend/` directory at the repository root containing a valid Next.js project with App Router enabled.
2. The `frontend/package.json` shall specify Next.js `>=14`, TypeScript, and `@cloudflare/next-on-pages` as dependencies.
3. When `pnpm install` is executed in `frontend/`, the CI Pipeline shall install all dependencies without errors.
4. When `pnpm dev` is executed in `frontend/`, the development server shall start at `http://localhost:3000` without errors.
5. The `frontend/` directory shall use `pnpm` as the package manager; a `pnpm-lock.yaml` shall be committed to the repository.

---

### Requirement 2: TypeScript 設定

**Objective:** 開発者として、型チェックが CI で実行できるよう TypeScript が正しく設定されていることを望む。

#### Acceptance Criteria

1. The frontend scaffold shall include a `frontend/tsconfig.json` configured for Next.js App Router with strict mode enabled.
2. When `pnpm type-check` is executed in `frontend/`, the TypeScript compiler shall check all files under `src/` and exit with code 0 on a clean scaffold.
3. The `pnpm type-check` script shall be defined in `frontend/package.json` as `tsc --noEmit`.
4. If a type error exists anywhere under `frontend/src/`, the type-check command shall exit with a non-zero code.

---

### Requirement 3: Cloudflare Pages (next-on-pages) 対応

**Objective:** 開発者として、`@cloudflare/next-on-pages` を通じた Edge Runtime ビルドが成功し、Cloudflare Pages にデプロイ可能な成果物が生成されることを望む。

#### Acceptance Criteria

1. The frontend scaffold shall include `@cloudflare/next-on-pages` and configure `next.config.ts` to use the `setupDevPlatform` helper for local development.
2. The `frontend/package.json` shall define a `build` script that runs `next build` with the `@cloudflare/next-on-pages` transform, producing output compatible with Cloudflare Pages.
3. When `pnpm build` is executed in `frontend/`, the build shall complete without errors on the clean scaffold.
4. All files under `frontend/src/` shall use the Edge Runtime (`export const runtime = 'edge'`) or omit the runtime directive (defaulting to Edge in next-on-pages context); no route shall use `runtime = 'nodejs'`.
5. The scaffold shall include a `wrangler.toml` in the `frontend/` directory specifying the Pages project name (`aramakisai-web`), compatibility date, and `nodejs_compat` flag.

---

### Requirement 4: ディレクトリ構成

**Objective:** 開発者として、CLAUDE.md に記載された構成規約に沿ったディレクトリ骨格が存在することを望む。後続の実装者が迷わず配置できる状態にする。

#### Acceptance Criteria

1. The frontend scaffold shall create the following directories: `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/`.
2. The `frontend/src/app/` directory shall contain a minimal `layout.tsx` and `page.tsx` that render without errors (placeholder content acceptable).
3. The `frontend/public/` directory shall exist for static assets.
4. The repository root shall contain a `.gitignore` that excludes `node_modules/`, `.next/`, `.vercel/`, and `*.local`.

---

### Requirement 5: Directus クライアント初期化

**Objective:** 開発者として、`src/lib/directus.ts` に Directus SDK クライアントの初期化コードが存在し、後続のページ実装がそれをインポートして使えることを望む。

#### Acceptance Criteria

1. The frontend scaffold shall create `frontend/src/lib/directus.ts` that initializes a Directus SDK client using `NEXT_PUBLIC_DIRECTUS_URL` as the base URL.
2. The Directus client shall be typed and exported as a named export for use in Server Components and API routes.
3. If `NEXT_PUBLIC_DIRECTUS_URL` is undefined at build time, the build shall fail with a descriptive error rather than silently using an empty string.
4. The Directus SDK package (`@directus/sdk`) shall be listed as a dependency in `frontend/package.json`.
5. The Directus client initialization shall not use any Node.js-only APIs, remaining compatible with the Edge Runtime.

---

### Requirement 6: 環境変数定義

**Objective:** 開発者として、必要な環境変数が明示的に定義・検証されており、未設定のまま動作することがないことを望む。

#### Acceptance Criteria

1. The frontend scaffold shall define all required `NEXT_PUBLIC_*` environment variables in a `frontend/src/env.ts` (or equivalent) file that validates their presence at startup.
2. The required variables shall include at minimum: `NEXT_PUBLIC_DIRECTUS_URL`, `NEXT_PUBLIC_SITE_URL`.
3. The frontend scaffold shall include a `frontend/.env.example` file listing all required environment variable keys with placeholder values and comments; actual values shall never be committed.
4. The `.env.example` shall be committed to the repository; `.env`, `.env.local`, and `.env.*.local` files shall be excluded via `.gitignore`.
