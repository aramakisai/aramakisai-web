# プロジェクト構造

## 構成方針

リポジトリ直下でフロントエンド (`frontend/`) と Directus スキーマ (`directus/`) を分離管理するモノレポ構成。`frontend/` 内は Next.js App Router のレイヤー構成 (app / components / lib) だが、CI/GitOps 連携を検証するテスト・スクリプトも `frontend/` 直下 (src 外) に同居する。

**姉妹リポジトリ `aramakisai-infra`**: K3s/ArgoCD/Terraform 等のインフラ・GitOps 定義はこちらが所有し、`aramakisai-web` は関与しない。`directus/schema/snapshot.yaml`・`directus/migrations/**` の変更だけが `directus-schema-sync.yml` 経由で `aramakisai-infra` に PR として伝播する。両リポジトリは Infisical プロジェクトを共有し、`aramakisai-web` のシークレット命名・pre-commit 構成 (`check-confidential-info.py` 等) は `aramakisai-infra` の規約に合わせる。

## ディレクトリパターン

### App Router
**場所**: `frontend/src/app/`
**用途**: ルーティングとページコンポーネント。ページごとに `page.tsx` を配置し、対応するテストを同階層に `page.test.tsx` として置く。
**例**: `app/page.tsx` + `app/page.test.tsx`

### コンポーネント
**場所**: `frontend/src/components/`
**用途**: 再利用可能な UI コンポーネント (現状未実装、ページ実装が進むにつれて追加される想定)

### ライブラリ / クライアント初期化
**場所**: `frontend/src/lib/`
**用途**: 外部サービスクライアントの初期化などアプリ全体で共有するロジック
**例**: `lib/directus.ts` で Directus SDK クライアントを生成

### CI/CD 用スクリプト・テスト
**場所**: `frontend/scripts/` (実行スクリプト), `frontend/*.workflow.test.ts` (ワークフロー構造テスト), `frontend/*.test.ts` (パイプライン統合テスト)
**用途**: `.github/workflows/*.yml` の挙動をコード側で担保する。ワークフロー本体は YAML で薄く保ち、ロジックは TypeScript + テストで検証する方針。
**例**: `scripts/check-additive-schema.ts` (+ `scripts/check-additive-schema.test.ts`) を `additive-schema-check.yml` から `tsx` 経由で呼び出す。`frontend-ci.workflow.test.ts` が `frontend-ci.yml` の構造を検証。

### Directus スキーマ
**場所**: `directus/schema/snapshot.yaml`
**用途**: `directus schema snapshot` で書き出したスキーマ定義。Git 管理し K8s Job で本番に apply される。**CHECK 制約・RBAC 等は表現できない** ([[tech]] 参照)。
**場所**: `directus/migrations/`
**用途**: スキーマスナップショットで表現できない CHECK 制約・複合 UNIQUE・RBAC (policies/roles/permissions) を knex ベースの custom migration で管理。ファイル名は `YYYYMMDD{A,B,C...}-説明.js` の連番 + サフィックス形式。
**場所**: `directus/docker-compose.yaml`
**用途**: ローカル Directus 開発環境 (Postgres 16 + Directus 12.1.1)。`migrations/` をコンテナにマウントして動作確認する。

### リポジトリ横断のガバナンススクリプト
**場所**: ルート直下 `scripts/`
**用途**: pre-commit フックから呼ばれる、`frontend/`・`directus/` どちらにも属さないリポジトリ全体のチェック (例: `check-confidential-info.py`)。`frontend/scripts/` (CI ロジック) とは別物。

## 命名規則

- **ファイル**: コンポーネントファイルは PascalCase を想定、Next.js 規約ファイル (`page.tsx`, `layout.tsx`) は小文字固定
- **テストファイル**: `対象ファイル名.test.ts(x)`、ワークフローテストは `<workflow名>.workflow.test.ts`
- **Directus migration**: `YYYYMMDD{連番サフィックス}-内容.js` (例: `20260701C-rbac-roles.js`)
- **環境変数**: `NEXT_PUBLIC_` プレフィックスはクライアント公開用、`src/env.ts` の zod スキーマに追加してから使用する

## インポート方針

```typescript
import { env } from '@/env';           // 絶対パス (@/ = frontend/src/)
import { directus } from '@/lib/directus';
```

**パスエイリアス**:
- `@/`: `frontend/src/` にマップ

## コード組織原則

- 環境変数は `process.env` を直接参照せず、必ず `src/env.ts` の `env` オブジェクト経由でアクセスする (型安全性とランタイム検証のため)
- Directus クライアントは `src/lib/directus.ts` の単一インスタンスを共有する
- CI ロジックはワークフロー YAML に直接書かず `frontend/scripts/*.ts` に切り出し、対応する `*.test.ts` で検証する
- `.kiro/specs/{feature}/design.md` は "This Spec Owns / Out of Boundary / Allowed Dependencies" で責務境界を明示する規約。新機能追加時は既存 spec の Out of Boundary/Owns と衝突しないか確認する
- `.kiro/specs/` に機能ごとの仕様書 (requirements / design / tasks) を配置し、Spec-Driven Development のフローに従う

## プロジェクトメモリ同期プロセス (aramakisai-infra 準拠)

`aramakisai-infra` の運用原則: コード変更のみでタスクを完了とせず、関連ドキュメントを自律的に同期する。`aramakisai-web` でも同じ原則を適用する。

- **新規 Directus collection/RBAC ロールの追加**: [[product]] のドメインモデル/RBAC セクションに追加。
- **新規 GitHub Actions ワークフローの追加・責務変更**: [[tech]] の CI/CD セクションに追加、`aramakisai-infra` 側の連携前提 (checklist フォーマット・ApplicationSet 等) に影響しないか確認。
- **新規シークレット/環境変数の追加**: [[tech]] に変数名を追記 (値は含めない)。`NEXT_PUBLIC_*` は `src/env.ts` の zod スキーマ更新とセットで行う。
- **spec 完了時 (`phase: completed` 前)**: steering との差分がないか検証・転記する。

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
