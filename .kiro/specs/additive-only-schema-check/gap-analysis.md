# Gap Analysis: additive-only-schema-check

## 前提の注意

`.kiro/steering/` にファイルが存在しない（product.md / tech.md / structure.md 未整備）。プロジェクト全体のアーキテクチャ方針・技術選定方針が steering として明文化されていないため、以下の分析は CLAUDE.md と既存コード（ワークフロー・スキーマファイル・テスト）から得られる情報のみに基づく。steering 整備を推奨するが、本分析をブロックするものではない。

## 1. 現状調査サマリ

### 既存資産
- `.github/workflows/directus-schema-sync.yml`: `push`(main) トリガー、`git diff --name-only HEAD^ HEAD` で snapshot.yaml 変更検出 → infra リポジトリへ ConfigMap 同期 PR を作成。**push イベント限定**であり、PR コンテキストでの base/head 比較パターンは存在しない。
- `directus/schema/snapshot.yaml`（3786行）: Directus 標準スキーマスナップショット形式。
  - トップレベルに `collections:`（collection 単位のメタ情報、`fields` 個々の定義は含まない）
  - `fields:`（全 collection 横断のフラット配列。各要素は `collection`, `field`, `type`, `meta.*`, `schema.*` を持つ。`schema.data_type`, `schema.is_nullable` が破壊的変更判定に必要な実データ）
  - `relations:`
  - → 要件 2〜4 が参照する `collection`削除/`field`削除/`type`・`schema.data_type`変更/`schema.is_nullable: true→false` は実データ構造と整合している（要件はスキーマ実体を正しく踏まえている）。
- `frontend/*.workflow.test.ts`（例: `directus-schema-sync.workflow.test.ts`, `frontend-ci.workflow.test.ts`, `frontend-ci-deploy.workflow.test.ts`）: vitest + `yaml` パッケージでワークフロー YAML 自体をパースし、steps/permissions/trigger の構造を検証する社内パターンが確立済み。ただし「スキーマ差分ロジック自体」の単体テスト例はまだない（既存ワークフローは単純な `git diff --name-only` のみで複雑な構造比較をしていない）。
- `frontend/package.json`: devDependency に `yaml@^2.9.0`, `vitest@^3.0.0` が既にある。ルート（リポジトリ直下）には package.json が存在しない＝Node ツールチェーンは frontend/ 配下にのみ存在。
- ローカル環境には `yq`（mikefarah/yq）バイナリと Python3+PyYAML が利用可能だが、いずれもこのリポジトリの既存 CI ステップでは未使用（新規導入になる）。

### 慣習・制約
- ワークフローファイルは `.github/workflows/*.yml`、対応する構造テストは `frontend/<workflow-name>.workflow.test.ts` に置く命名慣習。
- `directus/` と `frontend/` は責務分離されている（docker-compose, migrations, schema は directus/ 配下、Node/pnpm 依存は frontend/ 配下）。
- 既存ワークフローは `permissions: contents: read` を基本とし最小権限。フォーク PR でも安全に動く設計（frontend-ci.yml のコメント参照）。

## 2. 要件フィージビリティ分析

| 要件 | 技術ニーズ | ギャップ種別 |
|---|---|---|
| R1: PR トリガー + snapshot.yaml 変更検知 | `pull_request` イベント（opened/synchronize/reopened）+ base/head 比較。shallow checkout では base ref 履歴が無い可能性 | **Missing** + **Constraint**（fetch-depth 設計が必要） |
| R2: collection 削除検出 | `collections[].collection` の集合差分（base − head） | **Missing**（新規ロジック） |
| R3: field 削除検出 | `fields[]` を `(collection, field)` キーで集合差分 | **Missing**（新規ロジック） |
| R4: type/data_type 変更・NOT NULL化検出 | 同一 `(collection, field)` ペアで `type`, `schema.data_type`, `schema.is_nullable(true→false)` のみ比較。他の `schema.*`（default_value, is_indexed 等）や `meta.*` は無視 | **Missing**（新規ロジック、フィールド単位の許可/禁止属性リストの設計が必要） |
| R5: 加算的変更の許容（meta のみの変更は非破壊） | 上記と同じロジックの裏返し。誤検知（false positive）を避ける設計が要 | **Missing**（テストケース設計が重要） |
| R6.1-6.2: 検出結果の可視化 + ステータスチェック failure | GitHub Actions のジョブ失敗 + サマリ出力（`$GITHUB_STEP_SUMMARY` 等） | **Missing**（技術自体は GitHub Actions 標準機能、実装は容易） |
| R6.3: 人手承認後も自動で success に変えない旨の維持 | 「レビュアーが確認できるまで」の確認手段（ラベル？ブランチ保護の admin bypass？）が要件文からは自動化トリガーとして規定されていない | **Unknown / Research Needed**（設計フェーズで承認フロー docs化が必要。既存 CLAUDE.md の「周知フロー」は人間手続きであり、CI 側で新規に何かを検知する仕組みは要件に明記されていない可能性） |

### Research Needed（設計フェーズへ持ち越し）
1. PR イベントでの base snapshot 取得方法（`actions/checkout` の `fetch-depth`、または `git show origin/<base_ref>:path` の可否、fork PR での base ref アクセス権）。
2. R6.3 の「reviewer 確認」を CI が能動的に検知する仕組みが必要か、それとも「failure のまま維持し、必要なら人間が branch protection 越しにマージする（admin bypass）」で要件を満たすのか（要件はどちらとも取れる書き方）。
3. 破壊的変更の許容例外運用（CLAUDE.md記載のチーム周知フロー）と CI をどう連携させるか（例: 特定ラベルが付与されたら結果表示に注記を出すが failure は維持する、等）。

## 3. 実装アプローチ選択肢

### Option A: frontend/ の既存 Node+vitest スタックを拡張
- diff ロジックを `frontend/scripts/check-additive-schema.ts`（または類似パス）に実装し、既存 devDependency の `yaml` を再利用。
- テストは既存の `*.workflow.test.ts` パターンを踏襲し `frontend/additive-only-schema-check.workflow.test.ts`（ワークフロー構造テスト）+ ロジック単体テスト（新規ファイル）を追加。
- ワークフローステップは `cd frontend && pnpm install --frozen-lockfile && pnpm exec tsx scripts/check-additive-schema.ts` 相当。
- ✅ 既存 CI パターン・lockfile・テストフレームワークをそのまま再利用、レビュアーにとって一貫した経験。
- ✅ 新規ツールチェーン導入不要。
- ❌ 概念的には `directus/` 領域の関心事だが `frontend/` パッケージグラフに結合される（責務分離の既存慣習と若干ずれる）。
- ❌ snapshot.yaml 変更のみの PR でも frontend 一式の pnpm install が走る（時間コスト。ただしパストリガーで頻度は限定的）。

### Option B: 独立した新規コンポーネント
- `directus/scripts/check_additive_schema.py`（Python3 + PyYAML、GH Actions ubuntu-latest には python3 標準搭載、`pip install pyyaml` のみで動く）または軽量な独立 Node パッケージ（`directus/` 配下に専用 package.json + `yaml` のみ依存）。
- ✅ `directus/` と `frontend/` の責務分離という既存慣習に忠実。
- ✅ CI 実行が軽量（frontend 一式のインストール不要）。
- ❌ Python を選ぶ場合、テストフレームワーク（pytest等）が本リポジトリに前例がなく、新規に確立する必要がある。
- ❌ 独立 Node パッケージにする場合、package.json/lockfile がもう一つ増え、CI に Node セットアップステップが重複する。

### Option C: ハイブリッド（directus/配下に独立 TS ミニパッケージ）
- 言語は既存の TS/vitest 資産と揃えつつ、`directus/scripts/` に**専用の**軽量 package.json（`yaml` + `vitest` のみ）を置き、frontend/ の依存グラフとは分離。
- ✅ 言語・テストフレームワークは社内で慣れた TS/vitest のまま。
- ✅ frontend への結合を避け、責務分離を維持。
- ❌ 管理対象の package.json/lockfile が増える。
- ❌ CI のセットアップステップ（Node/pnpm or npm セットアップ）がもう一系統必要になり、ワークフロー定義がやや複雑化。

## 4. Effort / Risk

- **Effort: M（3〜7日）**
  理由: 差分ロジック自体（collection/field 集合差分 + 属性比較）は複雑度は中程度だが、PR base/head 取得の checkout 設計、meta-only 変更を誤検知しないための丁寧なテストケース設計、R6.3 の承認フロー仕様確定が必要で、単純 CRUD より工数がかかる。
- **Risk: Medium**
  理由: 技術要素自体（YAML パース・集合比較・GitHub Actions PR トリガー）は既知パターンの応用で低リスクだが、(1) fork PR での base ref 取得可否、(2) R6.3 の承認フロー未確定、の2点が設計を左右する未解決点として残っており、詳細設計次第でスコープが変動しうる。

## 5. 設計フェーズへの推奨事項

- **推奨アプローチ**: Option A（frontend/ 拡張）を軸にしつつ、Option C も候補として設計レビューで比較検討することを推奨。理由: 既存の `*.workflow.test.ts` 慣習・`yaml` 依存・vitest 基盤が frontend/ に既に揃っており、新規ツールチェーン導入（Option B/C）のメンテナンスコストより、既存資産の再利用による立ち上げの速さ・レビュー一貫性を優先する価値が高いと考えられる。ただし「snapshot.yaml だけの変更で毎回 frontend 一式 install が走る」点をチームがどう評価するかは要確認。
- **設計フェーズで確定すべき事項**（Research Needed の繰り返し）:
  1. PR base スナップショット取得方式（checkout fetch-depth 戦略、fork PR 対応要否）
  2. R6.3 の「レビュアー確認」をどう実装するか（何もしない＝branch protection admin bypass 前提、 or ラベル等の明示的シグナルを追加するか）
  3. 破壊的変更の一覧化フォーマット（`$GITHUB_STEP_SUMMARY` の具体的な表形式）
  4. 比較対象から除外する `schema.*`/`meta.*` フィールドの正確なリスト（要件は type/data_type/is_nullableのみ言及、それ以外は非破壊として明示的に確定させる）

## 次のステップ

`/kiro:spec-design additive-only-schema-check` で技術設計に進める。上記 Research Needed 項目は設計ドキュメントで明示的に解決すること。
