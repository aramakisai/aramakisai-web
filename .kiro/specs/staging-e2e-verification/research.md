# Research & Design Decisions

## Summary
- **Feature**: `staging-e2e-verification`
- **Discovery Scope**: Complex Integration（新規 CI コンポーネント + 既存ワークフロー拡張 + 姉妹リポジトリ `aramakisai-infra` の Cloudflare Access 設定への依存）
- **Key Findings**:
  - `aramakisai-web.aramakisai.workers.dev`（`deploy-preview` job のプレビュー実体ドメイン）は `aramakisai-infra` の Terraform（`terraform/access.tf`）で Cloudflare Access（Authentik OIDC, `auto_redirect_to_identity`）保護下にあり、Playwright は Access Service Token による認証バイパスが必須
  - Cloudflare Access で Service Token を機能させるには、既存の `decision = "allow"` + `login_method` ポリシーとは別に、`decision = "non_identity"` + `include { service_token = [...] }` の独立ポリシーを追加する必要がある（`allow` ポリシーの `include` に service_token を混ぜても機能しない）
  - `deploy-preview` job は現状 step レベルの output（`upload_preview.outputs.url`）のみで job レベルの `outputs:` を宣言していないため、新規 E2E job から参照するには `frontend-ci.yml` に job-level output 追加が必要
  - `main` branch protection の `required_status_checks.contexts` は現在 3 件（`type-check / lint / test / build`, `deploy preview (Workers)`, `Detect breaking snapshot.yaml changes`）。新規 job 名を追加する際は `frontend-ci-dummy.yml` 側にも同名ジョブのミラーが必要（`ci-pipeline-audit` spec で確立済みのパターン）

## Research Log

### Cloudflare Access Service Token と Terraform リソース
- **Context**: プレビュー URL が Cloudflare Access で保護されているため、Playwright が非対話的にアクセスする方法を確認する必要があった
- **Sources Consulted**:
  - [Service tokens · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
  - [cloudflare_zero_trust_access_service_token (Terraform Registry, raw docs)](https://github.com/cloudflare/terraform-provider-cloudflare/blob/master/docs/resources/zero_trust_access_service_token.md)
  - [cloudflare_zero_trust_access_policy (Terraform Registry, raw docs)](https://github.com/cloudflare/terraform-provider-cloudflare/blob/master/docs/resources/zero_trust_access_policy.md)
  - [Cloudflare Community: Service Tokens not working with Access Policies](https://community.cloudflare.com/t/service-tokens-not-working-with-access-policies/253415)
- **Findings**:
  - `cloudflare_zero_trust_access_service_token` は `account_id` + `name` のみ必須。`client_id`/`client_secret` は read-only（作成時にしか `client_secret` を取得できない — state 上は sensitive 値として保持される）
  - `duration`（デフォルト永続想定、明示指定は `8760h`/`17520h`/`43800h`/`87600h`/`forever` のいずれか）と `min_days_for_renewal` でローテーション運用が可能。`min_days_for_renewal` 使用時は `create_before_destroy = true` が必須（切替時の瞬断防止）
  - `cloudflare_zero_trust_access_policy` の `decision` は `allow`/`deny`/`non_identity`/`bypass` の4種。**Service Token を機能させるには `non_identity` を使う必要があり、`allow` ポリシーに `service_token` を含めても Access は依然 IdP ログインを要求する**（コミュニティ報告で頻出の誤り）
  - `include.service_token`（特定トークンID指定）と `include.any_valid_service_token`（任意の有効トークン）のどちらかを選べる。E2E 専用トークンを限定的に許可するため `service_token = [specific_id]` を採用する
  - 同一 Application に複数ポリシーを `precedence` 違いで共存させられる（既存 `allow_authentik` は `precedence = 1`）。Access はいずれかのポリシーが一致すれば許可するため、新規ポリシーを `precedence = 2` 等で追加しても既存の人間向けログインは壊れない
- **Implications**: `aramakisai-infra` 側に (1) `cloudflare_zero_trust_access_service_token` リソース、(2) `decision = "non_identity"` の新規ポリシーの2点を追加する必要がある。この変更は `terraform/access.tf` の責務範囲内だが、リポジトリ横断のため本 spec の Boundary Commitments では Out of Boundary / Allowed Dependency として扱う

### GitHub Actions job 間の値受け渡しと fork PR skip
- **Context**: 新規 E2E job が `deploy-preview` job の出力（プレビュー URL）を消費する必要があるが、現状 `deploy-preview` は step 単位の output しか持たない
- **Sources Consulted**: 既存 `.github/workflows/frontend-ci.yml`（`upload_preview` step の `outputs.url`）
- **Findings**:
  - `deploy-preview` job に `outputs: preview_url: ${{ steps.upload_preview.outputs.url }}` を追加すれば `needs.deploy-preview.outputs.preview_url` として E2E job から参照可能
  - `deploy-preview` は fork PR で `if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false` によりスキップされる。GitHub Actions のデフォルトの暗黙条件は `success()` であり、依存元 job が `skipped` の場合は `success()` が偽になるため、E2E job に明示的な `if` 条件を書かなくても `needs: [deploy-preview]` だけで自動的にスキップされる（要件 2.3 を追加コードなしで満たせる）
- **Implications**: `frontend-ci.yml` の `deploy-preview` job に job-level `outputs` を追加するだけで、E2E job 側は `needs: deploy-preview` の標準動作に任せられる。フォーク PR 向けの特別な `if` 分岐は不要

### Playwright の CI 構成パターン
- **Context**: 実行時に任意の base URL・認証ヘッダを注入できる構成、リトライ/タイムアウト方針を確認
- **Sources Consulted**:
  - [Playwright release notes](https://playwright.dev/docs/release-notes)
  - [@playwright/test - npm](https://www.npmjs.com/package/@playwright/test)
  - 複数の Playwright CI ベストプラクティス記事（GitHub Actions 統合、環境変数管理）
- **Findings**:
  - `@playwright/test` 最新は `1.61.x` 系（2026-07 時点）。Next.js 15 / React 19 との既知の非互換は無し
  - `playwright.config.ts` の `use.baseURL` と `use.extraHTTPHeaders` は環境変数から動的に設定するのが標準パターン（`baseURL: process.env.E2E_BASE_URL`, `extraHTTPHeaders: { 'CF-Access-Client-Id': ..., 'CF-Access-Client-Secret': ... }`）
  - CI 向けの標準設定は `retries: process.env.CI ? 2 : 0`、`trace: 'retain-on-failure'`、`screenshot: 'only-on-failure'`、ブラウザインストールは `playwright install --with-deps chromium`
- **Implications**: `playwright.config.ts` は環境変数駆動で local/CI 両対応にし、Service Token ヘッダは `extraHTTPHeaders` に載せることで全リクエストに一律付与できる（要件 2.6 を満たす）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 同一ワークフロー内 job 追加（採用） | `frontend-ci.yml` に `e2e` job を追加し `needs: deploy-preview` で連結 | プレビュー URL の受け渡しがシンプル（同一 workflow run 内）。fork PR skip が GitHub Actions のデフォルト挙動だけで実現 | `frontend-ci.yml` が長大化 | 既存 `deploy-preview`/`validate` と同じ設計スタイルを踏襲 |
| 別ワークフロー + `workflow_run` トリガー | `deploy-preview` 完了後に別 workflow を `workflow_run` で起動 | ワークフローファイルが分離され見通しが良い | `workflow_run` は base repo コンテキストで実行されるため PR の head SHA/status 紐付けが煩雑になり、`required_status_checks` との相性が悪い（GitHub 既知の制約） | branch protection の該当 PR に直接 status を紐付けにくく、`ci-pipeline-audit` で扱った path-filter 問題と類似の複雑さを追加で持ち込むため不採用 |
| `repository_dispatch` で外部トリガー | プレビュー URL 確定後に外部から E2E をキック | 柔軟だが本リポジトリでは過剰 | 認証・トークン管理が増え、要件にない複雑性を追加 | 不採用 |

## Design Decisions

### Decision: E2E job は `frontend-ci.yml` 内の新規 job として実装する
- **Context**: プレビュー URL 生成後に E2E を実行し、結果を必須ステータスチェックとして扱う必要がある
- **Alternatives Considered**:
  1. `workflow_run` による別ワークフロー
  2. `repository_dispatch` による外部トリガー
- **Selected Approach**: `frontend-ci.yml` に `e2e` job を追加し `needs: deploy-preview` で連結、`deploy-preview` に `outputs.preview_url` を追加
- **Rationale**: 同一 workflow run 内で完結するため PR との紐付け・fork PR skip が GitHub Actions の標準機能だけで実現し、`required_status_checks` との相性も良い（`ci-pipeline-audit` で確立した運用パターンを踏襲）
- **Trade-offs**: `frontend-ci.yml` の行数が増えるが、責務は明確（validate → deploy-preview → e2e の直列パイプライン）
- **Follow-up**: `frontend-ci-dummy.yml` に同名ジョブのミラーを追加すること（branch protection の contexts 整合）

### Decision: Cloudflare Access バイパスは Service Token + `non_identity` ポリシーで実現する
- **Context**: Playwright がプレビュー URL に到達するには Cloudflare Access の Authentik ログインを回避する必要がある
- **Alternatives Considered**:
  1. Access Application 自体を bypass（保護解除）— Access 保護の意図（誤って外部露出しないこと）を破壊するため却下
  2. mTLS クライアント証明書 — Service Token より運用（証明書配布・失効）が煩雑
- **Selected Approach**: `aramakisai-infra` 側に E2E 専用 Service Token を発行し、`non_identity` decision の追加ポリシーで許可。Client ID/Secret は Infisical staging 環境経由で CI に注入し、Playwright の `extraHTTPHeaders` で全リクエストに付与
- **Rationale**: Cloudflare 公式の非対話的クライアント向け標準機構であり、既存の人間向け Authentik ログインポリシーを変更せず並存できる
- **Trade-offs**: `aramakisai-infra` 側の Terraform 変更が本 spec の実装に対する外部依存として発生する（別リポジトリ・別 PR）
- **Follow-up**: Service Token のローテーション/失効時にどう気づくか（要件 8.5, fail-closed）を CI のエラーメッセージ設計に反映する

## Risks & Mitigations
- Cloudflare Access Service Token が `aramakisai-infra` 側で未発行のまま本 spec の実装を進めると E2E job が恒久的に失敗する — 実装タスクの依存順序として明記し、infra 側 PR を先行させる
- プレビュー URL 発行から実際に到達可能になるまでのタイムラグが読めない — `wait-for-preview` スクリプトで bounded retry + timeout を設け、原因（Access 拒否 / 未デプロイ / ネットワーク）を切り分けられるエラーメッセージにする
- `frontend-ci.yml` と `frontend-ci-dummy.yml` の job 名同期漏れ — 既存 `ci-pipeline-audit` の教訓通り、workflow テスト（`frontend-ci.workflow.test.ts`）で両ファイルの job 名一致を機械検証する

## References
- [Service tokens · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [cloudflare_zero_trust_access_service_token docs](https://github.com/cloudflare/terraform-provider-cloudflare/blob/master/docs/resources/zero_trust_access_service_token.md)
- [cloudflare_zero_trust_access_policy docs](https://github.com/cloudflare/terraform-provider-cloudflare/blob/master/docs/resources/zero_trust_access_policy.md)
- [Cloudflare Community: Service Tokens not working with Access Policies](https://community.cloudflare.com/t/service-tokens-not-working-with-access-policies/253415)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
