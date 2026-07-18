プロジェクト概要

荒牧祭実行委員会のフロントエンド (Next.js) と Directus スキーマを管理するリポジトリ。
FE は OpenNext (@opennextjs/cloudflare) 経由で Cloudflare Workers にデプロイ、Directus スキーマは Git 管理し K8s Job で自動適用される。

ディレクトリ構成

/
├── .devcontainer/             開発コンテナ設定
├── .github/                   GitHub Actions ワークフロー
├── frontend/
│   ├── src/
│   │   ├── app/        App Router
│   │   ├── components/
│   │   └── lib/
│   ├── public/
│   ├── .infisical.json
│   └── package.json
└── directus/
    ├── schema/
    │   └── snapshot.yaml    Directus スキーマスナップショット
    └── migrations/          カスタム migration (必要時のみ)

コマンド

bash# フロントエンド ローカル開発
cd frontend
pnpm install
pnpm dev           # http://localhost:3000

# 型チェック
pnpm type-check

# ビルド確認
pnpm build

bash# Directus スキーマ操作
# スキーマをファイルに書き出す (Directus が起動している状態で実行)
npx directus schema snapshot ./directus/schema/snapshot.yaml

# スキーマを Directus に適用 (K8s Job として自動実行されるが手動でも可)
npx directus schema apply ./directus/schema/snapshot.yaml

bash# K8s クラスタ状態確認
# kubectl を直接実行してはならない (kubeconfig 未設定でネットワーク到達不可)。
# 必ず make kubectl 経由で実行すること (Infisical から KUBECONFIG を注入)
make kubectl ARGS="get pods -A"
make kubectl ARGS="get externalsecret directus-staging-secrets -n staging"

環境変数

NEXT_PUBLIC_DIRECTUS_URL    Directus の API エンドポイント
                            prod:  https://api.aramakisai.com
                            local: http://localhost:8055

NEXT_PUBLIC_SITE_URL        サイト URL

NEXT_PUBLIC_GA_MEASUREMENT_ID  Google Analytics 4 測定ID (G-XXXXXXXXXX)
                            本番 (NODE_ENV=production) のみ読み込み。未設定なら GA タグ自体を出さない。
                            staging は Cloudflare Access 保護下のため通常は未設定でよい。

本番/staging の値は Infisical で管理する (`--env=prod` / `--env=staging`)。Pages ダッシュボードでの設定ではない。

デプロイフロー (`.github/workflows/frontend-ci.yml`)

PR 作成 (`frontend/**` を変更した場合のみ発火)
  → Next.js build 等が実行される (失敗したらマージ不可)
  → PR ごとに一意な Cloudflare Workers プレビュー URL が発行され、PR コメントに投稿される
  → 詳細 (URL 形式・衝突しないこと等) は `.kiro/steering/tech.md` 参照

main merge
  → Cloudflare Workers に本番デプロイ
  → Directus スキーマ変更がある場合:
      gitops リポジトリに PR が自動作成される
      → ArgoCD が K8s Job を実行 → directus schema apply

Directus スキーマの変更手順

ローカルの Directus でスキーマを変更
directus schema snapshot でファイルを更新
snapshot.yaml を commit して PR を出す

**additive-only ルール**: 新規 collection / field の追加のみ許容する。カラム削除・型変更等の破壊的変更は、対応するフロントエンドコードがデプロイされ安定稼働するまで禁止する。破壊的変更を行う場合はマージ前に必ずチームに周知し、infra 側 PR のチェックリストで確認する。

**一時停止中**: 本番未公開期間 (custom domain 未接続) に限り、上記ルールを機械強制する `additive-schema-check.yml` を一時停止している (`check` job に `if: false`)。再開条件は本番公開判断 (custom domain 接続)。詳細・再開手順は `.kiro/specs/sitemap-schema-review/design.md` を参照。

デプロイ先
- 本番環境
    - ホームページ本体 aramakisai.com (現状は Cloudflare Workers の workers.dev サブドメインのみ、custom domain 未接続。詳細は `frontend/wrangler.toml` コメント参照)
    - Directus管理画面 api.aramakisai.com
      - なおリポジトリは `aramakisai/aramakisai-infra`
- ステージング環境
    - ホームページ本体 PR ごとの Cloudflare Workers プレビュー URL (上記デプロイフロー参照)
    - Directus管理画面 stg-api.aramakisai.com

注意事項

特別な指示がない限りコミットメッセージを含めてすべて日本語を使用すること
@cloudflare/next-on-pages の制約上、Node.js 専用の API は使用不可 (Edge Runtime)
Directus スキーマ変更は本番 DB に直接影響するため、staging で必ず事前確認する
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
