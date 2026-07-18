# Requirements Document

## Project Description (Input)
サイトマップやデータベーススキーマについて再考したい

## Introduction
本 spec は、荒牧祭公式サイトの現行サイトマップ (実装済みルート) と Directus スキーマ (`directus/schema/snapshot.yaml` / `product.md` ドメインモデル) を棚卸しし、両者のギャップを特定した上で、情報アーキテクチャとスキーマの再設計方針を明文化することを目的とする。

現状、フロントエンドは `/` (トップ), `/about`, `/announcements` (一覧・個別), `/topics` (一覧・個別), `/[slug]` (`pages` 汎用固定ページ) を実装済みである一方、`product.md` のドメインモデルに定義されている `student_exhibitions` (学生模擬店), `sponsors` (協賛企業), `stages`/`performance_slots` (ステージ企画), `map_areas` (会場マップ), `time_slots` (時間割), `faq_items` (FAQ) には対応する表示面がフロントエンドに存在しない。本 spec ではこのギャップを構造的に洗い出し、追加すべきページ・ナビゲーション構成、および既存スキーマで表現可能な範囲/追加フィールドやコレクションが必要な範囲を判定する。

本 spec 自体は分析・設計判断を成果物とし、個別ページの実装や具体的な UI デザインは対象外とする (判定結果に基づく実装は別 spec に切り出す想定)。

加えて、サイトは本番未公開状態 (custom domain 未接続、一般告知前) であるため、本 spec の結果として破壊的スキーマ変更 (collection/field 削除・型変更) が必要になった場合に備え、additive-only ルールを機械強制する `additive-schema-check.yml` を公開前限定で一時停止する方針も本 spec の範囲に含める。

さらに、`student_exhibitions`/`sponsors`/`topics`/`festival_meta`/`page_home`/`page_home_live` の各 collection について、不要フィールドの削除・重複統合・フィールド名の英語表記による分かりにくさ・画像配信の非効率といった具体的な使い勝手上の課題が指摘された。特に `page_home`/`page_home_live` の 2-singleton 構成 (`festival_meta.home_active_variant` によるフェーズ切替、`page-home-friendly-editing` spec の中核設計) は、実運用上「開催前後でコンテンツをほとんど変えない」ため不要と判断され、`page_home` へ一本化する方針とする。本 spec はこれらの既存スキーマ改善要求についても、削除・統合・命名・表示方式の各観点で方針を明文化し、Requirement 6/7 の対応として実装まで行う。

なお `page_home` と `festival_meta` の統合は、ユーザーヒアリングの結果、本 spec の対象外 (役割分離を維持) とする。`page_home.hero_image` の複数化は本 spec の対象に含める一方、動画 (MP4/YouTube) 対応は将来検討事項として対象外のままとする。

## Boundary Context (Optional)
- **In scope**:
  - 現行サイトマップ (実装済みルート一覧) と、各ルートが参照する Directus collection の対応関係の棚卸し
  - `product.md` ドメインモデルに定義された collection のうち、対応するフロントエンド表示面が存在しないものの特定
  - 未実装領域 (出展マップ・タイムテーブル・協賛企業一覧・FAQ 等) について、ページ新設要否とサイトナビゲーション上の位置づけの方針決定
  - 上記方針を実現する上で、既存スキーマ (フィールド構成) で充足可能か、additive-only ルールの範囲で追加フィールド/collection が必要かの判定
  - 既存の進行中/完了済み spec (`home-page-expansion`, `page-home-friendly-editing`, `directus-schema`, `additive-only-schema-check` 等) の Out of Boundary / Owns との重複有無の確認
  - 公開前限定での `additive-schema-check.yml` 一時停止方針の決定 (停止方法・再開条件・関連ドキュメントへの反映範囲)
  - `student_exhibitions`/`sponsors`/`topics`/`festival_meta`/`page_home`/`page_home_live` の既存フィールドの削除・統合・命名改善方針の決定
  - `page_home_live` collection 廃止および `festival_meta.home_active_variant` フェーズ切替ロジック廃止の方針決定 (`page_home` への一本化)
  - フィールド/collection 名の日本語表示化 (Directus `meta.translations`)、タイプ/カテゴリに応じた条件付きフィールド非表示、画像の webp 等軽量フォーマット配信の各方針決定
- **Out of scope**:
  - 新設ページ (会場マップ・タイムテーブル・出展一覧・FAQ) の実装コード・UI コンポーネント・ビジュアルデザインの確定、およびそのためのスキーマ追加実装 (要否判定は本 spec に含むが実装は後続 spec)
  - 新設ページ向け RBAC ロール・権限定義の新規設計 (`page_home_live` 廃止に伴う既存 RBAC migration の無効化は本 spec に含む)
  - `home-page-expansion` spec が対象とする Home Page / About ページ自体の表示ロジック変更全般 (ただし `page_home_live` 廃止自体の実装、および `festival_meta.admission_fee`/`payment_note` 削除に伴う `festival-overview.tsx` の追従修正は本 spec に含む。gap-analysis.md Option A 採用)
  - `additive-schema-check.yml` の破壊的変更検出ロジック自体 (`frontend/scripts/check-additive-schema.ts`) の変更 (トリガー/ゲーティングの一時停止のみを対象とし、検出ロジックには手を入れない)
  - `page_home` と `festival_meta` の統合 (役割分離を維持する方針)
  - `hero_image` の動画 (MP4/YouTube) 対応 (将来検討事項として注記に留める。複数画像化は Requirement 7 で対象に含める)
- **Adjacent expectations**: 本 spec の結論が既存 collection のフィールド追加や新規ページ実装を要求する場合、当該作業は本 spec 完了後に別 spec として `/kiro:spec-init` から起票する。`directus-schema` spec の additive-only 制約 (カラム削除・型変更禁止) は、Requirement 5 で定める一時停止期間を除き、本 spec の判定結果にもそのまま適用される。`additive-only-schema-check` spec の Non-Goal (「ラベル/コメントによる自動バイパス機構は作らない」) を踏まえ、本 spec でもトグル可能な自動バイパス機構は提案せず、コード変更 (コミット) ベースの明示的な一時停止/再開のみを扱う。`page_home_live` 廃止方針は `page-home-friendly-editing` spec (実装完了済み) の中核設計を置き換えるものであり、`home-page-expansion` spec (未実装, tasks-generated) の前提にも影響するため、両 spec の再検証が必要である旨を Requirement 7 に明記する。

## Requirements

### Requirement 1: 現行サイトマップの棚卸し
**Objective:** As a 開発者, I want 現在実装済みのルートと各ルートが参照する Directus collection の対応関係を一覧化したドキュメントを得る, so that サイト全体の情報構造を俯瞰した上で再設計の議論ができる

#### Acceptance Criteria
1. The サイトマップ棚卸しドキュメント shall `frontend/src/app/` 配下の実装済みルート (静的ルート・動的ルート双方) を一覧で列挙する
2. When ルートが Directus collection を参照している, the サイトマップ棚卸しドキュメント shall 当該ルートと参照 collection の対応関係を明記する
3. While `page_home`/`page_home_live` のようなバリアント構成を持つルートが存在する, the サイトマップ棚卸しドキュメント shall バリアント間の使い分けを注記する

### Requirement 2: スキーマとサイトマップのギャップ特定
**Objective:** As a 開発者, I want product.md のドメインモデルに存在する collection のうち、対応する表示面がフロントエンドに存在しないものを特定する, so that 未実装領域を見落とさず再設計の検討対象にできる

#### Acceptance Criteria
1. The ギャップ分析ドキュメント shall `product.md` ドメインモデルに列挙された全 collection について、対応するフロントエンド表示面の有無を判定する
2. If ある collection に対応する表示面が存在しない, then the ギャップ分析ドキュメント shall 当該 collection を未実装領域として明記する
3. The ギャップ分析ドキュメント shall 各未実装領域について、来場者・学生模擬店担当者・実行委員のいずれの利用シーンに関連するかを紐づける

### Requirement 3: 情報アーキテクチャ再設計方針の決定
**Objective:** As a 開発者, I want 特定されたギャップに基づく新規ページ新設要否とサイトナビゲーション構成の方針を得る, so that 後続 spec で具体的な実装に着手できる

#### Acceptance Criteria
1. For each 未実装領域 identified in Requirement 2, the 再設計方針ドキュメント shall ページ新設の要否 (要/否/保留とその理由) を判定する
2. If ページ新設が必要と判定される, then the 再設計方針ドキュメント shall 想定 URL パスとサイト共通ナビゲーションへの追加要否を明記する
3. The 再設計方針ドキュメント shall 既存の進行中 spec (`home-page-expansion` 等) の Boundary Context と重複する提案を含まない

### Requirement 4: スキーマ拡張要否の判定
**Objective:** As a 開発者, I want 再設計方針を実現する上で既存 Directus スキーマが充足しているか、追加フィールド/collection が必要かを判定する, so that additive-only ルールを踏まえた安全な後続実装計画を立てられる

#### Acceptance Criteria
1. For each ページ新設が必要と判定された領域, the スキーマ拡張要否判定ドキュメント shall 既存 collection のフィールド構成で表示要件を充足できるかを判定する
2. If 既存フィールド構成で充足できない, then the スキーマ拡張要否判定ドキュメント shall 追加が必要なフィールドまたは collection を具体的に列挙する
3. The スキーマ拡張要否判定ドキュメント shall 提案する全てのスキーマ変更が additive-only ルール (collection/field 追加のみ、削除・型変更を含まない) に適合することを確認する (ただし Requirement 5 で定める一時停止期間中に限り、破壊的変更の提案を妨げない)
4. Where 提案する変更が CHECK 制約・複合 UNIQUE・RBAC 等 snapshot.yaml で表現できない性質を含む, the スキーマ拡張要否判定ドキュメント shall custom migration (`directus/migrations/`) での対応が必要である旨を明記する

### Requirement 5: additive-only 制約強制 CI の公開前一時停止
**Objective:** As a 開発者, I want 本番未公開期間に限り `additive-schema-check.yml` による additive-only 制約の機械強制を一時停止する, so that サイトマップ・スキーマ再考の結果として必要になる破壊的スキーマ変更 (カラム削除・型変更等) を、公開後と同じ制約に縛られず柔軟に実施できる

#### Acceptance Criteria
1. While サイトが本番未公開状態 (custom domain 未接続) である, the 一時停止方針 shall `additive-schema-check.yml` がスキーマ変更 PR のマージを実質的にブロックしない状態を実現する
2. The 一時停止方針ドキュメント shall 停止の実現方法 (ワークフロー/ジョブへの明示的な変更とそのコミットベースの管理) を具体的に記述する
3. The 一時停止方針ドキュメント shall 一時停止機構が `additive-only-schema-check` spec の Non-Goal (自動バイパス機構を設けない) に抵触しないことを確認する
4. The 一時停止方針ドキュメント shall 制約を再度有効化する条件 (本番公開判断の基準) を明記する
5. If 本番公開判断がなされる, then the 一時停止方針 shall additive-only 制約の強制を元の状態に復帰させる手順を提供する
6. The 一時停止方針ドキュメント shall CLAUDE.md の additive-only ルール記述への注記追加内容を明記する

### Requirement 6: 既存 collection のフィールド簡素化・命名改善
**Objective:** As a 実行委員会メンバー (Directus 管理画面利用者), I want 不要フィールドが削除・統合され日本語で分かりやすく表示されるスキーマを得る, so that 生 JSON 操作や英語フィールド名に迷わず出展情報・コンテンツを編集できる

#### Acceptance Criteria
1. The フィールド簡素化方針ドキュメント shall `student_exhibitions`/`sponsors`/`topics`/`festival_meta`/`page_home` の各既存フィールドについて、削除・統合・名称変更・型変更の要否を個別に判定する
2. If フィールドが用途不明・重複・未使用と判定される, then the フィールド簡素化方針ドキュメント shall 当該フィールドを削除対象として理由とともに明記する
3. Where `student_exhibitions.location` のように他フィールド (`area_id`/`booth_label`) と役割が重複するフィールドが存在する, the フィールド簡素化方針ドキュメント shall 統合方針 (どちらを残すか) を明記する
4. The フィールド簡素化方針ドキュメント shall `sponsors.type` の選択肢を「広告協賛」「地域協賛」「出店協賛」「その他」に整理する方針と、既存選択肢 (`ad`/`sponsor`/`food_truck`/`other`) との対応関係を明記する
5. The フィールド簡素化方針ドキュメント shall `topics.body` を WYSIWYG (`input-rich-text-html`) 化する方針を明記する
6. The フィールド簡素化方針ドキュメント shall `festival_meta.name` (祭名) と HTML `<title>` タグ用の値を分離するため、新規フィールド追加が必要である旨を明記する
7. The 再設計方針ドキュメント shall 各 collection/field の表示名を Directus `meta.translations` により日本語化する方針を明記する (実カラム名は英語のまま additive 範囲で対応する)
8. The 再設計方針ドキュメント shall タイプ/カテゴリに応じて不要フィールドを画面上非表示にする条件付き表示 (Directus `meta.conditions`) の適用方針を明記する
9. The 再設計方針ドキュメント shall 画像アセットを webp 等軽量フォーマットで配信する方式 (Directus Asset Transformations によるオンザフライ変換、スキーマ変更不要) を明記する
10. Where 削除・型変更対象と判定されたフィールドが存在する, the フィールド簡素化方針ドキュメント shall 当該変更が additive-only ルールに適合しないことを明記し、Requirement 5 の一時停止期間中の対応が前提であることを記録する
11. Where `festival_meta.admission_fee`/`payment_note` の削除が `/about` ページ (`festival-overview.tsx`, `home-page-expansion` spec 成果物) の既存表示ロジックに依存関係を持つ, the フィールド簡素化方針ドキュメント shall 当該コンポーネントの追従修正を本 spec のタスクに含める方針を明記する
12. Where `topics.link_url` の削除が既存 UI (`topic-card.tsx` のリンク表示) に依存関係を持つ, the フィールド簡素化方針ドキュメント shall 当該コンポーネントの追従修正を本 spec のタスクに含める方針を明記する

### Requirement 7: page_home / page_home_live 統合
**Objective:** As a 実行委員会メンバー, I want 開催フェーズによる `page_home`/`page_home_live` の二重管理をなくす, so that 単一 collection でトップページを管理できる

#### Acceptance Criteria
1. The 再設計方針ドキュメント shall `page_home_live` collection を廃止し `page_home` に一本化する方針を明記する
2. The 再設計方針ドキュメント shall `festival_meta.home_active_variant` によるフェーズ切替ロジックの廃止方針を明記する
3. The 再設計方針ドキュメント shall 本方針が `page-home-friendly-editing` spec (実装完了済み) の既存設計 (2-singleton 構成・専用 RBAC migration) を置き換える破壊的変更であることを明記する
4. The 再設計方針ドキュメント shall 本方針が `home-page-expansion` spec (未実装, tasks-generated) の前提 (2 バリアント運用継続を Out of Scope とする既存記述) に与える影響を明記し、同 spec の再検証が必要である旨を記録する
5. The 再設計方針ドキュメント shall `page_home_live` 廃止に伴う RBAC migration (`directus/migrations/`) の取り扱い方針 (削除 migration の要否) を明記する
6. The 再設計方針ドキュメント shall `page_home.hero_image` (単一画像) を複数画像対応へ拡張する方針を明記する
7. The 再設計方針ドキュメント shall 複数画像対応の実現方式として、`topics.attachments`/`announcements.attachments` (`home-page-expansion` spec 採用) と同じ M2M junction パターンへ倣うことを明記する
8. The 再設計方針ドキュメント shall `hero_image` (単一) から `hero_images` (M2M) への移行が既存単一フィールドの削除を伴う破壊的変更であり、Requirement 5 の一時停止期間中の対応が前提であることを明記する
