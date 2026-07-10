# Requirements Document

## Project Description (Input)
staging 環境での自動 E2E 検証パイプライン。frontend の変更が Cloudflare Pages staging プレビューにデプロイされた後、主要な画面遷移・Directus 連携を自動ブラウザテスト (Playwright 等) で検証し、本番デプロイ前のゲートとする。現状は vitest による unit/workflow test のみで、実ブラウザでの E2E 検証は自動化されていない。

## Introduction

本仕様は、`aramakisai-web` リポジトリにおいて、PR ごとに発行される staging プレビュー環境（`frontend-ci.yml` の `deploy-preview` job が `wrangler versions upload` で払い出す Cloudflare Workers プレビュー URL）に対し、実ブラウザによる E2E 検証を自動実行する仕組みを新規に導入するものである。現状 `pnpm test`（vitest）による unit/workflow レベルの検証は CI に組み込まれているが、実際にビルド・デプロイされた成果物をブラウザで操作して確認する工程は存在しない。本仕様ではこの E2E 検証を CI パイプラインに追加し、その結果を `main` へのマージ前ゲート（required status check）として機能させることを目的とする。

なお、本仕様策定時点で `frontend/src/app` には静的なトップページ（`page.tsx`）のみが実装されており、Directus からのデータ取得を行う画面はまだ存在しない。そのため本仕様は、現時点で検証可能な範囲（ページの到達可能性・ビルド成果物の疎通）を最小スコープとしつつ、今後 Directus 連携画面が追加された際に検証項目を拡張できる構造を要件として定める。

## Boundary Context

- **In scope**:
  - `frontend/` 配下への Playwright（または同等のブラウザ自動化ツール）の導入・設定
  - staging プレビュー URL（`deploy-preview` job の出力）に対する E2E テストの自動実行トリガー
  - E2E テスト結果を `main` ブランチの branch protection `required_status_checks` に組み込むこと
  - 失敗時の診断情報（スクリーンショット・トレース・ログ）の CI アーティファクトとしての保存
  - staging Directus（`https://stg-api.aramakisai.com`）への読み取り専用アクセスを伴う検証、および将来の画面追加を見越した拡張可能なテスト構造
- **Out of scope**:
  - 個別ページの UI 実装そのもの（本仕様は検証基盤の追加であり、フロントエンド機能追加は対象外）
  - 本番環境（`aramakisai.com` / `api.aramakisai.com`）に対する E2E 実行
  - Directus スキーマの変更・migration（`directus-schema-sync` / `additive-schema-check` の対象範囲）
  - 負荷試験・パフォーマンス測定
  - `aramakisai-infra` リポジトリ側の ArgoCD / K8s Job 定義の変更
- **Adjacent expectations**:
  - `frontend-ci.yml` の `validate` → `deploy-preview` の既存 job 構成・fork PR での secret 非露出方針（`ci-pipeline-audit` spec で監査済み）を維持し、新規 E2E job はこの方針を破壊しない
  - branch protection のベースライン（`required_approving_review_count: 1` 等、`repo-governance` spec で確立）に、新規 required status check を追加する形で integrate する
  - additive-only ルール（CLAUDE.md）に従い、E2E テストが staging Directus のデータを破壊的に変更しないこと

---

## Requirements

### Requirement 1: E2E テスト基盤の導入

**Objective:** フロントエンド開発者として、`frontend/` に実ブラウザ E2E テストを記述・実行できる基盤が整っていることを望む。これにより、ビルド成果物が実際のブラウザで動作することを継続的に確認できる。

#### Acceptance Criteria

1. The frontend project shall include a Playwright (or equivalent browser automation) configuration that allows running E2E tests against an arbitrary base URL supplied at runtime (e.g. via environment variable), so the same suite can target a staging preview URL without code changes.
2. When a developer runs the E2E test command locally against `http://localhost:3000`（`pnpm dev` 起動中）, the E2E suite shall execute and report pass/fail results without requiring CI-specific configuration.
3. The frontend `package.json` shall expose a dedicated script（e.g. `test:e2e`）separate from the existing `pnpm test`（vitest unit/workflow tests）, so the two test layers remain independently invocable.
4. If the E2E test dependencies are not installed（e.g. missing browser binaries）, then the E2E test command shall fail with an actionable error message rather than a silent no-op.
5. The E2E test configuration shall exclude Node.js-only APIs incompatible with the Edge Runtime constraint from the tested application code path, since this constraint applies to `frontend/src` but not to the test runner itself（test runner runs under Node in CI, separate from the Edge Runtime build target）.

---

### Requirement 2: staging プレビュー環境への自動トリガー

**Objective:** リポジトリ管理者として、PR ごとに発行される staging プレビュー URL に対して E2E テストが自動的に実行されることを望む。これにより、デプロイされた実体に対する検証漏れを防げる。

#### Acceptance Criteria

1. When the `deploy-preview` job in `frontend-ci.yml` completes successfully and outputs a preview URL, the CI pipeline shall trigger a new E2E test job that consumes that URL as its target.
2. While the preview deployment is still propagating（Cloudflare Workers versions upload から実際にアクセス可能になるまでのタイムラグ）, the E2E job shall wait/retry with a bounded timeout before treating the preview as unreachable, rather than failing immediately on the first connection attempt.
3. If the `deploy-preview` job is skipped（fork PR、既存の fork-exclusion policy による）, then the E2E job shall also be skipped, since no preview URL exists to test against and no repository secrets should be exposed to fork-originated workflow runs.
4. If the preview URL does not become reachable within the bounded timeout, then the E2E job shall fail with a clear diagnostic message identifying the timeout condition, distinct from a test assertion failure.
5. The E2E job shall not re-trigger a new preview deployment; it shall only consume the URL already produced by `deploy-preview`.

---

### Requirement 3: 主要画面遷移の検証カバレッジ

**Objective:** 開発者として、実装済みの主要画面が正しく到達可能でナビゲーション可能であることを、E2E テストで確認したい。

#### Acceptance Criteria

1. The E2E suite shall verify that the top page（`frontend/src/app/page.tsx` に対応するルート）loads successfully（HTTP 200 相当、主要な DOM 要素の描画）against the staging preview URL.
2. Where additional page routes exist under `frontend/src/app` beyond the top page, the E2E suite shall include a corresponding navigation test for each, so that new pages are covered as they are added rather than requiring a parallel manual test plan.
3. The E2E test structure shall be organized（e.g. one spec file per route/screen）such that adding a new page's test does not require modifying the CI trigger or execution logic.
4. If a navigation test encounters a client-side error（unhandled exception, failed hydration）on a tested page, then the E2E suite shall report the failure with the page route and error detail.

---

### Requirement 4: Directus 連携データの検証（拡張可能スコープ）

**Objective:** 開発者として、Directus から取得したデータが画面に正しく反映されることを、将来の画面追加時にも継続して確認できる仕組みを望む。

#### Acceptance Criteria

1. Where a page under test fetches data from the staging Directus instance（`https://stg-api.aramakisai.com`）, the E2E suite shall verify that the fetched content is rendered on the page（e.g. expected collection-derived text/element is present）, rather than only checking page load status.
2. The E2E suite shall treat staging Directus access as read-only: no test shall create, update, or delete Directus content as a side effect of verification.
3. If the staging Directus instance is unreachable or returns an error during a test run, then the E2E suite shall report this as an environment/dependency failure distinct from a frontend rendering bug, so failures can be triaged correctly.
4. The E2E suite shall document（in test code or accompanying comments）the mapping between each Directus-dependent test and the collection(s) it depends on（`festival_meta`, `page_home` 等）, so schema changes' downstream test impact can be traced.

---

### Requirement 5: 本番デプロイ前ゲートとしての branch protection 統合

**Objective:** リポジトリ管理者として、E2E テストが失敗した PR は `main` にマージできないことを保証したい。

#### Acceptance Criteria

1. The E2E test job shall report its result as a distinct, named GitHub Actions job/check（e.g. `e2e (staging preview)`）, separate from the existing `validate` job's status check name.
2. When the E2E job's status check name is added to `main` branch protection's `required_status_checks.contexts`, a PR whose E2E job fails or is still pending shall be blocked from merging into `main`.
3. Where a PR originates from a fork（E2E job skipped per Requirement 2.3）, the required status check configuration shall not permanently block such PRs from merging solely due to the absent E2E result, consistent with the existing `frontend-ci-dummy.yml` workaround pattern for path-filtered/skipped required checks.
4. The audit trail（branch protection settings）shall reflect the added required status check name, verifiable via `gh api repos/aramakisai/aramakisai-web/branches/main/protection`.

---

### Requirement 6: 失敗時の診断情報

**Objective:** 開発者として、E2E テストが失敗した際に原因を素早く特定できる診断情報を得たい。

#### Acceptance Criteria

1. If an E2E test fails, then the CI pipeline shall capture and upload a screenshot and/or trace file of the failure as a workflow artifact.
2. The E2E job's summary（PR check output or job log）shall include the failing test name, the target preview URL, and a link or reference to the uploaded diagnostic artifact.
3. While an E2E test is retried due to transient failure（Requirement 7 の再試行ポリシーに基づく）, the CI pipeline shall record which attempt ultimately passed or failed, so flaky-vs-genuine failures remain distinguishable.

---

### Requirement 7: staging 環境への副作用抑制と耐障害性

**Objective:** インフラ管理者として、E2E テストの実行が staging 環境（Directus データ・他の開発者の検証作業）に悪影響を与えないことを望む。

#### Acceptance Criteria

1. The E2E suite shall not perform any write operation（create/update/delete）against the shared staging Directus instance.
2. If a test requires state that is not already present in staging Directus, then the test shall skip or be marked inconclusive rather than attempting to create that state via a write operation.
3. While network flakiness against the shared staging environment occurs（一時的な接続エラー・タイムアウト）, the E2E job shall apply a bounded retry policy（最大リトライ回数の上限あり）rather than retrying indefinitely.
4. The E2E job shall enforce an overall execution timeout, so a hung browser session or unreachable preview does not block the CI pipeline indefinitely.
