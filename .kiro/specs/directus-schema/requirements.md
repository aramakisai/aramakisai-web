# Requirements: directus-schema

## Overview

荒牧祭Webサイトのコンテンツ管理基盤として Directus CMS のスキーマを定義する。
構内マップ表示・学生団体ページ管理・タイムテーブル・協賛情報管理・固定コンテンツ管理を実現する。

---

## Functional Requirements

### FR-1: 構内マップ (OSM)

**FR-1.1** エリア(ゾーン)を GeoJSON Polygon で管理できること。
**FR-1.2** 各エリアは `student_exhibitions` (出展あり)、`sponsors` (type!=ad)、および `stages` を子として持てること。
**FR-1.3** エリア内の各ブースはエリア内識別番号 (booth_number: integer) を持ち、エリアと番号の組み合わせがコレクション内で一意であること。
**FR-1.4** フロントエンドは単一エンドポイントでエリアと子エントリを取得できること。

### FR-2: 学生団体 (student_exhibitions)

**FR-2.1** 各学生団体は `category` (`stage` / `exhibit` / `vendor` / `other`) で分類できること。出展 (マップ掲載) は `area_id` 割当の有無、出演 (タイムテーブル掲載) は `performance_slots` 登録の有無で表現し、真偽フラグは持たない (単一 source of truth 化、冗長排除)。両方該当する団体は `area_id` と `performance_slots` の両方を持つ。
**FR-2.2** 出展団体はエリア・ブース番号・ブースラベルを持てること (出演のみ団体は NULL 可)。
**FR-2.3** ページ本文 (`content`) は WYSIWYG エディタで編集できること。
**FR-2.4** `description` は一覧表示向けの短文テキストフィールドであること。
**FR-2.5** `slug` はURL用識別子として全レコード間で一意であること。
**FR-2.6** `status` は `published` / `draft` を持ち、フロントエンドは `published` のみ取得できること。
**FR-2.7** `category` (`stage` / `exhibit` / `vendor` / `other`) を表示分類として持てること。一覧・ピックアップ表示のグルーピングに用いる。マップ掲載判定 (`area_id != NULL`)・タイムテーブル掲載判定 (`performance_slots` の存在) とは独立し、`is_exhibitor` / `is_performer` の真偽フラグは設けない (冗長排除)。
**FR-2.8** `location` (人間可読な開催場所名: 建物 / 教室 / 屋外エリア) をテキストで持てること。マップ用の `area_id`・`booth_number` とは別に、イベントカード表示向けの場所名を管理する。

### FR-3: タイムテーブル

**FR-3.1** ステージ (`stages`) を複数管理できること。
**FR-3.2** タイムスロット (`time_slots`) を固定枠 (label, start_at, end_at) として事前定義できること。
**FR-3.3** `performance_slots` で stage × time_slot × student_exhibition の組み合わせを登録できること。`exhibition_id` は NULL 可とし、団体紐付けのない出演 (ゲスト・実行委員企画・外部パフォーマー等) は `title` (自由文字列) で登録できること。表示名は `exhibition_id.name` があればそれを、なければ `title` を用いる。
**FR-3.4** `performance_slots` は `exhibition_id` か `title` の少なくとも一方を持つこと (両方 NULL は不可)。
**FR-3.5** 同一ステージ・同一スロットへの二重登録は DB 層で防止されること。
**FR-3.6** フロントエンドはステージ・時刻順でタイムテーブルを取得できること。
**FR-3.7** `stages` は `area_id` で `map_areas` に紐付き、OSM 上に出演場所を表示できること。ステージ専用エリアを `map_areas` に定義し、その Polygon を出演場所とする。

### FR-4: 協賛 (sponsors)

**FR-4.1** 協賛を `type` (`ad` / `sponsor` / `food_truck` / `other`) で一元管理できること。
**FR-4.2** `type=ad` (広告協賛) は位置情報を持たず、協賛ランク (`tier`) を持てること。
**FR-4.3** `type!=ad` (出店協賛・キッチンカー) はエリア・ブース番号・マップラベルを持てること。
**FR-4.4** ロゴ・URL・説明・表示順を管理できること。
**FR-4.5** フロントエンドは `type` でフィルタして協賛一覧・マップ表示に使い分けられること。
**FR-4.6** 地元協賛 (`type=sponsor` 等) は `business_category` (業種: 自由文字列) と `address` (住所) を持てること (いずれも NULL 可)。応援メッセージは既存 `description` を流用する (別フィールドは設けない)。

### FR-5: お知らせ (announcements)

**FR-5.1** タイトル・本文・公開日時を管理できること。
**FR-5.2** `published_at` で公開日時管理できること。

### FR-6: 固定コンテンツ

**FR-6.1** FAQ (`faq_items`): 質問・回答ペアを複数管理し、`sort` で順序制御できること。
**FR-6.2** トピック (`topics`): タイトル・本文を複数管理し、`sort` で順序制御できること。
**FR-6.3** アクセスページ (`page_access`): シングルトン。本文・地図埋め込みURLを管理できること。交通アクセス (JR前橋駅発バス路線・時刻・徒歩距離・混雑注意) は `content` の自由記述で管理する (構造化フィールドは設けない)。
**FR-6.4** トップページ (`page_home`): シングルトン。コンテンツブロックを JSON で管理できること。
**FR-6.5** トピック (`topics`) は `image` (サムネイル)・`link_url` (遷移先)・`attachment` (PDF: デジタルパンフレット等) を持てること (いずれも NULL 可)。駐車場マップ・模擬店マップ・デジタルパンフ等の告知カードを表現する。
**FR-6.6** お問い合わせページ (`page_contact`): シングルトン。本文 (`content`) と `form_embed_url` (Google Forms iframe 埋め込みURL) を管理できること。

### FR-7: 祭メタ情報

**FR-7.1** 祭メタ情報 (`festival_meta`): シングルトン。祭名・開催日程 (日ごとの開催時間)・入場料・支払い注記 (例: 現金のみ)・駐車場収容数を管理できること。
**FR-7.2** 駐車場マップは `parking_map` (画像 file) で管理できること。構内マップは `map_areas` (OSM) で代替し、画像は持たない。
**FR-7.3** 開催日程は日ごとに開始・終了時刻が異なるため (例: 土 10:00-17:30 / 日 10:00-16:30)、日単位で開催時間を保持できること。

---

## Non-Functional Requirements

### NFR-1: RBAC

**NFR-1.1** 学生団体担当者ロール (`student_exhibitor`) は自団体の `student_exhibitions` レコードのみ更新できること。
**NFR-1.2** `student_exhibitor` は他団体のレコードを更新できないこと。
**NFR-1.3** `student_exhibitor` が UPDATE できるフィールドは `name, slug, description, content, images, status` のみとすること。
**NFR-1.4** `category`, `location`, `area_id`, `booth_number`, `booth_label` は実行委員ロール (`executive`) のみ更新できること (掲載区分・配置に関わる構造情報のため)。
**NFR-1.5** `stages`, `time_slots`, `performance_slots`, `sponsors` は `executive` のみ管理できること。
**NFR-1.6** `executive` はすべてのコレクションをフィールド制限なしで管理できること。Directus superadmin とは別ロールとして定義すること。

### NFR-2: 認証

**NFR-2.1** ユーザー認証は Authentik (OIDC) を通じて行うこと。
**NFR-2.2** Authentik グループ `directus-executive` → `executive`、`directus-org-member` → `student_exhibitor` にマッピングすること。
**NFR-2.3** 実行委員と学生団体のアカウントは完全に別とすること。
**NFR-2.4** 学生が SSO ログイン後に自身で `student_exhibitions` を CREATE することで紐付けが自動確立されること。Flow・追加フィールド・手動 UUID コピペは不要とすること。

### NFR-3: データ整合性

**NFR-3.1** `student_exhibitions.user_created` は UNIQUE 制約を持ち、1ユーザー:1レコードを DB 層で保証すること。
**NFR-3.2** `student_exhibitions.slug` は UNIQUE 制約を持つこと。
**NFR-3.3** `(student_exhibitions.area_id, student_exhibitions.booth_number)` は複合UNIQUE制約を持つこと。
**NFR-3.4** `(sponsors.area_id, sponsors.booth_number)` は複合UNIQUE制約を持つこと。
**NFR-3.5** `(performance_slots.stage_id, performance_slots.time_slot_id)` は複合UNIQUE制約を持つこと。
**NFR-3.6** `area_id` を持つコレクションは `map_areas.id` への外部キー制約を持つこと。

### NFR-4: セキュリティ

**NFR-4.1** WYSIWYG フィールド (`content`) の HTML はフロントエンドで XSS sanitize を実施すること。
**NFR-4.2** 公開 API エンドポイントは `published` ステータスのレコードのみ返すこと。

---

## Out of Scope

- 過去年度アーカイブ (`festival_archives`)。今スキーマには含めず別途対応する
- 学生団体ユーザーの Authentik アカウント作成・招待フロー
- Authentik 側のグループ・ユーザー管理 (`aramakisai-infra/directus-sso` spec で管理)
- フロントエンドの OSM 描画・タイムテーブル UI 実装
- Directus の初期インストール・インフラ設定 (`aramakisai-infra` リポジトリで管理)
