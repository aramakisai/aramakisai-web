# 技術スタック

## アーキテクチャ

Next.js (App Router) を Cloudflare Workers (`@opennextjs/cloudflare`) にデプロイする JAMstack 構成。バックエンドは Payload CMS (Postgres) を K8s 上で運用し、フロントエンドは REST 経由で参照する。Edge Runtime 前提のため Node.js 専用 API は使用不可。シークレットは Infisical 単一プロジェクト (`aramakisai-infra` と共有、`.infisical.json` の `workspaceId`) の `prod`/`staging` 環境で SSoT 管理する。

CMS 本体 (`cms/`) は独立した Next.js アプリで、フロントエンド (`frontend/`) とは別デプロイ単位。CMS は Node ランタイム (standalone) 前提で Edge Runtime 制約を受けない。

## コア技術

- **言語**: TypeScript (strict mode)
- **フレームワーク**: Next.js 15 (App Router) / React 19 (`frontend/`)、Next.js 16 / React 19 + Payload 3 (`cms/`)
- **デプロイ基盤**: Cloudflare Workers + `@opennextjs/cloudflare` (`wrangler versions upload` でプレビュー、`opennextjs-cloudflare deploy` で本番)。CMS は Docker イメージを GHCR へ push し K8s Deployment で運用
- **CMS**: Payload 3 + `@payloadcms/db-postgres` (Postgres 16)、認証は Authentik OIDC を一次経路としローカル認証は緊急用
- **パッケージマネージャ**: pnpm。`frontend/` と `cms/` はそれぞれ独立した `packageManager` ピンを持つ

## 主要ライブラリ

- **frontend**
  - `@t3-oss/env-nextjs` + `zod`: 環境変数のスキーマ検証 (`src/env.ts` に集約し `process.env` を直接参照しない)
  - `src/lib/cms.ts`: CMS クライアント。`cms/` が生成する型 (`frontend/src/cms-types.ts`) からコレクション名で戻り値の型を導出する
  - `vitest` + `@testing-library/react`: コンポーネント/ロジックテスト
  - `tsx`: CI 用スクリプト (`frontend/scripts/*.ts`) の単体実行
- **cms**
  - `@payloadcms/storage-s3`: メディアの S3 互換ストレージ保存 (Directus と衝突しないプレフィックス `payload-uploads`)
  - `@payloadcms/richtext-lexical`: リッチテキストエディタ
  - `sharp`: アップロード時の WebP 変換・用途別サイズ生成

## 開発標準

### 型安全性
両ワークスペースとも `tsconfig.json` で `strict: true`。`any` は避ける。CMS のコレクション/グローバル定義から `payload generate:types` で型を生成し、フロントエンドはそれを取り込んで参照する (`process.env` 同様、型の手書きを避ける)。

### コード品質
ESLint (`next/core-web-vitals`, `next/typescript`) + Prettier (`eslint-config-prettier` でフォーマットルール競合を無効化)。pre-commit で `trailing-whitespace` / `check-yaml` / `check-json` / `mixed-line-ending(LF強制)` / `yamllint` / `gitleaks` / 独自の `check-confidential-info.py` (機密情報混入チェック) を強制。`check-confidential-info.py` は `aramakisai-infra` と同一実装を共有しており、そちら側の規約 (下記) がそのまま適用される。

### 機密情報混入防止の命名規則 (aramakisai-infra と共通)
- **サンプルメールアドレス**: プロジェクト関連は `<username>@aramakisai.invalid`、一般外部ドメインの例示は `<username>@example.invalid` を使う (実在ドメインを装った placeholder を書かない)。
- **実アドレスがコードに必要な場合**: 行末に `# confidential:allow` (Markdown は `<!-- confidential:allow -->`) を付与して意図的な許可であることを明示する。
- **ローカル絶対パス**: コミットに含めない (`check-confidential-info.py` がブロックする)。

### テスト
- コンポーネント/ロジック: 対象ファイルと同階層に `*.test.tsx` / `*.test.ts` (例: `app/page.tsx` ↔ `app/page.test.tsx`)
- **CI ワークフロー自体のテスト**: `frontend/` 直下に `<workflow名>.workflow.test.ts` として YAML 構造をテストする慣習がある (例: `frontend-ci.workflow.test.ts`, `cms-ci.workflow.test.ts`)。ワークフローを追加・変更する際はこのパターンに従う。
- **cms**: `cms/src/**/*.test.ts` にユニットテスト、`*.int.test.ts` に実 DB を使う統合テスト (`pnpm test:int`) を置く。access control のロール別挙動は `cms/src/access/access.int.test.ts` で検証する。

## CMS コンテンツモデル運用の重要な制約

- コレクション/グローバル定義 (`cms/src/collections/`, `cms/src/globals/`) は `cms/src/migrations/*.ts` の適用を経て初めて DB に反映される。`pnpm migrate:create` で差分マイグレーションを生成し `cms/src/migrations/index.ts` に登録する。
- dev push (`payload dev` の自動スキーマ同期) は無効化している。手書きマイグレーションが入れた CHECK 制約・複合 UNIQUE を接続のたびに削除してしまうため。
- 破壊的変更 (フィールド削除・型変更・必須化) は `cms-schema-check.yml` (`cms/scripts/check-schema-changes.ts`) が機械検出し、フロントエンド対応済みであることの確認を要求する。詳細な運用手順は [`docs/cms-operations.md`](../../docs/cms-operations.md) 参照。

## ローカル開発環境

### CMS
```bash
cd cms
pnpm install
pnpm db:up                      # ローカル Postgres (localhost:5433)
pnpm migrate                    # スキーマを適用する。起動前に必ず実行する
infisical run --env=prod -- pnpm dev
```

### フロントエンド
```bash
cd frontend
pnpm install
pnpm dev            # http://localhost:3000
# make dev は起動前に wrangler d1 migrations apply STAMP_DB --local でローカル D1 へマイグレーションを適用する
pnpm type-check
pnpm lint / pnpm format:check
pnpm test
pnpm build
```

### K8s
```bash
make kubectl ARGS="get pods -A"   # kubectl 直実行不可、Infisical 経由 KUBECONFIG 注入
```

## CI/CD (`.github/workflows/`)

- **`frontend-ci.yml`**: `frontend/**` 変更 PR/push で発火。`type-check` → `lint` → `format:check` → `test` → `build` (ダミー env 値でビルド)。PR では `deploy-preview` job が staging env で `wrangler versions upload` を実行し、PR コメントに URL を記録。`main` push では `deploy-prod` job が `opennextjs-cloudflare deploy` (= `wrangler deploy`) で本番反映。fork PR は secrets 不要なジョブのみ実行 (least-privilege)。
  - サイトの Worker は `frontend/wrangler.toml` の `[limits] cpu_ms = 5000` で CPU 課金に上限を持つ。Free プランは cpu_ms 付きのデプロイを API が拒否する (code 100328) ため、3 つのデプロイ (preview の `wrangler versions upload`、dev の `wrangler deploy --env=dev`、prod の `opennextjs-cloudflare deploy`) は `frontend/scripts/deploy-with-cpu-limit-fallback.ts` で包み、100328 で失敗したときだけ `[limits]` を除いた一時設定 (`--config`、元の設定と同じディレクトリ) で 1 回再実行する。再実行時は `::warning::` を出す。それ以外の失敗はそのまま失敗。`env.dev` は limits を継承するため再掲しない。
  - プレビュー URL は `https://<version-hash>-aramakisai-web.<subdomain>.workers.dev` 形式。`wrangler versions upload` は本番トラフィックに影響しないバージョンを作るだけなので、複数 PR が同時に開いていても PR ごとに URL が独立し衝突しない。push のたびに hash は変わるが PR コメント自体は上書き更新される。
  - `aramakisai-web.aramakisai.workers.dev` (hash 無し) は `deploy-prod` が書き込む本番固定 URL であり、上記プレビュー URL とは別物。
- **`frontend-ci-dummy.yml`**: `frontend/**` を触らない PR でのみ発火し、`frontend-ci.yml` と同名の required status check を常に成功報告する。branch protection の path-filter 既知の制約 (対象外 PR ではチェックが永久に "Expected" のまま完了せず admin でもマージ不能になる) の回避策。**`frontend-ci.yml` のジョブ名を変更したら、このダミー側の `name:` も揃える。**
- **`cms-ci.yml`**: `cms/**` 変更 PR/push で発火。`verify` job (type-check → migrate → test → 生成物同期確認 → build) が通った上で、`main` push では `release` job が本体イメージと migration 用イメージの 2 つを GHCR へ push し、`aramakisai-infra` へタグ更新の PR を自動作成する (専用 GitHub App、write 権限)。マージ後 ArgoCD が PreSync Job で `payload migrate` を実行してから Deployment を更新する。
- **`cms-schema-check.yml`**: `cms/src/collections/**` / `cms/src/globals/**` 変更 PR で base/head のコレクション定義を比較し、フィールド削除・型変更・必須化を機械検出する。

## 重要な技術的判断

- **Edge Runtime 制約 (frontend のみ)**: `@opennextjs/cloudflare` の制約上 Node.js 専用 API 不可。ファイルシステムアクセスや Node ネイティブモジュールに依存する実装は避ける。CMS (`cms/`) は Node ランタイムで動くためこの制約を受けない。
- **.env 禁止 (guard stub パターン, aramakisai-infra 準拠)**: シークレットは Infisical 経由 (`infisical run --env=<env> -- <cmd>`) で注入する。`.env`/`.env.local` は実際の環境変数ファイルではなく、`echo "DO NOT USE THIS FILE. USE Infisical INSTEAD"; exit 1` という**意図的に実行失敗する Git 管理下のダミースクリプト**であり、誤って本物の `.env` を作成・使用することを防ぐ役割を持つ。**上書きして実シークレットを書き込まないこと**。`.gitignore` は `.env.*.local`/`*.local` のみ除外しており、この 2 ファイル自体は追跡対象。
- **スタンプ検証の秘密値 `STAMP_SIGNING_SECRET`**: CI のデプロイ時に `wrangler` の `--secrets-file` で Workers に渡す (プレビューと dev は Infisical `staging`、本番は `prod` から作成。手作業の `wrangler secret put` は使わない)。正本は Infisical `prod` (本番用) と `staging` (本番とは別のテスト用)。検証 API が実行時に `getCloudflareContext().env` から読む。`make dev` は起動前に Infisical `staging` からこの 1 つだけを取得して export し、`CLOUDFLARE_INCLUDE_PROCESS_ENV=true` を付けて起動する (起動コマンド自体は `infisical run` で包まない)。取得に失敗しても起動は続き、その場合ローカルではスタンプが付かない。
- **スタンプの記録 (D1) と管理者ログイン**: 記録は Cloudflare D1 (`STAMP_DB`)。本番は `aramakisai-stamps`、dev と PR プレビューは `aramakisai-stamps-dev` で、`wrangler.toml` のトップレベルと `[env.dev]` にそれぞれ `database_id` を書く。PR プレビューは本番 Worker のバージョンなので、`scripts/write-preview-wrangler-config.ts` が書く一時設定 (`.wrangler.preview.toml`) で `STAMP_DB` を dev の D1 に差し替えて上げる。マイグレーション (`frontend/migrations/`) は各デプロイの直前に `wrangler d1 migrations apply STAMP_DB --remote` で適用する (dev とプレビューは `--env=dev`、本番は素)。`--secrets-file` の JSON には `STAMP_ENV` (`prod`/`dev`/`preview`。`wrangler.toml` の `[vars]` には置かない) を入れ、本番と dev には Zitadel アプリ `aramakisai-web-staff` の `STAFF_OIDC_CLIENT_SECRET` も入れる。後者の正本は Infisical `prod` のみで、dev のデプロイもそこから読む。
- **緊急地震速報のリレーの秘密値 `SIGNAGE_QUAKE_TOKEN`・`DISCORD_QUAKE_WEBHOOK_URL`**: `STAMP_SIGNING_SECRET` と同じく、`deploy-prod` が Infisical `prod` から `--secrets-file` で Workers (`aramakisai-signage-quake`) に渡す (リレーに差分があるときだけ。手作業の `wrangler secret put` は使わない)。`SIGNAGE_QUAKE_TOKEN` は CMS の環境変数にも同じ値を置く。`make quake-dev` / `make cms-worktree` は Infisical `prod` から取得して注入する。
- **駐車場カメラの秘密値 `GEMINI_API_KEY`・`PARKING_CAMERA_DISCORD_WEBHOOK_URL`**: CMS の環境変数。本番は `cms-secrets` の ExternalSecret 経由で、前者は Infisical `prod` の `GEMINI_API_KEY`、後者は既存の `DISCORD_OPS_WEBHOOK_URL` を参照する。未設定でも CMS は起動し、判定・停止通知だけが動かない。判定間隔 `PARKING_JUDGE_WINDOW_SECONDS` (既定 300) は秘密ではない。
- **K8s アクセスは `make kubectl` 経由のみ**: ローカルから kubeconfig 未設定で直接到達不可。
- **CMS コンテンツモデルの変更ゲート**: 破壊的変更は `cms-schema-check.yml` が機械的に検出する。承認された破壊的変更のバイパスは repo admin による branch protection override が前提 (ラベル/コメントでの自動バイパス機構はあえて未実装)。

---
_Document standards and patterns, not every dependency_
