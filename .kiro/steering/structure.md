# プロジェクト構造

## 構成方針

リポジトリ直下でフロントエンド (`frontend/`) と CMS (`cms/`) を分離管理するモノレポ構成。両方とも独立した Next.js アプリで、それぞれ別のワークスペース (`package.json` / `pnpm-lock.yaml`) を持つ。`frontend/` 内は App Router のレイヤー構成 (app / components / lib) だが、CI/GitOps 連携を検証するテスト・スクリプトも `frontend/` 直下 (src 外) に同居する。

**姉妹リポジトリ `aramakisai-infra`**: K3s/ArgoCD/Terraform 等のインフラ・GitOps 定義はこちらが所有し、`aramakisai-web` は関与しない。`cms-ci.yml` の `release` job が本体・migration の 2 イメージを GHCR へ push した上で `aramakisai-infra` へタグ更新 PR を作る形で連携する。両リポジトリは Infisical プロジェクトを共有し、`aramakisai-web` のシークレット命名・pre-commit 構成 (`check-confidential-info.py` 等) は `aramakisai-infra` の規約に合わせる。

## ディレクトリパターン

### App Router (frontend)
**場所**: `frontend/src/app/`
**用途**: ルーティングとページコンポーネント。ページごとに `page.tsx` を配置し、対応するテストを同階層に `page.test.tsx` として置く。
**例**: `app/page.tsx` + `app/page.test.tsx`

### コンポーネント (frontend)
**場所**: `frontend/src/components/`
**用途**: 再利用可能な UI コンポーネント

### ライブラリ / クライアント初期化 (frontend)
**場所**: `frontend/src/lib/`
**用途**: 外部サービスクライアントの初期化などアプリ全体で共有するロジック
**例**: `lib/cms.ts` で CMS クライアントを生成、`lib/cms-asset-url.ts` で表示幅に応じたアセット URL を組み立てる

### CI/CD 用スクリプト・テスト (frontend)
**場所**: `frontend/scripts/` (実行スクリプト), `frontend/*.workflow.test.ts` (ワークフロー構造テスト)
**用途**: `.github/workflows/*.yml` の挙動をコード側で担保する。ワークフロー本体は YAML で薄く保ち、ロジックは TypeScript + テストで検証する方針。
**例**: `frontend-ci.workflow.test.ts` が `frontend-ci.yml` の構造を検証。`cms-ci.workflow.test.ts` / `cms-schema-check.workflow.test.ts` が CMS 側ワークフローの構造を検証。

### コレクション / グローバル定義 (cms)
**場所**: `cms/src/collections/`, `cms/src/globals/`
**用途**: Payload のコンテンツモデル定義。1 ファイル 1 コレクション/グローバル。コード変更 → `pnpm migrate:create` でマイグレーション生成、が唯一の変更経路 ([[tech]] 参照)。
**例**: `collections/student-exhibitions.ts` (所有者フィールドと自動設定 hook を持つ)、`globals/page-home.ts` (単一レコード)

### 認可 (cms)
**場所**: `cms/src/access/`
**用途**: ロール定義 (`roles.ts`)、コレクション横断の access control ロジック (`policy.ts`)、Payload の `access` フィールドへの結線 (`payload-access.ts`)。既定拒否・許可した組み合わせのみ通す方針。
**場所**: `cms/src/auth/`
**用途**: Authentik OIDC 連携 (`authentik-endpoints.ts`) と IdP グループ → ロールの静的写像 (`role-mapping.ts`)。

### マイグレーション (cms)
**場所**: `cms/src/migrations/`
**用途**: コレクション/グローバル定義の変更を DB へ反映する Payload マイグレーション (`up`/`down`)。`index.ts` に登録されたものが `pnpm migrate` で順に適用される。dev push は無効化してあるため、定義変更は必ずこの経路を通す。

### リポジトリ横断のガバナンススクリプト
**場所**: ルート直下 `scripts/`
**用途**: pre-commit フックから呼ばれる、`frontend/`・`cms/` どちらにも属さないリポジトリ全体のチェック (例: `check-confidential-info.py`)。`frontend/scripts/` (CI ロジック) とは別物。

### 退避データ
**場所**: `cms/seed/` (git 管理外)
**用途**: 移行時に旧 CMS から取得したレコード・ファイルの退避先。`cms/scripts/seed-migration.ts` が読み込む。

## 命名規則

- **ファイル**: コンポーネントファイルは PascalCase を想定、Next.js 規約ファイル (`page.tsx`, `layout.tsx`) は小文字固定
- **テストファイル**: `対象ファイル名.test.ts(x)`、ワークフローテストは `<workflow名>.workflow.test.ts`、cms の DB 統合テストは `対象ファイル名.int.test.ts`
- **環境変数**: `NEXT_PUBLIC_` プレフィックスはクライアント公開用、`frontend/src/env.ts` の zod スキーマに追加してから使用する

## インポート方針

```typescript
// frontend
import { env } from '@/env';           // 絶対パス (@/ = frontend/src/)
import { getCms } from '@/lib/cms';
```

**パスエイリアス**:
- `@/`: `frontend/src/` にマップ (frontend)、`cms/src/` にマップ (cms)

## コード組織原則

- 環境変数は `process.env` を直接参照せず、必ず `src/env.ts` の `env` オブジェクト経由でアクセスする (型安全性とランタイム検証のため)
- CMS クライアントは `frontend/src/lib/cms.ts` の単一インスタンスを共有する
- CI ロジックはワークフロー YAML に直接書かず `frontend/scripts/*.ts` / `cms/scripts/*.ts` に切り出し、対応する `*.test.ts` で検証する
- コンテンツモデルの access control ロジックは `cms/src/access/policy.ts` に集約し、各コレクション定義は `payload-access.ts` 経由で参照する (ロール判定の重複実装を避ける)
- `.kiro/specs/{feature}/design.md` は "This Spec Owns / Out of Boundary / Allowed Dependencies" で責務境界を明示する規約。新機能追加時は既存 spec の Out of Boundary/Owns と衝突しないか確認する
- `.kiro/specs/` に機能ごとの仕様書 (requirements / design / tasks) を配置し、Spec-Driven Development のフローに従う

## プロジェクトメモリ同期プロセス (aramakisai-infra 準拠)

`aramakisai-infra` の運用原則: コード変更のみでタスクを完了とせず、関連ドキュメントを自律的に同期する。`aramakisai-web` でも同じ原則を適用する。

- **新規 collection/RBAC ロールの追加**: [[product]] のドメインモデル/RBAC セクションに追加。
- **新規 GitHub Actions ワークフローの追加・責務変更**: [[tech]] の CI/CD セクションに追加、`aramakisai-infra` 側の連携前提に影響しないか確認。
- **新規シークレット/環境変数の追加**: [[tech]] に変数名を追記 (値は含めない)。`NEXT_PUBLIC_*` は `frontend/src/env.ts` の zod スキーマ更新とセットで行う。
- **spec 完了時 (`phase: completed` 前)**: steering との差分がないか検証・転記する。

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
