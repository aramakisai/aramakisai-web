# 技術スタック

## アーキテクチャ

Next.js (App Router) を Cloudflare Workers (`@opennextjs/cloudflare`、旧 `@cloudflare/next-on-pages` の後継) にデプロイする JAMstack 構成。バックエンドは Directus 12 (Headless CMS, Postgres) を K8s 上で運用し、フロントエンドは REST 経由で参照する。Edge Runtime 前提のため Node.js 専用 API は使用不可。シークレットは Infisical 単一プロジェクト (`aramakisai-infra` と共有、`.infisical.json` の `workspaceId`) の `prod`/`staging` 環境で SSoT 管理する。

## コア技術

- **言語**: TypeScript (strict mode)
- **フレームワーク**: Next.js 15 (App Router) / React 19
- **デプロイ基盤**: Cloudflare Workers + `@opennextjs/cloudflare` (`wrangler versions upload` でプレビュー、`opennextjs-cloudflare deploy` で本番)
- **CMS**: Directus 12.1.1 + Postgres 16 (`@directus/sdk` でクライアント接続)
- **パッケージマネージャ**: pnpm (`packageManager` ピンは `frontend/package.json` 側にあり、リポジトリルートではない)

## 主要ライブラリ

- `@t3-oss/env-nextjs` + `zod`: 環境変数のスキーマ検証 (`src/env.ts` に集約し `process.env` を直接参照しない)
- `@directus/sdk`: Directus クライアント (`src/lib/directus.ts` で `createDirectus().with(rest())` として初期化)
- `vitest` + `@testing-library/react`: コンポーネント/ロジックテスト
- `tsx`: CI 用スクリプト (`frontend/scripts/*.ts`) の単体実行

## 開発標準

### 型安全性
`tsconfig.json` で `strict: true`。`any` は避け、Directus のスキーマ型を `Schema` として明示する。

### コード品質
ESLint (`next/core-web-vitals`, `next/typescript`) + Prettier (`eslint-config-prettier` でフォーマットルール競合を無効化)。pre-commit で `trailing-whitespace` / `check-yaml` / `check-json` / `mixed-line-ending(LF強制)` / `yamllint` / `gitleaks` / 独自の `check-confidential-info.py` (機密情報混入チェック) を強制。`check-confidential-info.py` は `aramakisai-infra` と同一実装を共有しており、そちら側の規約 (下記) がそのまま適用される。

### 機密情報混入防止の命名規則 (aramakisai-infra と共通)
- **サンプルメールアドレス**: プロジェクト関連は `<username>@aramakisai.invalid`、一般外部ドメインの例示は `<username>@example.invalid` を使う (実在ドメインを装った placeholder を書かない)。
- **実アドレスがコードに必要な場合**: 行末に `# confidential:allow` (Markdown は `<!-- confidential:allow -->`) を付与して意図的な許可であることを明示する。
- **ローカル絶対パス**: コミットに含めない (`check-confidential-info.py` がブロックする)。

### テスト
- コンポーネント/ロジック: 対象ファイルと同階層に `*.test.tsx` / `*.test.ts` (例: `app/page.tsx` ↔ `app/page.test.tsx`)
- **CI ワークフロー自体のテスト**: `frontend/` 直下に `<workflow名>.workflow.test.ts` として YAML 構造をテストする慣習がある (例: `frontend-ci.workflow.test.ts`, `additive-schema-check.workflow.test.ts`)。ワークフローを追加・変更する際はこのパターンに従う。
- `frontend/pipeline-integration.test.ts` / `frontend/generated-manifests.test.ts` のように、CI/GitOps 連携の統合的な期待値を検証するテストも frontend 直下に置かれる。

## Directus スキーマ運用の重要な制約

- `directus schema snapshot`/`apply` は **CHECK 制約・部分インデックス・複合 UNIQUE (条件付き)・RBAC (policies/roles/permissions) を表現できない**。これらは `directus/migrations/*.js` (knex ベースの `up`/`down`) で個別に管理する。
- Directus 12 の RBAC は `directus_roles` 単体では完結しない: `directus_policies` (実権限定義) → `directus_access` (role↔policy 紐付け) → `directus_permissions` (`policy` カラム参照、`role` カラムは廃止) という構成。旧 Directus の `admin_access`/`app_access` は role ではなく policy 側の属性。
- migration は再実行安全性 (`onConflict().ignore()` や delete-then-insert) を意識して書く。

## ローカル開発環境

### Directus
```bash
cd directus
docker compose up   # Postgres 16 + Directus 12.1.1 (localhost:8055, admin@local.dev/admin) # confidential:allow
# ./migrations が Directus コンテナに /directus/extensions/migrations としてマウントされる
```

### フロントエンド
```bash
cd frontend
pnpm install
pnpm dev            # http://localhost:3000
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

4 本のワークフローが役割分担している。変更時はどのワークフローの責務かを明確にすること。

- **`frontend-ci.yml`**: `frontend/**` 変更 PR/push で発火。`type-check` → `lint` → `format:check` → `test` → `build` (ダミー env 値でビルド)。PR では Cloudflare Workers プレビューをデプロイし PR コメントに URL を記録、`main` push では本番デプロイ。fork PR は secrets 不要なジョブのみ実行 (least-privilege)。
- **`frontend-ci-dummy.yml`**: `frontend/**` を触らない PR でのみ発火し、`frontend-ci.yml` と同名の required status check を常に成功報告する。branch protection の path-filter 既知の制約 (対象外 PR ではチェックが永久に "Expected" のまま完了せず admin でもマージ不能になる) の回避策。**`frontend-ci.yml` のジョブ名を変更したら、このダミー側の `name:` も揃える。**
- **`additive-schema-check.yml`**: `directus/schema/snapshot.yaml` 変更 PR で base/head を比較し、collection/field 削除・型変更・`is_nullable: true→false` を機械検出 (`frontend/scripts/check-additive-schema.ts`)。additive-only ルールの自動強制。
- **`directus-schema-sync.yml`**: `main` push (`snapshot.yaml`/`migrations/**` 変更時) で `aramakisai-infra` リポジトリに ConfigMap を生成し `directus-schema-*` ブランチで PR を自動作成 (専用 GitHub App、write 権限)。マージ後 ArgoCD が `directus database migrate:latest` → `directus schema apply --yes` を実行。

### infra 側との連携 (aramakisai-infra 参照)

- **staging 事前検証ゲート**: infra 側 `scripts/check_staging_gate.py` が `directus-schema-*` ブランチの PR に対する必須 status check として動作し、PR 本文の「マージ前チェックリスト」が全てチェック済みになるまでマージをブロックする。このリポジトリの `directus-schema-sync.yml` が生成する PR 本文フォーマット (チェックリストの Markdown 構文) を変更する場合、infra 側のこのゲートが正しくパースできるか確認すること。
- **staging ephemeral 検証**: infra 側 `gitops/apps/staging/directus-schema-preview-appset.yaml` (ArgoCD `ApplicationSet`, `pullRequest` generator) が open な `directus-schema-*` PR ごとに `directus-schema-preview-<PR番号>` Application を自動生成し、PR ブランチの `snapshot.yaml`/`migrations` を実 staging DB に検証適用する。PR チェックリストの「ArgoCD Application が Synced/Healthy」項目はこれを指す。PR 生成用 GitHub App は上記 push 用とは別の read-only App (`ARGOCD_APPLICATIONSET_GITHUB_APP_*`)。
- **additive-only の最終防衛**: このリポジトリの `additive-schema-check.yml` が機械検出する一方、infra 側の staging ephemeral 適用も実質的な人間向け二次検証になっている。

## 重要な技術的判断

- **Edge Runtime 制約**: `@opennextjs/cloudflare` の制約上 Node.js 専用 API 不可。ファイルシステムアクセスや Node ネイティブモジュールに依存する実装は避ける。
- **.env 禁止 (guard stub パターン, aramakisai-infra 準拠)**: シークレットは Infisical 経由 (`infisical run --env=<env> -- <cmd>`) で注入する。`.env`/`.env.local` は実際の環境変数ファイルではなく、`echo "DO NOT USE THIS FILE. USE Infisical INSTEAD"; exit 1` という**意図的に実行失敗する Git 管理下のダミースクリプト**であり、誤って本物の `.env` を作成・使用することを防ぐ役割を持つ。**上書きして実シークレットを書き込まないこと**。`.gitignore` は `.env.*.local`/`*.local` のみ除外しており、この 2 ファイル自体は追跡対象。
- **K8s アクセスは `make kubectl` 経由のみ**: ローカルから kubeconfig 未設定で直接到達不可。
- **Directus スキーマは additive-only**: 破壊的変更 (カラム削除・型変更) はフロントエンドが安定稼働するまで禁止。`additive-schema-check.yml` が機械的に検出するが、承認された破壊的変更のバイパスは repo admin による branch protection override が前提 (ラベル/コメントでの自動バイパス機構はあえて未実装)。
- **spec の Boundary Commitments 規約**: `.kiro/specs/*/design.md` は "This Spec Owns / Out of Boundary / Allowed Dependencies / Revalidation Triggers" を明記する規約。他 spec の所有領域に触れる変更は該当 spec の Revalidation Triggers を確認する。

---
_Document standards and patterns, not every dependency_
