# Implementation Plan

## 対象外 (design.md で充足済み、実装タスクなし)

Requirement 1 (現行サイトマップ棚卸し)・Requirement 2 (スキーマ×サイトマップギャップ特定)・Requirement 3 (情報アーキテクチャ再設計方針決定)・Requirement 4 (新設ページ向けスキーマ拡張要否判定) は、いずれも分析・方針決定ドキュメントを成果物とする要件であり、`design.md` の「Data Models」セクション (現行ルート×Collection対応表、スキーマ×サイトマップギャップ一覧、再設計方針、スキーマ拡張要否判定) で既に充足されている。新設ページ (会場マップ・タイムテーブル・出展一覧・FAQ) 自体の実装は本 spec の Out of Boundary であり、判定結果を入力として別 spec で起票する。

以下のタスクは Requirement 5 (CI 一時停止)・Requirement 6 (既存フィールド簡素化)・Requirement 7 (page_home/page_home_live 統合) の実装のみを対象とする。

## Tasks

- [x] 1. additive-only 制約強制 CI の公開前一時停止
- [x] 1.1 `additive-schema-check.yml` を一時停止し関連ドキュメントに注記する
  - `additive-schema-check.yml` の `check` job に `if: false` と、停止理由・再開条件 (custom domain 接続)・参照 spec を記したコメントを追加する
  - `CLAUDE.md` の additive-only ルール節に一時停止中である旨と再開条件の注記を追記する
  - `frontend/additive-schema-check.workflow.test.ts` を実行し、`if: false` 追加後もアサーションが通ることを確認する (通らない場合はアサーションを更新する)
  - 観測可能な完了条件: PR で `directus/schema/snapshot.yaml` に破壊的変更を含めても `check` job が `skipped` として完了し、required status check がブロックしない状態になっている
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2. 既存 collection のフィールド削除・型変更
- [x] 2.1 student_exhibitions のフィールドを整理する
  - `content` フィールドを削除する (一覧用 `description` と役割重複)
  - `location` フィールドを削除する (`area_id`/`booth_label` と役割重複)
  - `images` (json/files) を単一画像用の `image` (uuid/file-image) に型変更する
  - 観測可能な完了条件: `directus/schema/snapshot.yaml` の `student_exhibitions` に `content`/`location`/`images` が存在せず、`image` (uuid) フィールドが定義されている
  - _Requirements: 6.1, 6.2, 6.3, 6.10_

- [x] 2.2 sponsors の type 選択肢を整理する
  - `type` の choices 表示名を「広告協賛」「地域協賛」「出店協賛」「その他」に変更する (value は既存の `ad`/`sponsor`/`food_truck`/`other` を維持)
  - 観測可能な完了条件: Directus 管理画面の `sponsors.type` セレクトボックスに 4 つの新しい日本語ラベルが表示され、既存レコードの選択値が保持されている
  - _Requirements: 6.4_

- [x] 2.3 topics のフィールドを整理し関連 UI を追従修正する
  - `link_url` フィールドを削除する
  - `body` の interface を `input-multiline` から `input-rich-text-html` (WYSIWYG) に変更する
  - `frontend/src/lib/topics.ts` から `link_url` の取得・`linkUrl` へのマッピングを除去する
  - `frontend/src/components/topic-card.tsx` から `linkUrl` を使ったリンク表示を除去し、関連テストを更新する
  - 観測可能な完了条件: Directus 管理画面の `topics` 編集フォームで `body` が WYSIWYG エディタとして表示され `link_url` が表示されず、トピックカードのリンク表示が UI から消えている
  - _Requirements: 6.2, 6.5, 6.10, 6.12_

- [x] 2.4 festival_meta のフィールドを整理し About ページを追従修正する
  - `admission_fee`/`payment_note`/`parking_capacity` フィールドを削除する
  - `<title>` タグ用の新規フィールド (祭名 `name` とは別) を追加する
  - `frontend/src/lib/festival-meta.ts` から `admission_fee`/`payment_note` の取得・マッピングを除去する
  - `frontend/src/components/festival-overview.tsx` から `admissionFee`/`paymentNote` の分割代入・条件付きレンダリングを除去し、`festival-overview.test.tsx` を更新する
  - 観測可能な完了条件: `directus/schema/snapshot.yaml` の `festival_meta` に削除対象 3 フィールドが存在せず、`/about` ページが入場料・支払い注記なしで正常にレンダリングされる
  - _Requirements: 6.2, 6.6, 6.10, 6.11_

- [ ] 3. 表示改善 (日本語化・条件付き表示・画像配信)
- [ ] 3.1 collection/field を日本語表示化する
  - `student_exhibitions`/`sponsors`/`topics`/`festival_meta`/`page_home` の各 collection・field に `meta.translations` で日本語ラベルを付与する
  - 観測可能な完了条件: Directus 管理画面で対象 collection の一覧・編集画面のラベルが全て日本語で表示される
  - _Requirements: 6.7_

- [ ] 3.2 タイプ/カテゴリに応じた条件付き表示を設定する
  - `sponsors.type`/`student_exhibitions.category` 等の値に応じて無関係なフィールド (例: 広告協賛以外での `tier`) を非表示にする `meta.conditions` を設定する
  - 観測可能な完了条件: Directus 管理画面で `sponsors.type` を変更すると、対応しないフィールド (`tier`/`business_category`/`address` 等) が動的に非表示になる
  - _Requirements: 6.8_

- [ ] 3.3 (P) 画像アセットを webp で配信する
  - `frontend/src/lib/directus-asset-url.ts` の `toAssetUrl` に Directus Asset Transformations の `format=webp` クエリパラメータを付与する
  - 観測可能な完了条件: `toAssetUrl` が返す URL に `format=webp` が含まれ、既存の `toAssetUrl` のテストが更新後の期待値で通る
  - _Requirements: 6.9_
  - _Boundary: frontend/src/lib/directus-asset-url.ts_

- [ ] 4. page_home / page_home_live 統合
- [ ] 4.1 page_home の hero_image を複数画像対応に拡張する
  - `page_home_files` M2M junction collection (`id`/`page_home_id`/`directus_files_id`/`sort`) を新設する
  - `page_home` に `hero_images` (`type: alias`, `interface: list-m2m`) を追加し、既存 `hero_image` (単一) を削除する
  - `page_home.embed_url` を削除する
  - 観測可能な完了条件: `directus/schema/snapshot.yaml` に `page_home_files` junction が定義され、`page_home.hero_images` が `topics.attachments` と同じ構造で参照可能になっている
  - _Requirements: 7.6, 7.7, 7.8_

- [ ] 4.2 page_home_live を廃止し page_home に一本化する
  - `page_home_live` collection を削除する
  - `festival_meta.home_active_variant` フィールドを削除する
  - 観測可能な完了条件: `directus/schema/snapshot.yaml` に `page_home_live` collection および `home_active_variant` フィールドが存在しない
  - _Requirements: 7.1, 7.2_

- [ ] 4.3 page_home_live 用 RBAC migration を無効化する
  - `page_home_live` への CRUD 権限付与を行っていた既存 migration を無効化する新規 migration (`directus/migrations/{YYYYMMDD}{suffix}-remove-rbac-page-home-live.js`) を追加する
  - 観測可能な完了条件: ローカル Directus に migration を適用した状態で `page_home_live` に紐づく権限レコードが存在しない
  - _Requirements: 7.5_
  - _Depends: 4.2_

- [ ] 4.4 フロントエンドの Home Page 参照ロジックを更新する
  - `frontend/src/lib/home-page.ts`/`home-page-types.ts` から `page_home_live`/`home_active_variant`/`HomeActiveVariant` への参照を除去し、`page_home` 単体を常時参照する形に変更する
  - `hero_images` (M2M) を deep-fields で取得し配列としてレンダリングできるようにする
  - `home-page.ts` 内で重複していた `festival_meta.admission_fee`/`payment_note` および `topics.link_url` の参照を除去する (task 2.3/2.4 のフィールド削除に追従)
  - `frontend/src/lib/directus.ts` の `Schema` 型定義から `page_home_live`・削除フィールドを除去し、`page_home_files`/`hero_images`・新規タイトル用フィールドを追加する
  - 観測可能な完了条件: Home Page (`/`) がフェーズ判定なしで常に `page_home` を参照し、複数のヒーロー画像が配列として描画される
  - _Requirements: 7.1, 7.2, 7.6_
  - _Depends: 2.3, 2.4, 4.1, 4.2_

- [ ] 5. 統合検証
- [ ] 5.1 既存テストとビルドを更新・確認する
  - `frontend/src/lib/home-page.test.ts` 等、`page_home_live`/`home_active_variant` を前提としていた既存テストを `page_home` 単体構成に合わせて更新する
  - `sponsors.type`/`topics.body` 等、フィールド変更に伴い期待値がずれる既存テストを更新する
  - `pnpm type-check` / `pnpm lint` / `pnpm test` / `pnpm build` を実行し全て成功することを確認する
  - 観測可能な完了条件: `pnpm test` と `pnpm build` が warning なくグリーンで完了する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4_
