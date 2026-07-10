# Requirements Document

## Project Description (Input)
frontend-ci / directus-schema-sync ワークフローの網羅性レビューと不足補完。型チェック・lint・test 失敗時のマージブロックが GitHub branch protection と整合しているか、fork PR での secret 非露出、preview/prod デプロイの権限分離など既存 CI パイプラインの抜け漏れを棚卸しし、必要な検証項目・ブランチ保護設定を追加する。cicd-pipeline spec で実装済みのワークフローに対する事後監査・補完という位置づけ。

## Introduction

本仕様は、`cicd-pipeline` spec および `repo-governance` spec で実装済みの `aramakisai-web` リポジトリの GitHub Actions ワークフロー（`frontend-ci.yml`, `frontend-ci-dummy.yml`, `directus-schema-sync.yml`, `additive-schema-check.yml`）と `main` ブランチ保護設定を対象に、事後監査（audit）を行うものである。新規機能の実装ではなく、既存実装が意図通りに機能し、かつ設計時に想定されていなかった抜け漏れがないかを棚卸しし、発見した不備を是正することを目的とする。

## Boundary Context

- **In scope**:
  - `aramakisai-web` リポジトリの `.github/workflows/` 配下の全ワークフロー（`frontend-ci.yml`, `frontend-ci-dummy.yml`, `directus-schema-sync.yml`, `additive-schema-check.yml`）
  - `main` ブランチの branch protection 設定（`required_status_checks`, `enforce_admins`, `required_pull_request_reviews`, bypass allowance 等）と各ワークフローの job 名・trigger 条件との整合性
  - fork からの Pull Request における GitHub Actions secrets 非露出の検証
  - preview デプロイ（staging）と prod デプロイの実行条件・権限（`permissions:` ブロック）の分離状況の検証
  - 監査で発見した不備の是正（ワークフロー修正・branch protection 設定変更）
- **Out of scope**:
  - `aramakisai-infra` リポジトリ側のワークフロー・ArgoCD Application・K8s Job マニフェスト（`cicd-pipeline` spec の対象範囲）
  - 新規 CI/CD 機能の追加設計（本 spec は既存実装の監査・補完に限定する）
  - Cloudflare Pages/Workers ダッシュボード設定、Terraform 管理リソース
  - pre-commit フック・gitleaks 等ローカル開発者向けチェック（`repo-governance` spec の対象範囲）
- **Adjacent expectations**:
  - `cicd-pipeline` spec の design.md / requirements.md に記載された設計意図（例: Requirement 7 のシークレット最小権限方針）を正とし、実装との差分を照合する
  - `repo-governance` spec で確立した branch protection のベースライン（`required_approving_review_count: 1`, `dismiss_stale_reviews: true`, `enforce_admins: true`）を維持しつつ、本監査で追加すべき項目のみを補完する
  - `frontend-ci-dummy.yml` は GitHub の既知の制約（path filter で発火しないワークフローの required status check が永久に pending になる問題）に対する意図的な回避策であり、監査ではこの設計意図を破壊せず、回避策自体の妥当性・リスクを検証対象とする

---

## Requirements

### Requirement 1: ワークフロー網羅性の棚卸し

**Objective:** リポジトリ管理者として、`.github/workflows/` 配下の全ワークフローが `cicd-pipeline` spec の設計意図を過不足なく実装していることを確認したい。これにより、設計と実装の間に生じたドリフト（trigger 条件の齟齬、job 名の不一致、意図しない未カバー領域）を発見できる。

#### Acceptance Criteria

1. When the audit process reviews `frontend-ci.yml`, it shall verify that the `pull_request` and `push` triggers' `paths` filters cover all files that affect the build output (`frontend/**` and the workflow file itself).
2. When the audit process reviews `frontend-ci-dummy.yml`, it shall verify that its `job.name` values (`type-check / lint / test / build`, `deploy preview (Workers)`) exactly match the corresponding job names in `frontend-ci.yml`, since branch protection required status checks match by context name string.
3. When the audit process reviews `directus-schema-sync.yml` and `additive-schema-check.yml`, it shall verify that both workflows detect changes to `directus/schema/snapshot.yaml` using an equivalent diff method (`git diff` against base/previous commit) and do not diverge in what they consider a "changed" schema.
4. If a workflow references a script or file path that does not exist in the repository (e.g. `frontend/scripts/check-additive-schema.ts`), then the audit process shall report it as a broken reference requiring remediation.
5. The audit process shall produce a written inventory mapping each required status check name (as configured in branch protection) to the workflow file and job that produces it.

---

### Requirement 2: 型チェック・lint・test 失敗時のマージブロックと branch protection の整合性

**Objective:** 開発者として、型チェック・lint・format・test のいずれかが失敗した PR が `main` にマージされないことを、実際の branch protection 設定によって保証されていることを確認したい。

#### Acceptance Criteria

1. The audit process shall fetch the current `main` branch protection configuration via `gh api repos/aramakisai/aramakisai-web/branches/main/protection` and compare `required_status_checks.contexts` against the actual job names produced by `frontend-ci.yml`/`frontend-ci-dummy.yml`.
2. If any of `pnpm type-check`, `pnpm lint`, `pnpm format:check`, or `pnpm test` steps are not part of a job listed in `required_status_checks.contexts`, then the audit process shall flag this as a gap, since a failing step in a non-required job would not block merge.
3. While `enforce_admins.enabled` is `true`, the audit process shall verify that `bypass_pull_request_allowances` (individual user/team bypass of review requirement) does not also bypass required status checks, since GitHub applies these as independent settings.
4. If `required_status_checks.strict` is `false`, then the audit process shall document the implication (a PR can merge with an out-of-date base branch even if checks passed on an older commit) and assess whether this is acceptable given the repository's merge cadence.
5. The audit process shall verify that `required_conversation_resolution` and other non-status-check protections do not conflict with the workaround implemented in `frontend-ci-dummy.yml`.

---

### Requirement 3: fork PR での secret 非露出

**Objective:** セキュリティ担当者として、fork からの Pull Request に対して `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` 等のリポジトリ secrets が一切渡らないことを確認したい。

#### Acceptance Criteria

1. When the audit process reviews `frontend-ci.yml`'s `validate` job, it shall verify that this job does not reference any `secrets.*` context, so that fork PRs (which GitHub Actions restricts to a read-only, secret-less token) can run it safely.
2. The audit process shall verify that the `deploy-preview` and `deploy-prod` jobs, which reference `secrets.INFISICAL_CLIENT_ID`/`secrets.INFISICAL_CLIENT_SECRET`, are gated by a condition that excludes fork PRs (e.g. `github.event.pull_request.head.repo.fork == false`).
3. If any job triggered by the `pull_request` event (as opposed to `pull_request_target`) references repository secrets without a fork-exclusion condition, then the audit process shall flag it as a secret-exposure risk, since a malicious fork PR could otherwise modify workflow-invoked scripts to exfiltrate the secret.
4. The audit process shall verify that no workflow in scope uses the `pull_request_target` event, since that event grants write-token/secret access while checking out untrusted fork code — a known supply-chain risk pattern.
5. The audit process shall verify that no step logs, echoes, or writes to a world-readable artifact/cache the value of `INFISICAL_TOKEN`, `INFISICAL_UNIVERSAL_AUTH_CLIENT_ID/SECRET`, or any value derived from them (e.g. the GitHub App private key fetched in `directus-schema-sync.yml`).

---

### Requirement 4: preview/prod デプロイの権限分離

**Objective:** インフラ管理者として、staging（preview）と prod へのデプロイジョブが異なる trigger 条件・異なる最小権限で分離されており、PR からの操作が prod に影響しないことを確認したい。

#### Acceptance Criteria

1. The audit process shall verify that `deploy-preview` in `frontend-ci.yml` triggers only on `pull_request` events targeting non-fork PRs, and `deploy-prod` triggers only on `push` events to `main`, with no trigger condition allowing a PR to invoke the prod deploy path.
2. The audit process shall verify that each job's `permissions:` block follows least privilege (e.g. `deploy-prod` declares only `contents: read` while `deploy-preview` additionally declares `pull-requests: write` for posting the preview URL comment, and neither declares broader permissions than needed).
3. While `deploy-preview` and `deploy-prod` both fetch Infisical credentials via the same `INFISICAL_CLIENT_ID`/`SECRET` GitHub Actions secrets, the audit process shall verify that the Infisical environment slugs (`--env=staging` vs `--env=prod`) used at runtime correctly scope which downstream secrets (Cloudflare tokens, `NEXT_PUBLIC_DIRECTUS_URL`, etc.) each job can read, so that a preview build cannot obtain prod-only values.
4. If a single Infisical machine identity (`INFISICAL_CLIENT_ID`/`SECRET`) has read access to both `staging` and `prod` Infisical environments, then the audit process shall document this as an accepted risk or recommend splitting into separate machine identities scoped per environment.
5. The audit process shall verify that `directus-schema-sync.yml`'s GitHub App token (used to open PRs against `aramakisai-infra`) is scoped only to `aramakisai-infra` and only to `contents:write`/`pull-requests:write`, with no broader org-level permission.

---

### Requirement 5: その他の抜け漏れ棚卸し

**Objective:** リポジトリ管理者として、上記の観点に限らず、既存 CI パイプライン全体に存在しうるその他の抜け漏れ（サードパーティ Action のバージョン固定、想定外の trigger、リソース増殖等）を発見したい。

#### Acceptance Criteria

1. The audit process shall check whether third-party Actions used in the workflows (e.g. `pnpm/action-setup`, `peter-evans/find-comment`, `peter-evans/create-or-update-comment`, `actions/create-github-app-token`) are pinned to a version tag (`@v4` 等) versus a full commit SHA, and document the supply-chain trade-off given the repository-level `sha_pinning_required` is currently `false`.
2. The audit process shall verify that `directus-schema-sync.yml`'s branch-creation logic (`directus-schema-${SHA8}`) cannot create duplicate branches/PRs when the workflow is re-run (e.g. via `workflow_dispatch` or a retried job) for the same commit.
3. If `additive-schema-check.yml` and `directus-schema-sync.yml` both act on schema changes but with different trigger events (`pull_request` vs `push to main`), the audit process shall verify there is no window in which a breaking schema change could reach `main` without having been checked by `additive-schema-check.yml` first (e.g. via direct push, or a PR that alters `snapshot.yaml` after the check last ran).
4. The audit process shall verify that `frontend-ci-dummy.yml`'s `detect` job cannot be made to falsely report `changed=false` for a PR that actually touches `frontend/**`, since that would let unreviewed frontend code report a passing dummy check instead of running the real validation.
5. When the audit uncovers a concrete gap under Requirements 1–5, the audit process shall record it as an actionable remediation item (a specific workflow diff or `gh api` branch-protection change) rather than only as a narrative finding, so that `/kiro:spec-design` can turn it directly into an implementable task.
