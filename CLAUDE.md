プロジェクト概要

荒牧祭実行委員会のフロントエンド (Next.js, `frontend/`) と Payload CMS バックエンド (`cms/`) を管理するモノレポ。
FE は OpenNext (@opennextjs/cloudflare) 経由で Cloudflare Workers にデプロイ、CMS は Postgres を伴い K8s 上で Payload として稼働し、FE は REST 経由で参照する。

コマンド

bash# フロントエンド ローカル開発
cd frontend
pnpm install
pnpm dev           # http://localhost:3000

# 型チェック
pnpm type-check

# ビルド確認
pnpm build

bash# CMS ローカル開発
cd cms
pnpm install
pnpm db:up                      # ローカル Postgres (localhost:5433)
pnpm migrate                    # スキーマを適用する。起動前に必ず実行する
infisical run --env=prod -- pnpm dev

# コレクション/グローバル定義 (src/collections, src/globals) を変更した場合
pnpm migrate:create <name>      # 差分マイグレーションを生成し src/migrations/index.ts に登録
pnpm generate:types             # 型を再生成 (frontend/src/cms-types.ts も同時に更新)

bash# K8s クラスタ状態確認
# kubectl を直接実行してはならない (kubeconfig 未設定でネットワーク到達不可)。
# 必ず make kubectl 経由で実行すること (Infisical から KUBECONFIG を注入)
make kubectl ARGS="get pods -A"

環境変数

NEXT_PUBLIC_CMS_URL         CMS (Payload) の API エンドポイント
                            prod:  https://cms.aramakisai.com
                            local: http://localhost:3000 (cms/ を別ポートで動かす場合は読み替え)

NEXT_PUBLIC_SITE_URL        サイト URL

NEXT_PUBLIC_GA_MEASUREMENT_ID  Google Analytics 4 測定ID (G-XXXXXXXXXX)
                            本番 (NODE_ENV=production) のみ読み込み。未設定なら GA タグ自体を出さない。
                            staging は Cloudflare Access 保護下のため通常は未設定でよい。

本番/staging の値は Infisical で管理する (`--env=prod` / `--env=staging`)。Pages ダッシュボードでの設定ではない。
CMS (`cms/`) 側の環境変数一覧は `docs/cms-operations.md` 参照。

デプロイフロー

- **`frontend-ci.yml`** (`frontend/**` 変更時発火): PR で build 等を検証 (失敗したらマージ不可)。PR ごとに一意な Cloudflare Workers プレビュー URL が発行され PR コメントに記録される。main merge で本番デプロイ。詳細は `.kiro/steering/tech.md` 参照。
- **`cms-ci.yml`** (`cms/**` 変更時発火): PR で type-check → migrate → test → build を検証。main merge で本体・migration 用の 2 イメージを GHCR へ push し、`aramakisai-infra` へタグ更新 PR を自動作成する。マージ後 ArgoCD が PreSync Job で `payload migrate` を実行してから Deployment を更新する。
- **`cms-schema-check.yml`**: `cms/src/collections/**` / `cms/src/globals/**` の変更 PR で base/head のコレクション定義を比較し、フィールド削除・型変更・必須化などの破壊的変更を検出する。承認済みの破壊的変更は PR に `breaking-change-acknowledged` ラベルを付けて検出をスキップする (対応するフロントエンドコードがデプロイ・安定稼働済みであることを確認した上で付与すること)。

コンテンツモデルの変更手順

Directus の管理画面完結型とは異なり、コレクション/グローバル定義 (`cms/src/collections/`, `cms/src/globals/`) はコードを変更しマイグレーションを経て DB へ反映する。要求から本番反映までの詳細な手順は `docs/cms-operations.md` の「コンテンツモデルの変更手順」参照。

デプロイ先
- 本番環境
    - ホームページ本体 aramakisai.com (Cloudflare Workers、custom domain 接続済み。詳細は `frontend/wrangler.toml` コメント参照)
    - CMS 管理画面 cms.aramakisai.com
      - なおリポジトリは `aramakisai/aramakisai-infra`
- ステージング環境
    - ホームページ本体 PR ごとの Cloudflare Workers プレビュー URL (上記デプロイフロー参照)
    - CMS はステージング環境を持たない (本番のみ)

注意事項

特別な指示がない限りコミットメッセージを含めてすべて日本語を使用すること
@cloudflare/next-on-pages の制約上、Node.js 専用の API は使用不可 (Edge Runtime、対象は `frontend/` のみ。`cms/` は Node ランタイムでこの制約を受けない)
CMS のコレクション/グローバル定義の変更は本番 DB に直接影響するため、`cms-schema-check.yml` の検出結果を確認した上でマージすること
.env は使用禁止




# Agentic SDLC and Spec-Driven Development

Kiro-style Spec-Driven Development on an agentic SDLC

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.kiro/specs/` for active specifications
- Use `/kiro:spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: for existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional: design review)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional: after implementation)
- Progress check: `/kiro:spec-status {feature}` (use anytime)

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro:spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously: gather the necessary context and complete the requested work end-to-end in this run, asking questions only when essential information is missing or the instructions are critically ambiguous.

## Steering Configuration
- Load entire `.kiro/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `/kiro:steering-custom`)
