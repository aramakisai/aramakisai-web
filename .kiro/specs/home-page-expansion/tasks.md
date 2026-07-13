# Implementation Plan

- [x] 1. Foundation: festival_meta への概要WYSIWYG・ヒーロー画像フィールド追加
- [x] 1.1 festival_meta に概要WYSIWYGフィールドを追加する
  - `directus/schema/snapshot.yaml` に rich-text-html インターフェースの新規フィールドを追加し、既存フィールドの削除・型変更を含まないことを確認する
  - NOT NULL制約を課さず未入力を許容する
  - ローカルDirectusに `schema apply` した際、管理画面で `festival_meta` にWYSIWYGエディタが表示されることを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 1.2 festival_meta にヒーロー画像フィールドを追加する
  - `directus/schema/snapshot.yaml` に `file-image` インターフェース (`directus_files` へのM2O) の新規フィールドを追加する
  - NOT NULL制約を課さず未登録を許容する
  - ローカルDirectusの管理画面でファイル選択UIとして表示されること、既存 `fields: "*"` 権限により executive編集・Public読み取りの双方が追加権限なしで機能することを確認する
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 2. Foundation: topics/announcements 添付ファイルの複数登録用スキーマとRBAC
- [x] 2.1 topics に複数添付用M2Mジャンクションコレクションを追加する
  - Directus管理画面で複数ファイル添付用フィールドを一度作成し、`schema snapshot` で書き出す方式で正確なメタ情報を確定させる
  - 新規ジャンクションコレクションと `topics.attachments` alias フィールドを追加し、既存の `topics.image`/`topics.attachment` フィールドは変更しない
  - ジャンクション行が `sort` フィールドで並び替え可能であることを確認する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2.2 announcements に複数添付用M2Mジャンクションコレクションを追加する
  - 同様の手順で新規ジャンクションコレクションと `announcements.attachments` alias フィールドを追加する
  - 既存の `id`/`title`/`body`/`published_at` フィールドを変更しないことを確認する
  - _Requirements: 6.1, 6.2_

- [x] 2.3 新規ジャンクションコレクションへのRBAC権限を付与するmigrationを追加する
  - `directus/migrations/` に命名規則に従った新規ファイルを追加し、`20260712A-rbac-page-home-live.js` の delete-then-insert パターンを踏襲する
  - executiveロールに両ジャンクションコレクションへのCRUD (`create`/`read`/`update`/`delete`) を付与する
  - Publicポリシーに両ジャンクションコレクションへの `read` を付与する
  - ローカルDirectusで匿名リクエストが `topics`/`announcements` の `attachments.directus_files_id` を取得できることを確認する
  - migrationの `up`/`down` が再実行安全であることを確認する
  - _Requirements: 5.4, 5.5, 6.3, 6.4, 6.5, 11.2_

- [x] 3. Foundation: フロントエンド型定義と静的アセット
- [x] 3.1 Directus SDK Schema型とHome Page型定義を新規フィールドに合わせて拡張する
  - `frontend/src/lib/directus.ts` の `Schema` に `festival_meta.overview`/`hero_image`、`topics.attachments`、`announcements.attachments`、`topics_files`、`announcements_files` を追加する
  - `frontend/src/lib/home-page-types.ts` に `Attachment` 型を新設し、`TopicSummary`/`AnnouncementSummary` に `attachments`、`FestivalOverview` に `overviewHtml`/`heroImageId` を追加する
  - `pnpm type-check` がエラーなく通ることを確認する
  - _Requirements: 1.5_

- [x] 3.2 (P) NO IMAGE差し替え画像アセットを追加する
  - `frontend/public/images/` 配下にトピックサムネイル未登録時用の差し替え画像を配置する
  - 静的アセットとして `/images/` 配下から参照可能であることを確認する
  - _Requirements: 2.5, 2.6_
  - _Boundary: 静的アセット (frontend/public/images/)_

- [x] 4. Core: データ取得層の実装
- [x] 4.1 (P) TopicsService を実装する
  - `topics` の全件取得 (`getTopics`) と単一取得 (`getTopicById`) を提供する
  - `attachments` を deep-fields で取得し `sort` 昇順の `Attachment[]` に整形する
  - 存在しないIDで `getTopicById` が `null` を返すことをテストで確認する
  - _Requirements: 8.1, 8.2, 8.4, 9.1, 9.2, 9.3_
  - _Boundary: TopicsService (frontend/src/lib/topics.ts)_

- [x] 4.2 (P) AnnouncementsService に単一取得と添付ファイル整形を追加する
  - `getAnnouncementById` を追加し、存在しないIDで `null` を返すことをテストで確認する
  - 既存 `getAnnouncements()` が `attachments` を含む `AnnouncementSummary[]` を返すよう拡張する
  - _Requirements: 10.1, 10.2, 10.3, 1.5, 6.5_
  - _Boundary: AnnouncementsService (frontend/src/lib/announcements.ts)_

- [x] 4.3 (P) SnsLinksService を実装する
  - `festival_meta.sns_links` のみを軽量取得する `getSnsLinks` を提供する
  - Directus到達不能時に例外を送出せず空配列を返すことをテストで確認する
  - _Requirements: 12.1, 12.5_
  - _Boundary: SnsLinksService (frontend/src/lib/sns-links.ts)_

- [x] 4.4 (P) FestivalMetaService を実装する
  - Aboutページ向けに `festival_meta` の `hero_image`/`event_days`/`admission_fee`/`payment_note`/`overview` を取得・整形する `getFestivalMeta` を提供する
  - `heroImageId`/`overviewHtml` が未設定時に `null` を返すことをテストで確認する
  - _Requirements: 13.5, 14.1, 14.2, 14.3, 14.4, 14.5_
  - _Boundary: FestivalMetaService (frontend/src/lib/festival-meta.ts)_

- [x] 4.5 (P) HomePageService に添付ファイル・概要WYSIWYGの取得を追加する
  - `topics`/`announcements` 取得時に `attachments` を整形して含める
  - `festival_meta.overview` を `festival.overviewHtml` としてマッピングする
  - 既存の `getHomePage()` の戻り値構造・variant分岐ロジックは変更しないことを確認する
  - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_
  - _Boundary: HomePageService (frontend/src/lib/home-page.ts)_

- [x] 5. Core: 表示コンポーネントの実装
- [x] 5.1 (P) AnnouncementsList をテーブル形式に変更する
  - 公開日時・タイトルを列とする `<table>` として `announcements` を描画し、`published_at` 降順の順序をそのまま描画する
  - 0件時に「お知らせはありません」を表示する既存動作を維持する
  - 各行が `/announcements/{id}` へのリンクとして機能することをコンポーネントテストで確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Boundary: AnnouncementsList (frontend/src/components/announcements-list.tsx)_

- [x] 5.2 (P) AttachmentGallery コンポーネントを実装する
  - `Attachment[]` を受け取り、画像 (`type` が `image/*`) はサムネイル、非画像はファイル名+ダウンロードリンクとして描画する
  - 画像/非画像混在時の描画振り分けをコンポーネントテストで確認する
  - _Requirements: 2.1, 2.2, 9.4, 10.2_
  - _Boundary: AttachmentGallery (frontend/src/components/attachment-gallery.tsx)_

- [x] 5.3 (P) TopicCard を実装し TopicsList をこれに委譲する
  - サムネイル領域は「`attachments` 内の先頭画像 → 旧 `image` フィールド → NO IMAGE差し替え画像」の優先順位で決定する
  - 複数添付は `AttachmentGallery` を用いてカード内に表示し、既存のグリッドレイアウトを維持する
  - `TopicsList` を、各アイテムの描画を `TopicCard` に委譲する薄いラッパーへ変更する
  - 添付複数枚・添付0件・NO IMAGE表示の3パターンをコンポーネントテストで確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Boundary: TopicCard, TopicsList (frontend/src/components/topic-card.tsx, topics-list.tsx)_
  - _Depends: 3.2_

- [x] 5.4 (P) FestivalSummary コンポーネントを実装する
  - `overviewHtml` を既存 `RichText` コンポーネント経由でサニタイズして描画する
  - `overviewHtml` が空文字列またはnullの場合に何も描画しないことをコンポーネントテストで確認する
  - 既存 `FestivalOverview` コンポーネントとは独立したコンポーネントとして実装する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: FestivalSummary (frontend/src/components/festival-summary.tsx)_

- [x] 6. Core: Footer SNSアイコンリンク
- [x] 6.1 (P) SnsIcon コンポーネントを実装する
  - 既知プラットフォーム (X/Instagram/Facebook/YouTube/TikTok/LINE) をインラインSVGアイコンにマッピングする
  - 未知プラットフォームは汎用リンクアイコン+テキストラベルで描画する
  - 既知/未知プラットフォームそれぞれの描画切り替えをコンポーネントテストで確認する
  - _Requirements: 12.2, 12.3_
  - _Boundary: SnsIcon (frontend/src/components/sns-icon.tsx)_

- [x] 6.2 Footer を非同期化しSNSアイコンリンクを表示する
  - `Footer` を async Server Componentとし、`SnsLinksService.getSnsLinks()` を呼び出す
  - 各リンクにプラットフォーム名を伝える `aria-label` を付与する
  - `sns_links` が0件の場合にSNSリンク領域を描画しないことを確認する
  - `getSnsLinks()` が例外を投げてもFooterのレンダリングが成功することを統合テストで確認する
  - _Requirements: 12.1, 12.4, 12.5, 12.6_
  - _Depends: 4.3, 6.1_

- [x] 7. Integration: ページ・ルーティングの結線
- [x] 7.1 (P) Home Page に FestivalSummary を組み込み、拡張済みデータを既存コンポーネントへ配線する
  - `FestivalSummary` を既存 `FestivalOverview` と並列に配置する
  - `AnnouncementsList`/`TopicsList` へ渡すpropsが `attachments` を含む拡張済みデータを透過することを確認する
  - ローカルDirectus接続でHome Pageの表示を目視確認する
  - _Requirements: 1.4, 2.1, 3.1, 3.2, 3.3_
  - _Boundary: app/page.tsx_

- [x] 7.2 (P) お知らせ一覧ページをテーブル表示・詳細リンクに更新する
  - `frontend/src/app/announcements/page.tsx` を更新後の `AnnouncementsList` に追従させる
  - 各行から個別記事ページへ遷移することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 10.4_
  - _Boundary: app/announcements/page.tsx_

- [x] 7.3 (P) お知らせ個別記事ページを新設する
  - `frontend/src/app/announcements/[id]/page.tsx` を新設し、タイトル・公開日時・本文・全添付ファイルを表示する
  - 存在しないIDアクセス時に `notFound()` を呼び出し既存 `not-found.tsx` に委譲することを確認する
  - _Requirements: 10.1, 10.2, 10.3_
  - _Boundary: app/announcements/[id]/page.tsx_

- [x] 7.4 (P) トピックス一覧ページを新設する
  - `frontend/src/app/topics/page.tsx` を新設し、全 `topics` を `TopicCard` (Home Pageと同一コンポーネント) で描画する
  - 0件時の空状態案内を表示する
  - カード選択で個別記事ページへ遷移することを確認する
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Boundary: app/topics/page.tsx_

- [x] 7.5 (P) トピックス個別記事ページを新設する
  - `frontend/src/app/topics/[id]/page.tsx` を新設し、タイトル・本文・全添付ファイル (`AttachmentGallery`) を表示する
  - 存在しないIDアクセス時に `notFound()` を呼び出し既存 `not-found.tsx` に委譲することを確認する
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - _Boundary: app/topics/[id]/page.tsx_

- [x] 7.6 (P) About ページを新設する
  - `frontend/src/app/about/page.tsx` を新設し、`FestivalMetaService.getFestivalMeta()` の結果をヒーロー画像・`FestivalOverview`・`FestivalSummary` に配線する
  - ヒーロー画像未登録時は当該領域を描画しないことを確認する
  - Directus到達不能時に既存ページと同様のフォールバック表示になることを確認する
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - _Boundary: app/about/page.tsx_

- [x] 7.7 (P) ヘッダーナビゲーションに /topics・/about へのリンクを追加する
  - 既存のリンク一覧に「トピックス」「About」の2リンクを追加する
  - 全ページで該当リンクからの遷移が機能することを確認する
  - _Requirements: 8.6, 14.6_
  - _Boundary: Header (frontend/src/components/header.tsx)_

- [ ] 8. Validation: 横断的な検証
- [x]* 8.1 一覧→個別記事→404遷移のE2Eテストを追加する
  - トピックス一覧→個別記事、お知らせテーブル→個別記事、存在しないIDアクセス時の404表示をE2Eテストで検証する
  - _Requirements: 8.5, 9.3, 10.3, 10.4_

- [x] 8.2 スキーマ差分のadditive-only検証を実施する
  - `additive-schema-check.yml` (`check-additive-schema.ts`) をこのブランチのスキーマ差分に対して実行し、collection/field削除・型変更・`is_nullable: true→false` が検出されないことを確認する
  - _Requirements: 11.1, 11.3_

- [x] 8.3 staging環境でスキーマ・RBAC変更を事前検証する
  - staging Directus (`stg-api.aramakisai.com`) で、executiveが `topics`/`announcements` に複数添付ファイルと `festival_meta` のヒーロー画像を登録できることを確認する
  - 匿名Public APIで `attachments`/`hero_image`/`overview` の各フィールドが取得できることを確認する
  - _Requirements: 11.2, 11.4, 5.5, 6.4, 13.5_
