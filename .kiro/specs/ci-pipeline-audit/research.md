# Research & Design Decisions: ci-pipeline-audit

## Summary
- **Feature**: `ci-pipeline-audit`
- **Discovery Scope**: Extension（既存 CI/CD 実装の事後監査・軽微な補完）— Light Discovery を実施
- **Key Findings**:
  - `cicd-pipeline` spec の実装は workflow YAML だけでなく、`frontend/*.workflow.test.ts` 5ファイル + 統合テスト2ファイルという「YAML 構造を静的検証するテストスイート」まで含んでおり、要件3（fork secret 非露出）・要件4（preview/prod 権限分離）・要件1の大半・要件5の一部は既にテストでカバー済みだった。
  - 唯一の実害あるギャップ: `gh api` で実測した `main` ブランチの `required_status_checks.contexts` に `additive-schema-check.yml` の job（`Detect breaking snapshot.yaml changes`）が含まれていない。破壊的スキーマ変更チェックが失敗してもレビュー承認さえあれば `main` にマージ可能な状態。
  - このギャップを是正する際、`additive-schema-check.yml` には `frontend-ci.yml` と同じ「path filter で発火しない PR は required check が永久 pending になる」問題が内在する（`paths: directus/schema/snapshot.yaml` の path filter があるため）。是正には `frontend-ci-dummy.yml` と同一パターンのダミー workflow が必要。
  - 副次発見: `additive-schema-check.yml` の `pull_request` トリガーには `branches:` 指定が無い（`frontend-ci.yml`/`frontend-ci-dummy.yml` は `branches: [main]` を指定）。main 以外を base とする PR でも発火する点は実害小さいが、他 workflow との一貫性を欠く。

## Research Log

### 既存テストカバレッジの棚卸し
- **Context**: requirements.md の各 Acceptance Criteria が「未検証の要監査項目」なのか「既に自動テストでカバー済み」なのかを切り分ける必要があった。
- **Sources Consulted**: `frontend/frontend-ci.workflow.test.ts`, `frontend/frontend-ci-deploy.workflow.test.ts`, `frontend/frontend-ci-dummy.workflow.test.ts`, `frontend/directus-schema-sync.workflow.test.ts`, `frontend/additive-schema-check.workflow.test.ts`, `frontend/pipeline-integration.test.ts`, `frontend/generated-manifests.test.ts`
- **Findings**:
  - fork PR での secret 非参照（3.1–3.5）: `frontend-ci.workflow.test.ts` の "never references repository secrets in validate" と `pipeline-integration.test.ts` の "any job referencing INFISICAL secrets on pull_request is gated on non-fork" で実質カバー済み。
  - preview/prod 分離（4.1, 4.2, 4.5）: `frontend-ci-deploy.workflow.test.ts`（trigger 分離・`needs: validate`・fork 除外・secrets 参照範囲）と `generated-manifests.test.ts`（GitHub App 最小権限）でカバー済み。
  - ブランチ/PR 重複防止（5.2）: `directus-schema-sync.workflow.test.ts` と `pipeline-integration.test.ts` の "idempotent infra PR" ブロックでカバー済み。
  - dummy workflow のなりすまし耐性（5.4）: `frontend-ci-dummy.workflow.test.ts` が diff ロジック・job 名一致を検証済み。診断: diff は GitHub が確定する `base.sha`/`head.sha` を用いるため、fork 側から改ざん不可能（攻撃者は自分の head しか制御できない）。
- **Implications**: 監査の設計フェーズで新規に作るべきものは「未カバーの領域」に絞られる。既存テストで担保済みの要件は、design.md の Requirements Traceability に「検証済み・ギャップなし」として記録するに留め、重複するテストコードは追加しない。

### `additive-schema-check.yml` の branch protection 実測ギャップ
- **Context**: Requirement 2.1/2.2/5.3 の検証のため、`main` の実際の branch protection 設定を取得。
- **Sources Consulted**: `gh api repos/aramakisai/aramakisai-web/branches/main/protection`
- **Findings**:
  - `required_status_checks.contexts`: `["type-check / lint / test / build", "deploy preview (Workers)"]`（2件のみ）
  - `additive-schema-check.yml` の job 名 `Detect breaking snapshot.yaml changes` が含まれていない
  - `enforce_admins.enabled: true`、`required_pull_request_reviews.bypass_pull_request_allowances.users: [tom1022]`、`required_status_checks.strict: false`
- **Implications**: 破壊的スキーマ変更検知が実装されていても、branch protection 側で required にしない限り「レビュー承認さえあればマージ可能」であり、additive-only ルール（CLAUDE.md）を CI が強制していない。是正が必要。

### `frontend-ci-dummy.yml` パターンの再利用可否
- **Context**: 上記ギャップを是正する際、`additive-schema-check.yml` に `paths:` フィルタがあるため、必須化すると「スキーマ変更を含まない PR で永久 pending」問題が再発する（`repo-governance` design.md が `frontend-ci.yml` に対して既に文書化した既知の GitHub 制約と同型）。
- **Sources Consulted**: `.github/workflows/frontend-ci-dummy.yml`, `frontend/frontend-ci-dummy.workflow.test.ts`
- **Findings**: 既存パターンは「無フィルタで全 PR にトリガーする dummy workflow が、`detect` job で本物のトリガー条件を再現した diff を計算し、`changed=false` の場合のみ同名 job を success 報告する」という構造。`additive-schema-check.yml` は単一 job（`check`、名前 `Detect breaking snapshot.yaml changes`）のみなので、複製すべきダミー job も1つで済む。
- **Implications**: 新規 `additive-schema-check-dummy.yml` を既存パターン踏襲で追加する（Option B、gap-analysis.md 参照）。共通化リファクタ（Option C）は本 spec のスコープ外として見送る。

### `additive-schema-check.yml` の `branches:` フィルタ欠落
- **Context**: workflow 網羅性棚卸し（Requirement 1）の一環で、他 workflow との trigger 条件の一貫性を確認。
- **Sources Consulted**: `.github/workflows/additive-schema-check.yml`, `.github/workflows/frontend-ci.yml`, `.github/workflows/frontend-ci-dummy.yml`
- **Findings**: `frontend-ci.yml`/`frontend-ci-dummy.yml` は `pull_request.branches: [main]` を明示するが、`additive-schema-check.yml` には無い。実害は小さい（main 以外への PR で無駄に実行されるだけ）が、一貫性を欠く。
- **Implications**: 低リスクの軽微な是正として、`additive-schema-check.yml` と新設する dummy 側の両方に `branches: [main]` を追加する。既存テスト（`additive-schema-check.workflow.test.ts`）にアサーションを追加する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: 発見済みギャップの直接是正のみ | branch protection の contexts 追加のみ | 変更範囲最小 | dummy workflow を伴わないと path-filter 非該当 PR が永久 pending になる（既知の GitHub 制約再発） | 単独では不採用 |
| B: ギャップ是正 + dummy workflow 追加（採用） | contexts 追加 + `additive-schema-check-dummy.yml` 新設 | 既存パターン(`frontend-ci-dummy.yml`)を忠実に再利用、永久 pending を防止 | workflow ファイルが1つ増える | 採用 |
| C: dummy パターンの共通化（reusable workflow化） | `workflow_call` や composite action で dummy ロジックを共通化 | 将来の同種チェック追加時の保守性向上 | 本 spec のスコープ（既存監査・補完）を超えるリファクタ、過剰設計 | 見送り。design.md の Non-Goals に記録 |

## Design Decisions

### Decision: additive-schema-check を required status check に追加する順序
- **Context**: `gh api` で存在しない context 名を `required_status_checks.contexts` に指定すると 422 エラーになる（`repo-governance` design.md に既知の注意点として記録済み）。
- **Alternatives Considered**:
  1. 先に branch protection を更新し、後から dummy workflow を追加する
  2. 先に dummy workflow（および実ワークフローの `branches` 修正）をマージして GitHub 側に context 名を一度登録させてから、branch protection を更新する
- **Selected Approach**: 2 を採用。
- **Rationale**: `repo-governance` design.md が `frontend-ci.yml`/`frontend-ci-dummy.yml` の導入時に採った手順と同じ順序制約であり、実績のあるパターン。
- **Trade-offs**: 手順が1ステップ増えるが、422 エラーによる作業中断を避けられる。
- **Follow-up**: tasks フェーズで「dummy workflow マージ → テスト PR で context 登録確認 → branch protection 更新」の順序を明示する。

### Decision: SHA pinning・`strict` フラグ・Infisical 環境分離は本 spec で是正しない
- **Context**: Requirement 5.1, 2.4, 4.3/4.4 は「監査で見つけた場合はドキュメント化」であり、修正必須とは要件上明記されていない。
- **Alternatives Considered**:
  1. 発見した全リスクをこの spec 内で修正する
  2. 実害のある1件（additive-schema-check の required 化）のみ修正し、他は文書化に留める
- **Selected Approach**: 2。
- **Rationale**: SHA pinning は運用コスト（Renovate/Dependabot 未整備のまま固定すると陳腐化する）とのトレードオフがあり即断できない。`strict: true` 化は PR マージ頻度への影響をチームに確認すべき事項。Infisical 環境分離はリポジトリ外部（Infisical プロジェクト設定）の情報であり本リポジトリの変更だけでは判定・是正不可能。
- **Trade-offs**: 監査の徹底度は下がるが、過剰是正・スコープ逸脱を避けられる（Boundary Context の「新規 CI/CD 機能の追加設計は対象外」に整合）。
- **Follow-up**: design.md の Risk Register に記録し、必要なら別 spec として起票する。

## Risks & Mitigations
- 是正後に `additive-schema-check.yml` の job 名を変更すると、branch protection の contexts 文字列と `additive-schema-check-dummy.yml` の job 名が同時にズレる — Revalidation Trigger として design.md に明記し、3箇所（実ワークフロー・dummy・branch protection）を常にセットで変更する運用ルールを徹底する。
- `enforce_admins: true` 適用済みのため、branch protection 更新後に一時的に該当 context が存在せず全 PR がマージ不能になる期間が発生しうる — dummy workflow を先にマージし、テスト PR で success を確認してから branch protection を更新することで回避する（Design Decision 参照）。
- SHA pinning 未適用のまま残すため、サードパーティ Action（`peter-evans/*` 等）が侵害された場合のサプライチェーンリスクは本 spec 完了後も残存する — Risk Register にドキュメント化し、対応要否を別途チームに委ねる。

## References
- `.kiro/specs/cicd-pipeline/design.md` — 元の CI/CD 設計意図（Requirement 7 のシークレット最小権限方針等）
- `.kiro/specs/repo-governance/design.md` — 既存 branch protection ベースラインと、`frontend-ci-dummy.yml` 導入時の 422 回避・適用順序の先例
- `.kiro/specs/ci-pipeline-audit/gap-analysis.md` — 本 spec の Gap Analysis（Option A/B/C の初期評価）
