# Requirements Document

## Project Description (Input)
Directus スキーマの additive-only ルールを CI で自動検証する仕組み。directus-schema-sync ワークフローで snapshot.yaml の差分を検出し、collection/field 削除・型変更等の破壊的変更が含まれる PR を自動検知してブロックまたは警告する。現状は additive-only ルールが CLAUDE.md 上の運用ルールとして明文化されているのみで、CI による自動チェックが存在しない。

## Introduction
本機能は、`directus/schema/snapshot.yaml` に対する変更を含む PR に対して、CI 上で additive-only ルール（collection/field の追加のみ許容し、削除・型変更等の破壊的変更を禁止する）を自動検証する仕組みを提供する。現状この検証はレビュー担当者の目視確認に依存しており、見落としによって破壊的変更が誤って main にマージされ、本番 Directus DB や既にデプロイ済みのフロントエンドコードに影響するリスクがある。CI チェックにより、破壊的変更を機械的に検出し、PR の時点で可視化する。

## Boundary Context
- **In scope**: `directus/schema/snapshot.yaml` を変更する PR を対象に、base ブランチ（main）との差分から collection の削除・field の削除・field の型 (`type` / `schema.data_type`) の変更・`schema.is_nullable` の `true → false` への変更（NOT NULL 化）を検出し、検出結果を PR 上に可視化する。
- **Out of scope**: `directus/migrations/**` 配下のカスタムマイグレーションスクリプトの内容検証、Directus への実際の schema apply 処理、relations（リレーション定義）の詳細な整合性検証、破壊的変更の自動修復。
- **Adjacent expectations**: 本チェックは既存の `directus-schema-sync.yml`（main への push 時に infra リポジトリへ ConfigMap を同期する）とは独立した PR 契機のワークフローとして動作し、既存ワークフローの挙動・トリガーは変更しない。破壊的変更が周知済みで許容される場合の例外運用（CLAUDE.md 記載のチーム周知フロー）と矛盾しないよう、チェックは「警告 + 必須ステータスチェックとしてブロック」を基本としつつ、正当な破壊的変更を人手で通過させる手段（レビュアーによる明示的な承認等）を妨げない。

## Requirements

### Requirement 1: 破壊的変更の検出トリガー
**Objective:** As a フロントエンド/インフラ開発者, I want snapshot.yaml を変更する PR で自動的にスキーマ差分チェックが実行される, so that レビュー時に破壊的変更の有無を毎回手動確認しなくて済む

#### Acceptance Criteria
1. When `directus/schema/snapshot.yaml` を変更する pull request が作成または更新される, the Schema Additive Check ワークフロー shall base ブランチの snapshot.yaml と PR ブランチの snapshot.yaml を比較する差分チェックを実行する
2. If pull request が `directus/schema/snapshot.yaml` を変更していない, then the Schema Additive Check ワークフロー shall スキーマ差分チェックをスキップする
3. The Schema Additive Check ワークフロー shall pull_request イベント（opened, synchronize, reopened）をトリガーとして実行する

### Requirement 2: Collection の削除検出
**Objective:** As a インフラ担当者, I want collection の削除が検出される, so that 本番 DB に存在する collection が意図せず削除されるのを防げる

#### Acceptance Criteria
1. When base ブランチの snapshot.yaml に存在する collection が PR ブランチの snapshot.yaml に存在しない, the Schema Additive Check ワークフロー shall 当該 collection を破壊的変更として検出結果に含める
2. If 検出された collection 削除が1件以上存在する, then the Schema Additive Check ワークフロー shall チェック結果を failure として報告する

### Requirement 3: Field の削除検出
**Objective:** As a インフラ担当者, I want field の削除が検出される, so that 本番 DB のカラム削除によるデータ損失やフロントエンドの参照エラーを防げる

#### Acceptance Criteria
1. When base ブランチの snapshot.yaml のいずれかの collection に存在する field が、PR ブランチの snapshot.yaml の同一 collection に存在しない, the Schema Additive Check ワークフロー shall 当該 field を破壊的変更として検出結果に含める
2. If 検出された field 削除が1件以上存在する, then the Schema Additive Check ワークフロー shall チェック結果を failure として報告する

### Requirement 4: Field の型変更・NOT NULL 化の検出
**Objective:** As a インフラ担当者, I want field の型変更や NOT NULL 化などの破壊的なスキーマ変更が検出される, so that 既存データとの非互換や本番適用時のエラーを未然に防げる

#### Acceptance Criteria
1. When 同一 collection・同一 field の `type` または `schema.data_type` が base ブランチと PR ブランチで異なる, the Schema Additive Check ワークフロー shall 当該 field を破壊的変更として検出結果に含める
2. When 同一 collection・同一 field の `schema.is_nullable` が base ブランチで `true`、PR ブランチで `false` である, the Schema Additive Check ワークフロー shall 当該 field を破壊的変更として検出結果に含める
3. If 検出された型変更または NOT NULL 化が1件以上存在する, then the Schema Additive Check ワークフロー shall チェック結果を failure として報告する

### Requirement 5: 加算的変更の許容
**Objective:** As a フロントエンド/インフラ開発者, I want collection・field の新規追加のみを含む PR がチェックを通過する, so that 通常の機能追加開発がブロックされない

#### Acceptance Criteria
1. When PR の snapshot.yaml 差分が collection の追加・field の追加のみで構成される, the Schema Additive Check ワークフロー shall チェック結果を success として報告する
2. Where field の meta 情報（note、display_template 等の説明的メタデータ）のみが変更されている, the Schema Additive Check ワークフロー shall 当該変更を破壊的変更として扱わない

### Requirement 6: 検出結果の可視化とブロック
**Objective:** As a PR レビュアー, I want 検出された破壊的変更の内容が PR 上で確認できる, so that マージ判断や周知の要否をレビュー時点で判断できる

#### Acceptance Criteria
1. When Schema Additive Check ワークフローが破壊的変更を検出する, the Schema Additive Check ワークフロー shall 検出された collection 名・field 名・変更種別（削除／型変更／NOT NULL 化）を一覧化した結果を GitHub Actions の実行結果に出力する
2. If チェック結果が failure である, then the Schema Additive Check ワークフロー shall 対象 pull request のステータスチェックを failure とする
3. While チェック結果が failure の状態にある, the Schema Additive Check ワークフロー shall 破壊的変更が CLAUDE.md の周知フローに従って許容されたことをレビュアーが確認できるまで、当該ステータスチェックを success に変化させない
