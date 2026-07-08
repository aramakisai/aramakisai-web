# Research & Design Decisions Template

## Summary
- **Feature**: `repo-governance`
- **Discovery Scope**: Extension（既存 GitHub リポジトリ・既存 Infisical プロジェクト・`aramakisai-infra` の既存パターンへの統合）
- **Key Findings**:
  - `main` の branch protection は既に部分適用済み（PR レビュー必須・`dismiss_stale_reviews`）だが、`required_status_checks.contexts` は空、`enforce_admins` は `false`。Requirement 1 の未達分はステータスチェック登録と admin enforcement の 2 点のみ。
  - `frontend-ci.yml`（`cicd-pipeline` 実装済み）の `validate` / `deploy-preview` ジョブは `paths: frontend/**` のワークフロー・レベル path filter を持つ。これを必須ステータスチェックにすると、`frontend/**` を触らない PR（本 spec 自体の `.kiro/**` PR 等）でチェックが永久に "Expected" のまま停止し、admin bypass も禁止（1.3, 1.5）のためマージ不能になる。GitHub の既知の制約（後述）。
  - GitHub Actions Secrets は現在 `INFRA_GITHUB_TOKEN`（旧 PAT 方式の残骸、どの workflow からも参照されていない）のみ登録済み。`INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` は未登録 — しかし 3 つの workflow は全てこの 2 つを前提に実装済みのため、**現状では CI が secret 不足で必ず失敗する**。
  - Infisical `staging` 環境（frontend CI が `infisical run --env=staging` で参照）は **シークレット 0 件**。`NEXT_PUBLIC_DIRECTUS_URL` / `NEXT_PUBLIC_SITE_URL` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` が未登録で、`deploy-preview` job は実行時に確実に失敗する。
  - Infisical `prod` 環境（プロジェクト slug `aramakisai-infra`、`aramakisai-web`/`aramakisai-infra` 共有の単一プロジェクト）には `DIRECTUS_STAGING_SECRET` / `DIRECTUS_STAGING_ADMIN_EMAIL` / `DIRECTUS_STAGING_ADMIN_PASSWORD` / `DIRECTUS_STAGING_DB_PASSWORD` が **既に登録済み**（Requirement 3.1–3.4 は Infisical 側で充足済み）。ただし `aramakisai-infra/.kiro/steering/tech.md` のシークレット一覧に未記載（3.5 未達）。`GH_APP_ID` / `GH_APP_PRIVATE_KEY` は未登録（2.1 未達）。
  - `aramakisai-web` の `.pre-commit-config.yaml` / `.gitleaks.toml` は既に存在（`pre-commit-hooks` + `yamllint` + `gitleaks` v8.23.0）。`check-confidential-info.py` ローカルフックのみ未導入（4.4–4.9 未達）。
  - `aramakisai-web` の devcontainer は `typescript-node` ベースで `uv`/`python3` 未導入。`aramakisai-infra` は `uv run python scripts/check-confidential-info.py` 方式だが、スクリプトは標準ライブラリのみに依存するため `uv` 必須ではない。

## Research Log

### 1. main ブランチの現行 branch protection 状態
- **Context**: Requirement 1 の未達分を特定するため、`gh api repos/aramakisai/aramakisai-web/branches/main/protection` で現状を確認。
- **Sources Consulted**: `gh api` 実行結果（本セッション内で直接取得）。
- **Findings**:
  - `required_pull_request_reviews`: 設定済み（`required_approving_review_count: 1`, `dismiss_stale_reviews: true`）→ PR 必須・direct push 禁止は一般ユーザーに対しては既に有効。
  - `required_status_checks.contexts`: `[]`（空）→ ステータスチェック必須化は未設定。
  - `enforce_admins.enabled`: `false` → admin は現状 bypass 可能（1.3, 1.5 未達）。
- **Implications**: 本 spec のタスクは「ゼロから作る」のではなく「既存 protection に `required_status_checks` を追加し `enforce_admins` を `true` にする」差分作業に限定される。

### 2. 必須ステータスチェックの実名（workflow 実装との突合）
- **Context**: requirements.md は `type-check` / `build` / `Cloudflare Pages deployment check` という論理名を使うが、`cicd-pipeline` の実装（`frontend-ci.yml`）はジョブを統合・命名しており、GitHub Checks API 上の context 名と一致しない。`cicd-pipeline` の design.md 自体も「requirements.md の Pages 文言を Workers に読み替える」前例がある。
- **Sources Consulted**: `.github/workflows/frontend-ci.yml`（`jobs.validate.name`, `jobs.deploy-preview.name`, `jobs.deploy-prod.name`）、GitHub Docs「About status checks」。
- **Findings**:
  - `validate` ジョブの表示名は `type-check / lint / test / build`（type-check・lint・test・build を単一ジョブに統合済み）。`pull_request` と `push:main` の両方で走る。
  - `deploy-preview` ジョブの表示名は `deploy preview (Workers)`。**PR イベントでのみ**走り、fork PR では `if:` 条件でジョブ自体がスキップされる（スキップ = 成功として扱われるため必須チェックにしても fork PR をブロックしない）。
  - `deploy-prod` ジョブ（`deploy prod (Workers)`）は `push:main` でのみ走り、PR イベントでは一切生成されない。PR マージゲートの必須チェックには**使えない**（使うと全 PR が永久に "Expected" で止まる）。
  - GitHub の Checks API における "context" 名はジョブの `name:` フィールドそのもの（reusable workflow やマトリクスでない限りワークフロー名のプレフィックスは付かない）。
- **Implications**: Requirement 1.2 の 3 項目は実運用上 **2 つの実 context** に集約される: `type-check / lint / test / build` と `deploy preview (Workers)`。`deploy prod (Workers)` は必須チェック対象から除外する。

### 3. Path-filtered workflow と必須ステータスチェックの既知の相互作用
- **Context**: `frontend-ci.yml` の `on.pull_request.paths` / `on.push.paths` は `frontend/**` のみ。`.kiro/**` や `CLAUDE.md` のみを変更する PR（本 spec 自身のような PR を含む）はこのワークフロー自体が起動しない。GitHub の必須ステータスチェックが「ワークフロー未起動」をどう扱うかは admin enforcement（1.3, 1.5）の実現可能性に直結するため、公式ドキュメント・コミュニティ議論で検証した。
- **Sources Consulted**:
  - GitHub Docs「Troubleshooting required status checks」
  - GitHub Community Discussion #57334「How to handle required status checks for branch protection when the workflow isn't always run?」
  - GitHub Community Discussion #13690「Required actions workflows from branch protections should only be required if run」
  - GitHub Community Discussion #54877「Branch protections when actions use `paths-ignore`」
- **Findings**:
  - ワークフロー自体が path filter 等で**起動しない**場合、そのワークフローに属する必須チェックは "Pending"（Expected）のまま**永久に完了しない**。マージは完全にブロックされる。
  - 一方、ワークフローは起動したがジョブ内の `if:` 条件で**ジョブがスキップされた**場合は `conclusion: skipped` が報告され、必須チェックとしては成功扱いになる（fork PR の `deploy-preview` はこのパターンなので問題ない）。
  - 公式に推奨されている回避策は 2 つ: (a) path filter をワークフロー・トリガーではなく `dorny/paths-filter` 等でジョブ内条件に落とし込み、非対象パスでも「強制成功」ステップを挟んで常にジョブが完了として報告されるようにする、(b) 対象パスの逆条件で発火する同名の "dummy" ワークフローを追加し、常にどちらかが成功を報告するようにする。
  - いずれの回避策も `frontend-ci.yml`（= `on.pull_request.paths` の変更、または新規ワークフローファイルの追加）への変更を要する。
- **Implications**: これは `repo-governance` の Boundary（"GitHub Actions ワークフロー定義は `cicd-pipeline` spec が所有" で明示的に対象外）と直接衝突する。`repo-governance` は branch protection の設定のみを担当し、この根本原因（`frontend-ci.yml` の trigger 定義）を変更する権限を持たない。→ **Revalidation Trigger としてクロススペックで明示し、`cicd-pipeline` 側の追随変更を前提条件として記録**する（詳細は Risks & Mitigations、design.md の Revalidation Triggers 参照）。

### 4. GitHub Actions Secrets の現状
- **Context**: Requirement 2.2「`aramakisai-web` は `INFISICAL_CLIENT_ID` と `INFISICAL_CLIENT_SECRET` の 2 つのみ」を検証。
- **Sources Consulted**: `gh secret list`（本セッション内で直接取得）。
- **Findings**: 現在登録済みの GitHub Actions secret は `INFRA_GITHUB_TOKEN` の 1 件のみ。`grep` で全 workflow を確認した結果、`INFRA_GITHUB_TOKEN` を参照する箇所はゼロ（旧 PAT 方式からの移行漏れの残骸）。`INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` は未登録だが、3 workflow 全てがこの 2 つの secret を前提に実装済み。
- **Implications**: 現状は CI/CD が **secret 不足で確実に失敗する状態**。`INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` の登録と `INFRA_GITHUB_TOKEN` の削除の両方が必要（2.2 の「exactly two」を満たすため削除も必須）。

### 5. Infisical 上の既存シークレット状況
- **Context**: Requirement 2.1, 2.2, 3.1–3.4 の充足状況を Infisical CLI で直接確認。
- **Sources Consulted**: `infisical secrets --env=prod` / `--env=staging`（本セッション内、鍵名のみ確認・値は非表示）、`aramakisai-infra/gitops/manifests/shared/eso/cluster-secret-store.yaml`、`aramakisai-infra/gitops/manifests/staging/directus/external-secret.yaml`。
- **Findings**:
  - `staging` 環境: シークレット 0 件。`NEXT_PUBLIC_DIRECTUS_URL` / `NEXT_PUBLIC_SITE_URL` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` すべて未登録。
  - `prod` 環境: `DIRECTUS_STAGING_SECRET` / `DIRECTUS_STAGING_ADMIN_EMAIL` / `DIRECTUS_STAGING_ADMIN_PASSWORD` / `DIRECTUS_STAGING_DB_PASSWORD` は**既に登録済み**（Requirement 3.1–3.4 は Infisical 層では達成済み）。`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_TUNNEL_ID` はあるが `CLOUDFLARE_ACCOUNT_ID` は未登録。`GH_APP_ID` / `GH_APP_PRIVATE_KEY` / `NEXT_PUBLIC_*` は未登録。
  - `ClusterSecretStore`（`aramakisai-infra`）は `projectSlug: aramakisai-infra`, `environmentSlug: prod` のみを参照する設計。`aramakisai-web` の `.infisical.json` の `workspaceId` は `aramakisai-infra` と同一 — 両リポジトリは単一 Infisical プロジェクトを共有する SSoT 構成であることを確認（CLAUDE.md の「Infisical が SSoT」原則と整合）。
  - `directus-staging-secrets` ExternalSecret（`aramakisai-infra/gitops/manifests/staging/directus/external-secret.yaml`）は `DIRECTUS_STAGING_SECRET` 等の remoteRef キー名を `prod` 環境から解決する設計であり、値がすでに登録済みであることから ESO 同期は成立している可能性が高い（3.6 の `kubectl get externalsecret` 確認は実装/検証フェーズで実施）。
- **Implications**: Requirement 3 は「新規登録」ではなく「`tech.md` への記載漏れ修正」（3.5）が主作業。Requirement 2 は GH App 認証情報・Cloudflare Account ID・frontend 用 `NEXT_PUBLIC_*`（staging/prod 両方）の新規登録が主作業。

### 6. `aramakisai-infra/.kiro/steering/tech.md` のシークレット一覧の記載漏れ
- **Context**: Requirement 3.5 の対象箇所を特定。
- **Sources Consulted**: `aramakisai-infra/.kiro/steering/tech.md`（「Infisical で管理するシークレット一覧」節）。
- **Findings**: Directus 関連の記載は `DIRECTUS_SECRET` / `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD` / `DIRECTUS_DB_PASSWORD`（本番のみ）と `DIRECTUS_PROD_OIDC_CLIENT_SECRET` / `DIRECTUS_STG_OIDC_CLIENT_SECRET` のみ。`DIRECTUS_STAGING_*` 4 キーは実際には Infisical に存在するにもかかわらず一覧に**未記載**。
- **Implications**: 3.5 は `tech.md` の該当箇条書きに `DIRECTUS_STAGING_SECRET` / `DIRECTUS_STAGING_ADMIN_EMAIL` / `DIRECTUS_STAGING_ADMIN_PASSWORD` / `DIRECTUS_STAGING_DB_PASSWORD` を追記するだけの軽微な変更。この変更は `aramakisai-infra` リポジトリ側で行う（`aramakisai-web` の PR ではない点に注意）。

### 7. pre-commit / gitleaks の既存導入状況（`aramakisai-web` vs `aramakisai-infra`）
- **Context**: Requirement 4 の未達分を特定するため両リポジトリの `.pre-commit-config.yaml` / `.gitleaks.toml` / devcontainer を比較。
- **Sources Consulted**: 両リポジトリの `.pre-commit-config.yaml`, `.gitleaks.toml`, `.devcontainer/Dockerfile`, `.devcontainer/post-create.sh`, `aramakisai-infra/scripts/check-confidential-info.py`。
- **Findings**:
  - `aramakisai-web` は既に `pre-commit-hooks`（trailing-whitespace 等）・`yamllint`・`gitleaks v8.23.0` を導入済み（4.2, 4.3, 4.5 は概ね達成済み。allowlist パスはリポジトリ固有でよく、値の完全一致は不要）。
  - `check-confidential-info.py` ローカルフックのみ未導入（4.4, 4.6–4.9 未達）。
  - `aramakisai-infra` 側の pre-commit 定義は `entry: uv run python scripts/check-confidential-info.py`, `language: system`, `files: \.(py|sh|yaml|yml|json|md|txt|tf|tfvars|cfg)$`。requirements.md 4.4 は対象拡張子を `.ts, .tsx, .js, .json, .md, .yaml, .yml` と指定（Next.js リポジトリ向けに再定義済み、`.py/.sh/.tf` 等は不要）。
  - `aramakisai-web` の devcontainer ベースイメージ（`mcr.microsoft.com/devcontainers/typescript-node`）には `uv` も `python3` も入っていない。`aramakisai-infra` は Python 中心のため `uv` を前提にしている。
  - `check-confidential-info.py` 自体は `sys, os, re, getpass, subprocess, pwd`（すべて標準ライブラリ）のみに依存し、サードパーティ依存はゼロ。
- **Implications**: スクリプト本体は無変更でコピー可能。ただし pre-commit の hook 定義（`entry`/`language`）は `aramakisai-web` の devcontainer 実態に合わせて調整が必要（Design Decisions 参照）。

## Architecture Pattern Evaluation

本 spec はアプリケーションコードを持たない「リポジトリ設定 + シークレット登録」のガバナンス spec であり、新規アーキテクチャパターンの選定は不要。対象は GitHub 設定（branch protection, Actions secrets）・Infisical シークレットストア・pre-commit フック定義の 3 種の宣言的設定であり、いずれも `aramakisai-infra` の既存パターンを踏襲する「設定の複製・差分適用」アプローチを取る。

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| gh CLI / API での宣言的設定 | `gh api` で branch protection・secrets を都度適用 | Terraform 不要、要件通りの手動/CLI 運用（Adjacent expectations 準拠） | 設定の idempotency はスクリプト側で担保する必要あり | requirements.md が Terraform 不使用を明示 |
| Terraform GitHub provider | IaC で branch protection 管理 | 差分管理・レビュー容易 | 要件で明示的に不採用と規定 | 不採用（Adjacent expectations） |

## Design Decisions

### Decision: 必須ステータスチェックの対象を実装済みジョブ名にマッピングする
- **Context**: requirements.md の論理名（`type-check`, `build`, `Cloudflare Pages deployment check`）と `cicd-pipeline` 実装済みジョブ名が一致しない。
- **Alternatives Considered**:
  1. requirements.md の文言通り 3 つの個別チェックを要求する → 実装が存在せず不可能。
  2. 実装済みジョブ名（`type-check / lint / test / build`, `deploy preview (Workers)`）にマッピングする。
- **Selected Approach**: 2 を採用。`deploy prod (Workers)` は PR イベントで発生しないため必須チェック対象から除外。
- **Rationale**: `cicd-pipeline` は実装完了済み（spec.json `phase: implementation-complete`）であり、そちらが正。`repo-governance` は実体に合わせる。
- **Trade-offs**: requirements.md の文言と設計の対応関係をトレーサビリティ表で明示する必要がある。
- **Follow-up**: `cicd-pipeline` のジョブ名が将来変更された場合、branch protection の再設定が必要（Revalidation Trigger）。

### Decision: path-filtered workflow 問題はクロススペックの前提条件として記録し、本 spec では解決しない
- **Context**: `frontend-ci.yml` の path filter により、`frontend/**` を触らない PR で必須チェックが完了せずマージ不能になる（Research Log #3）。
- **Alternatives Considered**:
  1. `repo-governance` が `frontend-ci.yml` の trigger を修正する → Boundary 逸脱（`cicd-pipeline` 所有ファイル）。
  2. 必須チェックに登録せず、CI 未実行のままマージ可能にする → Requirement 1.1/1.2 に反する。
  3. 前提条件（blocking dependency）として明記し、`cicd-pipeline` 側の追随 PR を先行させる。
- **Selected Approach**: 3。branch protection の設定自体はこの Design 通り進めるが、実装（tasks フェーズ）は「`frontend-ci.yml` の path filter 修正（別 PR、`cicd-pipeline` 名義）が先行してマージされていること」をブロッキング前提として明記する。
- **Rationale**: Boundary Commitments を尊重しつつ、実運用で PR がロックされる事故を防ぐ。
- **Trade-offs**: `repo-governance` の実装完了が `cicd-pipeline` への軽微な追加変更に依存する（spec 間の直列依存が発生）。
- **Follow-up**: tasks.md でこの前提条件をタスクとして明示し、`cicd-pipeline` 側 issue/PR を先に立てる。

### Decision: `check-confidential-info.py` ローカルフックは `language: python`（pre-commit 管理の venv）を採用し `uv` 依存を持ち込まない
- **Context**: `aramakisai-web` の devcontainer には `uv`/`python3` が導入されていない。スクリプトはサードパーティ依存ゼロ。
- **Alternatives Considered**:
  1. `aramakisai-infra` と同一の `entry: uv run python ...`, `language: system` を丸ごと複製 → devcontainer に `uv` and `python3` の追加インストールが必要になり、Node/TypeScript 中心の `aramakisai-web` devcontainer に不要な依存を増やす。
  2. `language: python`（pre-commit 標準機能、pre-commit が自前で venv を作成・管理）を採用し、`entry: python scripts/check-confidential-info.py` とする。
- **Selected Approach**: 2。ただし pre-commit の `language: python` は起動時にシステム python3 インタプリタを要求するため、devcontainer の Dockerfile に `python3` パッケージの追加インストールを追加する（`uv` は追加しない）。
- **Rationale**: スクリプト本体に依存パッケージがないため `uv`/`pip` によるパッケージ解決は不要。最小限の追加で要件を満たす。
- **Trade-offs**: `aramakisai-infra` と hook 定義（`entry`/`language`）が完全一致しないが、要件 4.4/4.9 が求めるのはスクリプト本体の同期であり、hook 定義まで一致を要求していない。
- **Follow-up**: `aramakisai-infra` 側で `check-confidential-info.py` の引数仕様（`sys.argv` によるファイルリスト受け取り）が変わった場合、両リポジトリの hook 定義を再確認する。

## Risks & Mitigations
- **Path-filtered required check が非 frontend PR のマージを永久ブロックする** — `cicd-pipeline` 側で `frontend-ci.yml` の trigger を修正（path filter をジョブ内条件に移すか、逆条件の dummy ワークフローを追加）してから branch protection を有効化する。本 spec の実装タスクの前提条件として明記。
- **Infisical `staging` 環境が空のため `deploy-preview` job が確実に失敗する** — Requirement 2 の実装スコープに `NEXT_PUBLIC_DIRECTUS_URL` / `NEXT_PUBLIC_SITE_URL` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` の staging 登録を含める。
- **`INFRA_GITHUB_TOKEN` の削除漏れ** — 未参照であることを確認済みだが、削除前に該当 secret を参照する workflow が他にないか再確認する（tasks フェーズでの確認手順として明記）。
- **GitHub App の権限過剰付与** — `contents:write` / `pull-requests:write` を `aramakisai-infra` のみにスコープすることを作成手順に明記し、レビュー時に確認する。

## References
- [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks) — path filter でワークフローが起動しない場合の必須チェックの挙動。
- [GitHub Community Discussion #57334](https://github.com/orgs/community/discussions/57334) — path filter と必須チェックの既知の相互作用と回避策。
- [GitHub Community Discussion #13690](https://github.com/orgs/community/discussions/13690) — 必須チェックが「実行されなかった場合のみ要求すべき」という設計上の議論。
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — `enforce_admins` を含む branch protection の仕様。
