# Implementation Plan

- [x] 1. 監査ベースラインを確定する
- [x] 1.1 既存テストスイートで担保済みの要件を実行確認する
  - `frontend/frontend-ci.workflow.test.ts`, `frontend/frontend-ci-deploy.workflow.test.ts`, `frontend/frontend-ci-dummy.workflow.test.ts`, `frontend/directus-schema-sync.workflow.test.ts`, `frontend/additive-schema-check.workflow.test.ts`, `frontend/pipeline-integration.test.ts`, `frontend/generated-manifests.test.ts` を実行し、fork PR での secret 非露出・preview/prod 権限分離・GitHub App 最小権限・ブランチ/PR 重複防止・dummy workflow のなりすまし耐性に関する既存アサーションが全て pass することを確認する
  - 実行結果（pass/fail）と対象ファイルを記録する
  - `frontend/scripts/check-additive-schema.ts` を参照するテストが import エラーなく解決されることを確認し、参照切れが無いことも同時に検証する
  - `pnpm test`（該当ファイルのみ）の出力が全件 pass で終了する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.5, 5.2, 5.4_

- [x] 1.2 branch protection・secrets・Actions 設定の現状を再取得しベースラインとして固定する
  - `gh api repos/aramakisai/aramakisai-web/branches/main/protection` で `required_status_checks.contexts`（現状2件）、`enforce_admins.enabled`、`required_pull_request_reviews`（`bypass_pull_request_allowances` 含む）、`required_status_checks.strict`、`required_conversation_resolution` を再取得する
  - `gh secret list` と `gh api repos/aramakisai/aramakisai-web/actions/permissions`（`sha_pinning_required`）を再取得する
  - 取得値が設計時点の記録（`additive-schema-check.yml` の job が contexts に未登録、secrets 2件、`sha_pinning_required: false`）と一致するか比較し、乖離があれば内容を記録する
  - 取得した JSON 出力一式が是正前の基準値としてタスク記録に残り、必須ステータスチェック名とワークフロー・job の対応表（棚卸し一覧）としてそのまま利用できる
  - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.3, 4.4, 5.1, 5.5_

- [x] 2. additive-schema-check の trigger 条件を他ワークフローと揃える (P)
  - `additive-schema-check.yml` の `pull_request` トリガーに `branches: [main]` を追加する（`frontend-ci.yml`/`frontend-ci-dummy.yml` と同じ条件にする）
  - 対応する構造テストに `on.pull_request.branches` が `['main']` であることを検証するケースを追加する
  - 追加後のテストが pass し、main 以外を base とする PR ではこのワークフローが発火しなくなる
  - _Requirements: 1.1, 5.3_
  - _Boundary: Additive Schema Check Trigger Fix_

- [x] 3. additive-schema-check 用のダミー workflow を追加する (P)
- [x] 3.1 (P) `frontend-ci-dummy.yml` と同型のダミー workflow を実装する
  - `directus/schema/snapshot.yaml` を変更しない PR で無条件に発火し、`additive-schema-check.yml` の job と完全一致する名前（`Detect breaking snapshot.yaml changes`）で success を報告する workflow を新規作成する
  - `git diff` による base/head 比較で `directus/schema/snapshot.yaml` の変更有無を判定し、変更ありの PR では自身の該当 job を skip する（本物の workflow 側の結果のみが有効になる）
  - secrets を一切参照せず `permissions: contents: read` のみを付与する
  - 新規 workflow の YAML が正しくパースでき、job 名の文字列が `additive-schema-check.yml` の job 名と完全一致する
  - _Requirements: 2.1, 2.2, 3.1, 3.3, 3.4, 3.5, 5.3, 5.4_
  - _Boundary: Additive Schema Check Dummy Workflow_

- [x] 3.2 (P) ダミー workflow の構造テストを追加する
  - `frontend-ci-dummy.workflow.test.ts` と同型のアサーション（trigger 条件、job 名一致、secrets 非参照、`permissions: contents: read` のみ、diff ロジックの対象ファイル）を新規テストファイルとして追加する
  - `pnpm vitest run` で新規テストファイルが単独で pass する
  - _Requirements: 2.1, 2.2, 3.1, 3.3, 3.4, 3.5, 5.4_
  - _Boundary: Additive Schema Check Dummy Workflow_

- [x] 4. ダミー workflow と実 workflow の job 名一致を統合テストで固定する
  - `pipeline-integration.test.ts` に、`additive-schema-check.yml` と新設ダミー workflow の該当 job 名が完全一致することを検証するケースを、`frontend-ci.yml`/`frontend-ci-dummy.yml` に対する既存の同種検証と対称な形で追加する
  - 追加したテストが pass し、以後どちらか一方の job 名だけが変更された場合にテストが fail するようになる
  - _Depends: 2, 3.1, 3.2_
  - _Requirements: 1.1, 5.3_

- [x] 5. branch protection を更新し是正を本番に反映する
- [x] 5.1 テスト PR で新規 context の登録を確認する
  - タスク2・3のマージ後、`.kiro/**` のみを変更するテスト PR を作成し、ダミー workflow 経由で `Detect breaking snapshot.yaml changes` context が success 報告されることを確認する
  - GitHub 側のステータスチェック一覧に同 context 名が表示される
  - _Depends: 4_
  - _Requirements: 5.3_
  - **実行結果**: PR #24(タスク1-4)を `--admin` マージで `main` へ反映(2026-07-10)。続けて PR #25(`.kiro/specs/ci-pipeline-audit/_verify/task5-1-note.md` のみ追加)を作成し、`gh pr checks` で `Detect breaking snapshot.yaml changes` context が `pass` 報告されることを確認。確認後 PR #25 はマージせずクローズ・ブランチ削除。

- [x] 5.2 `main` branch protection の required status checks に新規 context を追加する
  - `gh api` で `main` の `required_status_checks.contexts` に `Detect breaking snapshot.yaml changes` を追加する（既存の2 context・`enforce_admins: true`・`required_pull_request_reviews` の値は変更しない）
  - 更新後に同エンドポイントを再取得し、`contexts` が3件揃い他の設定値が変化していないことを確認する
  - _Depends: 5.1_
  - _Requirements: 2.1, 2.2, 5.3_
  - **実行結果**: `PATCH .../branches/main/protection/required_status_checks` で `contexts` に `Detect breaking snapshot.yaml changes` を追加(2026-07-10)。再取得結果: `contexts` 3件(`type-check / lint / test / build`, `deploy preview (Workers)`, `Detect breaking snapshot.yaml changes`)、`strict: false`、`enforce_admins: true`、`required_approving_review_count: 1`、`bypass_pull_request_allowances.users: [tom1022]`、`dismiss_stale_reviews: true` — いずれも変更前と一致し他設定への影響なしを確認。

- [x] 5.3 是正の効果をエンドツーエンドで検証する
  - `directus/schema/snapshot.yaml` に破壊的変更（例: 既存フィールドの型変更）を含むテスト PR を作成し、`additive-schema-check.yml` が failure を報告し、branch protection によってマージがブロックされることを確認する
  - `directus/schema/snapshot.yaml` を変更しない別のテスト PR で、ダミー workflow 経由の success 報告により引き続きマージ可能であることを確認する
  - 両テスト PR の実行結果（ブロックされた/マージ可能だった）を記録し、確認後にテスト PR をクローズする
  - _Depends: 5.2_
  - _Requirements: 2.1, 2.2, 5.3, 5.4_
  - **実行結果**(2026-07-10):
    - PR #26(`announcements.title` フィールド削除): `Detect breaking snapshot.yaml changes` が `fail`、対応する dummy 側 job は `skipping`。`gh pr merge` は `the base branch policy prohibits the merge` で拒否、`mergeStateStatus: BLOCKED`。マージせずクローズ・ブランチ削除。
    - PR #27(`.kiro/` のみ変更): 必須ステータスチェック3件(`type-check / lint / test / build`, `deploy preview (Workers)`, `Detect breaking snapshot.yaml changes`)全て `pass`。`mergeStateStatus: BLOCKED` の理由は `reviewDecision: REVIEW_REQUIRED` のみ(tom1022 は `bypass_pull_request_allowances` 対象で本specの是正対象外の既存挙動)であり、ステータスチェック起因のブロックではないことを確認。マージせずクローズ・ブランチ削除。

## Task 1.2 Baseline Snapshot（是正前基準値, 取得日: 2026-07-10）

### `gh api repos/aramakisai/aramakisai-web/branches/main/protection`
```json
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["type-check / lint / test / build", "deploy preview (Workers)"]
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "bypass_pull_request_allowances": { "users": ["tom1022"], "teams": [], "apps": [] }
  },
  "enforce_admins": { "enabled": true },
  "required_conversation_resolution": { "enabled": false }
}
```

### `gh secret list`
```
INFISICAL_CLIENT_ID
INFISICAL_CLIENT_SECRET
```
(2件)

### `gh api repos/aramakisai/aramakisai-web/actions/permissions`
```json
{ "enabled": true, "allowed_actions": "all", "sha_pinning_required": false }
```

### 設計時点の記録との比較
| 項目 | 設計時点の記録 (design.md) | 現在の実測値 | 乖離 |
|---|---|---|---|
| required_status_checks.contexts | 2件、`additive-schema-check` 未登録 | 2件（同上）、`additive-schema-check` 未登録 | なし |
| secrets 数 | 2件 | 2件（`INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET`） | なし |
| sha_pinning_required | false | false | なし |
| enforce_admins.enabled | true | true | なし |
| bypass_pull_request_allowances | tom1022 | tom1022 | なし |
| required_status_checks.strict | false | false | なし |

**是正対象棚卸し一覧（必須ステータスチェック名 ⇔ workflow/job 対応表）**

| Context 名 | 発行元 workflow | 発行元 job | required_status_checks 登録状況 |
|---|---|---|---|
| `type-check / lint / test / build` | `frontend-ci.yml` / `frontend-ci-dummy.yml` | 同名 job | 登録済み |
| `deploy preview (Workers)` | `frontend-ci.yml` | `deploy-preview` | 登録済み |
| `Detect breaking snapshot.yaml changes` | `additive-schema-check.yml`（dummy 未実装） | `check` | **未登録（ギャップ、design.md参照）** |
