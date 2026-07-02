# Implementation Plan

Directus CMS スキーマ (コレクション・リレーション・制約・RBAC) を構築し、`directus/schema/snapshot.yaml` として書き出す。
フロントエンドの OSM 描画・タイムテーブル UI 実装、Authentik 側のユーザー/グループ管理は本 spec のスコープ外。

## Foundation: マスタ & FK ターゲット

- [ ] 1. スキーマ基盤とルックアップマスタ
- [ ] 1.1 構内マップエリア (map_areas) コレクションを定義する
  - GeoJSON Polygon を保持する `geometry` フィールドと表示名・表示順を持つコレクションを作成する
  - 学生団体・協賛・ステージから参照される FK ターゲットとして機能する (`area_id` 参照先)
  - 完了状態: Directus 上で map_areas にゾーンを1件登録でき、GeoJSON Polygon が保存・取得できる
  - _Requirements: FR-1.1_

- [ ] 1.2 タイムスロットマスタ (time_slots) を定義する
  - label・start_at (time)・end_at (time)・sort を持つ固定枠コレクションを作成する
  - 実行委員が祭前に一括定義する時系列順のスロットを保持する
  - 完了状態: "13:00-13:30" 等のスロットを複数登録でき、sort で時系列順に取得できる
  - _Requirements: FR-3.2_

## Core: コンテンツコレクション

- [ ] 2. 学生団体 (student_exhibitions) コレクション
- [ ] 2.1 学生団体コレクションと表示・分類フィールドを定義する
  - name・slug・description (一覧用短文)・content (WYSIWYG HTML)・images (JSON)・status (published/draft) を持つ
  - `category` (stage/exhibit/vendor/other) を表示分類、`location` を人間可読な開催場所名として持つ
  - `area_id` (→map_areas, NULL可)・`booth_number` (NULL可)・`booth_label` (NULL可) でマップ配置を保持する
  - 完了状態: 出展のみ/出演のみ/両方いずれのパターンも1レコードで登録でき、published のみ公開取得できる
  - _Requirements: FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8_
  - _Boundary: student_exhibitions_

- [ ] 2.2 学生団体の一意性制約を設定する
  - `slug` に UNIQUE、`user_created` に UNIQUE (1ユーザー1レコード)、`(area_id, booth_number)` に複合 UNIQUE を設定する
  - `area_id` は map_areas.id への外部キー制約を持つ
  - 完了状態: 重複 slug・2件目の user_created・同一エリア同一ブース番号の登録が DB 層で拒否される
  - _Requirements: FR-1.3, NFR-3.1, NFR-3.2, NFR-3.3, NFR-3.6_
  - _Boundary: student_exhibitions_
  - _Depends: 1.1_

- [ ] 3. 協賛 (sponsors) コレクション
- [ ] 3.1 (P) 協賛コレクションを定義する
  - `type` (ad/sponsor/food_truck/other)・name・logo・url・description (応援メッセージ兼用)・sort を持つ
  - 広告協賛用の `tier` (NULL可)、地元協賛用の `business_category` (業種)・`address` (NULL可) を持つ
  - `area_id` (→map_areas, NULL可)・`booth_number` (NULL可)・`booth_label` (NULL可) でマップ配置を保持する
  - `(area_id, booth_number)` 複合 UNIQUE と area_id の外部キー制約を設定する
  - 完了状態: type でフィルタして協賛一覧・マップ表示・広告(tier)表示に使い分けられ、同一エリア同一ブースの重複が拒否される
  - _Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6, NFR-3.4, NFR-3.6_
  - _Boundary: sponsors_
  - _Depends: 1.1_

- [ ] 4. タイムテーブル (stages / performance_slots)
- [ ] 4.1 ステージ (stages) コレクションを定義する
  - name・sort と、出演場所を示す `area_id` (→map_areas, NULL可) を持つ
  - 専用エリアの Polygon を出演場所として map_areas に紐付ける
  - 完了状態: ステージを複数登録でき、area_id 経由で OSM 上の出演場所エリアを取得できる
  - _Requirements: FR-3.1, FR-3.7, NFR-3.6_
  - _Boundary: stages_
  - _Depends: 1.1_

- [ ] 4.2 出演枠 (performance_slots) コレクションと二重登録防止を定義する
  - stage_id (NOT NULL)・time_slot_id (NOT NULL)・exhibition_id (→student_exhibitions, NULL可)・title (NULL可) を持つ
  - `(stage_id, time_slot_id)` に複合 UNIQUE を設定し同ステージ・同スロット二重登録を防止する
  - 表示名は exhibition_id.name があればそれを、なければ title を用いる
  - 完了状態: 団体紐付き出演と団体なし出演 (title のみ) の両方を登録でき、同ステージ同スロットの二重登録が拒否される
  - _Requirements: FR-3.3, FR-3.5, NFR-3.5_
  - _Boundary: performance_slots_
  - _Depends: 1.2, 4.1, 2.1_

- [ ] 4.3 出演枠の必須一方制約をカスタム migration で担保する
  - `CHECK (exhibition_id IS NOT NULL OR title IS NOT NULL)` をカスタム migration で追加する (schema snapshot は CHECK 非対応のため)
  - 完了状態: exhibition_id と title の両方が NULL のレコード作成が DB 層で拒否される
  - _Requirements: FR-3.4_
  - _Boundary: performance_slots_
  - _Depends: 4.2_

- [ ] 5. お知らせ・固定コンテンツ・祭メタ
- [ ] 5.1 (P) お知らせ・トピック・FAQ コレクションを定義する
  - announcements: title・body・published_at を持つ
  - faq_items: question・answer・sort を持つ
  - topics: title・body・sort に加え image (NULL可)・link_url (NULL可)・attachment (PDF, NULL可) を持つ
  - 完了状態: published_at でお知らせを公開管理でき、topics に画像+リンク+PDF の告知カードを登録でき、FAQ を sort 順に取得できる
  - _Requirements: FR-5.1, FR-5.2, FR-6.1, FR-6.2, FR-6.5_
  - _Boundary: announcements, faq_items, topics_

- [ ] 5.2 (P) シングルトンページと祭メタ情報を定義する
  - page_home (blocks JSON)・page_access (content・map_embed_url)・page_contact (content・form_embed_url) をシングルトンで定義する
  - festival_meta シングルトン: name・event_days (JSON, 日ごと開催時間)・admission_fee・payment_note・parking_capacity・parking_map (画像) を持つ
  - page_access.content で交通アクセス (バス路線・時刻・徒歩距離・混雑注意) を自由記述管理する
  - 完了状態: 各シングルトンが id=1 固定で1レコードのみ保持し、祭日程・開催時間・入場料・駐車場数・駐車場マップ画像・問い合わせフォーム URL を管理できる
  - _Requirements: FR-6.3, FR-6.4, FR-6.6, FR-7.1, FR-7.2, FR-7.3_
  - _Boundary: page_home, page_access, page_contact, festival_meta_

## Integration: RBAC & 認証

- [ ] 6. ロールベースアクセス制御と認証連携
- [ ] 6.1 executive ロールを定義する
  - Directus superadmin とは別ロールとして、全コレクション・全フィールドを CRUD 可能な `executive` を定義する
  - stages・time_slots・performance_slots・sponsors を含む全コレクションをフィールド制限なしで管理できる
  - 完了状態: executive ユーザーが全コレクションを制限なく作成・更新・削除できる
  - _Requirements: NFR-1.5, NFR-1.6_
  - _Depends: 2.1, 3.1, 4.2, 5.1, 5.2_

- [ ] 6.2 student_exhibitor ロールとフィールド/レコード制限を定義する
  - CREATE (student_exhibitions)、自レコードのみ UPDATE (`user_created == $CURRENT_USER`)、全コレクション READ (published のみ) を許可する
  - UPDATE 可能フィールドを name・slug・description・content・images・status に限定する
  - is_exhibitor 相当の構造フィールド (category・location・area_id・booth_number・booth_label) と他コレクション書き込みを禁止する
  - 完了状態: student_exhibitor が他団体レコードを更新できず、許可外フィールドの更新が拒否され、公開 API は published のみ返す
  - _Requirements: NFR-1.1, NFR-1.2, NFR-1.3, NFR-1.4, NFR-4.2_
  - _Depends: 6.1_

- [ ] 6.3 Authentik OIDC 連携とグループ→ロールマッピングを設定する
  - Directus の OIDC プロバイダを Authentik に接続し、`directus-executive`→executive、`directus-org-member`→student_exhibitor をマッピングする
  - 学生が SSO ログイン後に自身で student_exhibitions を CREATE することで user_created 紐付けが自動確立される (Flow・手動 UUID コピペ不要)
  - 実行委員と学生団体のアカウントを完全に分離する
  - 完了状態: Authentik グループに応じて正しいロールが割り当てられ、学生の初回 CREATE で自レコード紐付けが成立する
  - _Requirements: NFR-2.1, NFR-2.2, NFR-2.3, NFR-2.4_
  - _Depends: 6.2_

## Validation: スキーマ書き出し & 検証

- [ ] 7. スキーマ書き出しと整合検証
- [ ] 7.1 snapshot.yaml を書き出す
  - `directus schema snapshot ./directus/schema/snapshot.yaml` で全コレクション・フィールド・リレーション・ロール権限を書き出す
  - カスタム migration (CHECK 制約) を `directus/migrations/` に配置する
  - 完了状態: snapshot.yaml に全コレクションが反映され、クリーンな Directus に `schema apply` で再現できる
  - _Requirements: FR-1.1, FR-2.1, FR-3.1, FR-4.1, FR-5.1, FR-6.1, FR-7.1_
  - _Depends: 6.3, 4.3_

- [ ] 7.2 単一エンドポイント取得と制約・権限を検証する
  - map_areas 単一エンドポイントで student_exhibitions (出展)・sponsors (type!=ad)・stages (出演場所) を子として取得できることを確認する
  - タイムテーブルをステージ・時刻順で取得し、団体なし出演の表示名解決を確認する
  - 全 UNIQUE/複合 UNIQUE/CHECK 制約と RBAC (自レコード限定 UPDATE・フィールド制限・published 限定 READ) が期待通り動作することを確認する
  - WYSIWYG content の XSS sanitize がフロントエンド消費側で必要な旨を検証チェックポイントとして記録する (実装は frontend spec に委譲)
  - 完了状態: マップ/タイムテーブル取得クエリが期待レスポンスを返し、制約・権限違反が全て拒否される
  - _Requirements: FR-1.2, FR-1.4, FR-3.6, NFR-4.1_
  - _Depends: 7.1_
