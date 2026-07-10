# Gap Analysis: ci-pipeline-audit

## 前提の注意

`.kiro/steering/` にファイルが存在しない（product.md / tech.md / structure.md 未整備）。プロジェクト全体のアーキテクチャ方針が steering として明文化されていないため、以下の分析は `CLAUDE.md`、既存 workflow ファイル、既存テストスイート、および `gh api` で取得した現在の実際のリポジトリ設定のみに基づく。steering 整備を推奨するが、本分析をブロックするものではない。

## 1. 現状調査サマリ

### 既存資産（想定より充実）

`cicd-pipeline` spec は単に workflow YAML を実装しただけでなく、**workflow の構造自体を検証する vitest スイートを frontend/ 配下に確立済み**である。これは今回の監査要件の多くを実質的に先取りしている。

- `frontend/*.workflow.test.ts`（5 ファイル）: 各 workflow YAML を `yaml` パッケージでパースし、trigger・permissions・job 依存関係・secrets 参照有無を構造的に検証。
  - `frontend-ci.workflow.test.ts`: trigger、`pnpm` ステップ順序、dummy env、cache、`permissions: contents: read`、**secrets 非参照（fork 安全性）を明示的にテスト済み**（Requirement 3.1 相当）
  - `frontend-ci-deploy.workflow.test.ts`: `deploy-preview`/`deploy-prod` の `needs: validate` 依存、fork 除外条件、Infisical env 分離（staging/prod）、prod job が `wrangler deploy` を呼ばない preview job との差分、secrets の参照範囲を検証済み（Requirement 4.1, 4.2 相当）
  - `frontend-ci-dummy.workflow.test.ts`: dummy workflow の job 名が実ワークフローと完全一致すること、`detect` job の diff ロジック、`permissions: contents: read` を検証済み（Requirement 1.2, 5.4 相当）
  - `directus-schema-sync.workflow.test.ts`: GitHub App 認証、Infisical 経由の credential 取得、ConfigMap 生成、ブランチ重複防止、PR 重複防止、additive-only チェックリスト埋め込みを検証済み（Requirement 5.2 相当）
  - `additive-schema-check.workflow.test.ts`: `fetch-depth: 0`、diff gate、secrets 非参照、`permissions: contents: read`、bypass 不可を検証済み（Requirement 1.3, 3.1 相当）
- `frontend/pipeline-integration.test.ts`: 複数 workflow を横断する統合的性質（"every deploy job depends on validate"、"secrets on pull_request は non-fork gated"、snapshot diff 検出のシミュレーション、infra PR の冪等性）を検証。**Requirement 3.2/3.3, 5.2/5.3 の多くを既にカバー**。
- `frontend/generated-manifests.test.ts`: 生成される ConfigMap の内容、GitHub App トークンのスコープ最小権限（`aramakisai-infra` のみ、`contents:write`+`pull-requests:write` のみ）を検証済み（Requirement 4.5 相当）。
- `frontend/scripts/check-additive-schema.ts` + `check-additive-schema.test.ts`: 破壊的変更検知ロジック本体とその単体テスト。参照切れなし（Requirement 1.4 は該当なし）。

### 実際の GitHub 設定（`gh api` で実測、テストではカバーされない領域）

- `gh api repos/aramakisai/aramakisai-web/branches/main/protection` の実測値:
  - `required_status_checks.contexts`: `["type-check / lint / test / build", "deploy preview (Workers)"]` の **2 件のみ**
  - `additive-schema-check.yml` の job 名 `Detect breaking snapshot.yaml changes` は **contexts に含まれていない**
  - `enforce_admins.enabled: true`
  - `required_pull_request_reviews`: `required_approving_review_count: 1`, `dismiss_stale_reviews: true`, `bypass_pull_request_allowances.users: [tom1022]`
  - `required_status_checks.strict: false`
  - `required_conversation_resolution: false`
- `gh secret list`: `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` の 2 件のみ（`repo-governance` Requirement 2.2 と一致）
- `gh api repos/aramakisai/aramakisai-web/actions/permissions`: `sha_pinning_required: false`
- 全 workflow の `uses:` はすべてタグ参照（`@v4`, `@v3`, `@v1`）で、commit SHA 固定は 1 件も無い

### 慣習・制約

- workflow の構造検証は「YAML を静的パースして vitest でアサートする」パターンに統一されている（`frontend/*.workflow.test.ts`）。実際の GitHub 側の動的設定（branch protection, secrets 一覧, Actions permissions）を検証するテストは **存在しない** — これは静的ファイルではなく `gh api` 経由でしか取得できない外部状態であるため、既存パターンでは原理的にカバーできない領域。
- CI 実行環境は GitHub-hosted `ubuntu-latest` のみ。self-hosted runner は無い。

## 2. 要件フィージビリティ分析

| 要件 | 技術ニーズ | ギャップ種別 |
|---|---|---|
| R1.1–1.3: workflow 網羅性・job名整合・schema diff整合 | 静的 YAML 検証 | **既存カバー**（`*.workflow.test.ts` で実質検証済み。監査としては再確認のみで十分） |
| R1.4: 参照切れスクリプト検出 | ファイル存在確認 | **該当なし**（`check-additive-schema.ts` 存在確認済み、切れなし） |
| R1.5: 必須ステータスチェック棚卸し一覧 | branch protection `contexts` と job 名の対応表 | **Missing**（成果物として棚卸し表自体が存在しない。設計フェーズで作成） |
| R2.1–2.2: 型チェック等失敗とマージブロックの整合 | `gh api` 実測と job 名の突合 | **Missing → 具体的ギャップを発見済み**: `additive-schema-check.yml` の job (`Detect breaking snapshot.yaml changes`) が `required_status_checks.contexts` に含まれていない。つまり破壊的スキーマ変更チェックが失敗しても現状 **PR はマージ可能**（レビュー承認さえあれば）。これは Requirement 5.3（破壊的変更が防御なく main に到達しうる window）に直結する実害あるギャップ |
| R2.3: bypass allowance と status check の独立性 | GitHub 仕様の確認 | **Constraint（仕様上の既知事実）**: `bypass_pull_request_allowances` はレビュー承認要件のみを bypass し、`required_status_checks` には影響しない（GitHub 公式仕様）。実害なし、ドキュメント化のみで十分 |
| R2.4: `strict: false` の影響評価 | 運用判断 | **Unknown / Research Needed**: 現在の PR マージ頻度・コンフリクト率から `strict: true` に変更する価値があるか判断材料が無い。設計フェーズで運用者に確認するか、変更コストが低いので保守的に `true` 化を提案するかを決める |
| R3.1–3.5: fork PR secret非露出 | 静的 YAML 検証 + pull_request_target 不使用確認 | **既存カバー**（`frontend-ci.workflow.test.ts`, `additive-schema-check.workflow.test.ts`, `pipeline-integration.test.ts` で実質検証済み。`pull_request_target` は全 workflow で不使用を目視確認済み） |
| R4.1–4.2: preview/prod trigger・permissions分離 | 静的 YAML 検証 | **既存カバー**（`frontend-ci-deploy.workflow.test.ts`） |
| R4.3–4.4: Infisical env スコープの実際の権限境界 | Infisical 側の環境別 read 権限設定（リポジトリ外部の状態） | **Unknown / Research Needed**: `INFISICAL_CLIENT_ID`/`SECRET` が単一マシンアイデンティティで staging/prod 両方の環境を読めるか、Infisical プロジェクト側の権限設定を見ないと判定不可（本リポジトリの範囲外の情報。Infisical ダッシュボードでの確認が必要） |
| R4.5: GitHub App スコープ最小権限 | 静的検証 | **既存カバー**（`generated-manifests.test.ts`） |
| R5.1: Action の SHA pin | 静的確認 | **Missing → 具体的ギャップを発見済み**: 全 `uses:` がタグ参照。`sha_pinning_required: false`。サプライチェーンリスクとして是正候補（ただし drift の大きい `pnpm/action-setup`, `actions/*` 等の更新運用コストとのトレードオフがあるため「即是正」ではなく「トレードオフの明文化 or 主要 Action のみ pin」を設計フェーズで選択） |
| R5.2: ブランチ/PR 重複防止 | 静的検証 | **既存カバー**（`directus-schema-sync.workflow.test.ts`, `pipeline-integration.test.ts`） |
| R5.3: additive-check と schema-sync のタイミング window | branch protection 実測 | R2.1–2.2 と同一ギャップ（重複記載だが要件上は別Acceptance Criteria）。**Missing** |
| R5.4: dummy workflow のなりすまし耐性 | 静的検証 | **既存カバー**（`frontend-ci-dummy.workflow.test.ts` が diff ロジック自体をテスト。ただし diff ロジックは `git diff` ベースであり、フォーク元 base ref が改ざんされるケースは考慮外 — 下記 Research Needed 参照） |
| R5.5: 是正項目の具体化 | ドキュメント成果物 | 設計フェーズの成果物そのもの |

### Research Needed（設計フェーズへ持ち越し）

1. **`additive-schema-check.yml` を必須ステータスチェックに追加する際の job 名確定**: 現在の job 名 `Detect breaking snapshot.yaml changes` をそのまま `required_status_checks.contexts` に追加してよいか、`gh api` の 422（存在しない context 名）を避けるため、実際に一度 PR を通して context 名が GitHub 側に登録されるのを確認してから追加する必要がある（`repo-governance` design.md の既知の注意点と同じ制約）。
2. **`frontend-ci-dummy.yml` と同様の「非該当 PR で永久 pending」問題が `additive-schema-check.yml` にもあるか**: 現在 `additive-schema-check.yml` は `paths: directus/schema/snapshot.yaml` の path filter を持つため、スキーマ変更を含まない PR では発火しない。これを必須ステータスチェックにすると、`frontend-ci.yml` と全く同じ「path filter 非該当 PR が永久 pending になる」問題が再発する可能性が高い。是正には `frontend-ci-dummy.yml` と同様の dummy 回避策を `additive-schema-check` 用にも複製する必要があるか、設計フェーズで検討要。
3. **Infisical 側のプロジェクト環境権限**（staging/prod の read 権限分離）は本リポジトリの情報だけでは判定不可。Infisical ダッシュボード or `infisical` CLI での確認が必要（担当者への確認事項として設計フェーズに記載）。
4. **`strict: false` を `true` に変更するかどうかの運用判断**: 変更自体は `gh api` 一発だが、PR のマージ頻度・main の更新頻度次第で「PR のたびに再実行待ちが発生する」体験コストが生じる。ユーザー（運用者）の希望を設計フェーズで確認するか、変更を "推奨するが必須としない" 扱いにするかの判断が必要。
5. **SHA pinning の適用範囲**: 全 Action を SHA pin すると更新運用コストが増える。`actions/*` 公式 Action は影響小さいが、`peter-evans/*` のような非公式 Action のみ SHA pin する段階的アプローチも選択肢としてありうる。

## 3. 実装アプローチ選択肢

本監査の是正実装は「新機能追加」ではなく「既存 workflow ファイルへの diff」「`gh api` による外部設定変更」「（必要なら）新規テストの追加」の 3 種類に限られる。

### Option A: 発見済みギャップの直接是正のみ（最小差分）

- `gh api repos/aramakisai/aramakisai-web/branches/main/protection` を `PUT` し、`required_status_checks.contexts` に additive-schema-check の job context を追加。
- `strict`, SHA pinning 等は今回のスコープでは変更せず、リスクとして design.md にドキュメント化するに留める。
- ✅ 変更範囲が最小、レビューコストが低い。
- ✅ 既存テストスイートとの整合を壊さない。
- ❌ `additive-schema-check.yml` の path filter 問題（Research Needed 2）を同時に解決しないと、スキーマ変更を含まない PR が永久 pending になり、`frontend-ci-dummy.yml` の時と同じ障害を再発させるリスクが高い。

### Option B: 発見済みギャップ + path filter 問題の同時是正

- Option A の branch protection 変更に加え、`additive-schema-check.yml` 用の dummy workflow（例: `additive-schema-check-dummy.yml`）を `frontend-ci-dummy.yml` と同一パターンで新規作成し、スキーマ変更を含まない PR でも同名 context を success 報告する。
- ✅ Requirement 2/5.3 のギャップを実害なく完全に解消できる。
- ✅ 既存の `frontend-ci-dummy.yml` パターンを再利用するため設計上の新規性が低い。
- ❌ workflow ファイルが 1 つ増え、`frontend-ci-dummy.yml` との重複ロジック（diff 検出パターン）が増える保守コスト。将来 3 つ目の path-filter 付き必須チェックが増えると同じパターンをまた複製することになる。

### Option C: 共通化された「path-filter dummy」の抽象化 + 是正

- `frontend-ci-dummy.yml` と新設する additive-schema-check 用 dummy を、reusable workflow（`workflow_call`）または composite action に共通化してから両方に適用する。
- ✅ 将来同種の必須チェックが増えても再利用可能、保守性が高い。
- ❌ 本監査のスコープ（既存実装の監査・補完）を超えるリファクタリングであり、Boundary Context の「新規 CI/CD 機能の追加設計は対象外」という制約に抵触しうる。過剰設計のリスク。

## 4. 実装複雑度・リスク評価

| 項目 | Effort | Risk | 根拠 |
|---|---|---|---|
| branch protection への additive-check context 追加（Option A 部分） | S（1日未満） | Low | `gh api` 1コールだが、事前に該当 context が GitHub 側に一度登録されている必要あり（既存パターンで確認済みの手順） |
| additive-schema-check 用 dummy workflow 新規作成（Option B） | S〜M（1–3日） | Medium | パターン自体は既存流用だが、`frontend-ci-dummy.workflow.test.ts` 相当の新規テストと、実際に「スキーマ変更あり/なし」両方の PR で動作確認する検証コストがある |
| SHA pinning 適用（Requirement 5.1 是正） | S〜M | Low〜Medium | 対象 Action 数は少ない（8種）が、pin 後の Dependabot/Renovate 等の更新運用が未整備だと固定版が陳腐化するリスク |
| `strict: true` への変更検討 | S | Low | 設定変更自体は容易。運用影響（頻繁な再実行待ち）はチームに確認が必要 |
| 棚卸し表（Requirement 1.5）のドキュメント化 | S | Low | 本分析で概ね材料は揃っている |

## 5. 設計フェーズへの推奨

- **推奨アプローチ**: Option B（発見済みギャップの是正 + additive-schema-check 用 dummy workflow の追加）。Option C の共通化は現時点では過剰設計と判断し見送りを推奨するが、design.md で「将来の共通化候補」として記録することを提案する。
- **確定している鍵となる決定事項**:
  1. `additive-schema-check.yml` の job context (`Detect breaking snapshot.yaml changes`) を `required_status_checks.contexts` に追加する（実害のある唯一のギャップ）。
  2. それに伴い path-filter 非該当 PR での永久 pending を防ぐ dummy workflow を追加する。
  3. SHA pinning・`strict`・Infisical 環境分離は「是正必須」ではなく「監査所見としてドキュメント化し、対応要否をチームに委ねる」扱いとする（過剰是正を避ける）。
- **持ち越す Research 項目**（上記 Research Needed 1–5 を再掲、設計フェーズで解消する）。
