# Research & Design Decisions

## Summary
- **Feature**: `cms-admin-cleanup`
- **Discovery Scope**: Extension(既存のPayloadグローバル・コレクション・サイネージ表示判定の拡張と、フロントエンドの参照先切替)
- **Key Findings**:
  - 旧グローバルの削除と`site_settings`の新設を1回の`pnpm migrate:create`で行うと、drizzle-kitが「作成か改名か」を対話で尋ね、非対話では生成が中断する。新設+コピーと旧テーブル削除を別マイグレーションに分ければ、どちらも対話なしで生成でき、値は`INSERT … SELECT`で完全に保持できる(実測)。
  - `booth_number`は`numeric`列で、`text`化の差分は`ALTER COLUMN … SET DATA TYPE varchar`(USINGなし)になる。暗黙の代入キャストで値は`'101'`のように保持され、部分UNIQUEインデックスも自動で再構築される。一方、管理画面のテキスト入力は消去時に`''`を送り、`''`は部分UNIQUEインデックスの対象になるため、未設定の正規化が要る(実測)。
  - 5コレクションの`sort`→`orderable`(`_order`)も、追加と削除を1回で生成すると改名の対話になる。`_order`の追加・初期化と`sort`の削除を分ければ非対話で生成でき、既存行の`_order`はPayloadが埋めないため、`generateNKeysBetween`と同じキーをSQLで振って初期化する(実測)。
  - テロップのグループ所属は新テーブルを作らず、既存の`signage_groups_rels`に`telops_id`列が足される。既存テロップの所属付与は同じマイグレーション内の`INSERT … SELECT`で行える(実測)。
  - ログイン後の到着先は、招待リンクでのパスワード設定・ローカル認証・荒牧祭SSOのいずれも`/admin`で、`admin.components.beforeDashboard`のサーバーコンポーネントから学生団体だけ`redirect()`すれば全経路で自団体の企画の編集画面へ遷移する(実測)。

## Research Log

### 実測環境
- **Context**: 未確認のリスク(差分の形・値の保持)をdesign段階で確定する
- **Sources Consulted**: `HEAD`(`3c79fdb`)を`git worktree add --detach`で取り出した作業コピー、ローカルPostgres(`cms-db-1`)内に作った検証専用DB。共有DB`payload`には書き込んでいない
- **Findings**:
  - 空DBに`HEAD`のマイグレーションを全件適用した後、共有DBから`media`・`festival_meta`・`festival_meta_event_days`・`page_home`・`page_home_rels`・`signage_*`・`telops`の行をコピーし、未入力の列(`theme_description`・`og_image`・`parking_map`・`hero_message`等)と`sponsors`・`student_exhibitions`のブース番号、通常のグループ2件(表示・非表示)を足して検証した
  - 移行前後の値は`payload run`でLocal APIの`findGlobal(depth: 0)`を呼んで比較した
  - 検証後、作業コピー・検証DB・一時スクリプトはすべて削除した
- **Implications**: 以下の各項目の結論は実データに近い状態での実測に基づく

### 1. festival_meta+page_home→site_settings統合の差分
- **Context**: 旧グローバルをDROPして新グローバルをCREATEする差分になると値が消える
- **Findings**:
  - 新設だけの段階(旧グローバルを残したまま`site_settings`を足す)では、`migrate:create`は`site_settings`・`site_settings_event_days`(配列の子テーブル、`id varchar`主キー・`_parent_id`・`_order`)・`site_settings_rels`(`hero_images`の`hasMany`アップロード、`path`・`order`・`media_id`)をCREATEする。名前のないタブの項目は親テーブルの列としてそのまま並ぶ(`theme_description_html`・`overview_html`もvarchar列)
  - 新設時のマイグレーションに次を書き足して適用すると、`name`・`event_days`(子の`id`含む)・`theme_word`・`theme_description`(+HTML)・`overview`(+HTML)・`contact_form_url`・`exhibitor_contact_url`・`sns_links`・`og_image`・`hero_images`(順序含む)がLocal APIで移行前と完全一致した
    - `INSERT INTO site_settings (...) SELECT ... FROM festival_meta`(`id`・`updated_at`・`created_at`も写す)
    - `INSERT INTO site_settings_event_days SELECT ... FROM festival_meta_event_days`
    - `INSERT INTO site_settings_rels ("order", parent_id, path, media_id) SELECT r."order", s.id, r.path, r.media_id FROM page_home_rels r CROSS JOIN site_settings s WHERE r.path = 'hero_images'`
  - 旧グローバルを外す段階の`migrate:create`は`festival_meta_event_days`・`festival_meta`・`page_home`・`page_home_rels`の`DROP TABLE … CASCADE`だけを生成する
  - 両方を1回で行うと`Is site_settings_event_days table created or renamed from another table?`の対話選択が出て、標準入力が無い環境では生成が完了しない
  - 本番の`festival_meta`は`hero_image`・`theme_image`・`site_title`・`meta_description`が未入力、`page_home.hero_message_html`も未入力、`parking_map`は`og_image`と同じメディア(id 40)を指す(公開APIで確認)
- **Implications**: 新設+コピー(マイグレーションA)と旧テーブル削除(マイグレーションC)に分ける。RENAMEは使わない。`site_settings`の`id`シーケンスはコピー後に`COALESCE(max(id), 0) + 1`へ進める

### 2. booth_numberのnumber→text
- **Context**: DROP→ADDになると既存の番号が消える
- **Findings**:
  - 実列は`sponsors.booth_number`と、`student_exhibitions`のカテゴリ別グループの`exhibit_booth_number`・`vendor_booth_number`・`other_booth_number`(いずれも`numeric`)
  - 生成差分は4列とも`ALTER TABLE … ALTER COLUMN … SET DATA TYPE varchar;`で、USINGなしで適用でき、`101`→`'101'`、NULL→NULLのまま。`numeric`から`text`への変換は格納値の表記をそのまま写す(`101.0`なら`'101.0'`)
  - `sponsors_area_booth_unique`・`student_exhibitions_{exhibit,vendor,other}_area_booth_unique`(部分UNIQUE、`WHERE area IS NOT NULL AND booth IS NOT NULL`)は型変更後も同じ定義で残る
  - 生成されたdownの`SET DATA TYPE numeric`はUSINGなしでは`cannot be cast automatically`で失敗する
  - Payloadのテキスト入力(`@payloadcms/ui`の`fields/Text`)は`setValue(e.target.value)`で、消去すると`''`を保存する。同じエリアで2件が`''`になると`sponsors_area_booth_unique`違反になる(実測)
  - `cms-schema-check`は`sponsors.booth_number`の型変更を検出するが、`student_exhibitions`のグループ内の`booth_number`は検出しない
- **Implications**: upは生成差分のまま使う。downに`USING booth_number::numeric`を書き足す(英字を含む値があればdownは失敗し、それで正しい)。`''`はフィールドのフックで`null`へ正規化し、重複判定のフックも`''`を未設定として扱う

### 3. signage_groupsへのtelops追加
- **Context**: `_rels`の差分と既存テロップの所属付与
- **Findings**:
  - 生成差分は`ALTER TABLE signage_groups_rels ADD COLUMN telops_id integer`、`telops`へのFK(`ON DELETE cascade`)、`signage_groups_rels_telops_id_idx`だけで、新テーブルは作られない
  - `INSERT INTO signage_groups_rels ("order", parent_id, path, telops_id) SELECT row_number() OVER (PARTITION BY g.id ORDER BY t._order), g.id, 'telops', t.id FROM signage_groups g CROSS JOIN telops t WHERE g.is_all IS NOT TRUE`で、通常のグループ(表示・非表示とも)に全テロップが所属した。「すべて」(`is_all`)には行を作らない
  - 未認証のLocal API`find('telops')`の結果は、「すべて」が表示中の状態で移行前後とも全件(`[3, 4]`)だった
  - 本番のグループは「すべて」(`is_all`、表示)・「開場前」(表示)・「閉祭後」(表示)の3件、テロップは1件(公開API)
- **Implications**: 「すべて」は所属行を持たず全件が属するものとして計算する既存の規則(`signage-groups.ts`のコメント、`slides`の`access.update`)をテロップにも当てる。requirements 8.8の「すべての通常のグループ」はこの規則と一致する

### 4. デプロイ順序
- **Context**: フロントエンドとCMSは別デプロイ単位で、反映の速さが違う
- **Findings**:
  - `frontend-ci.yml`はmainへのpushで即座に本番Workerを更新する。`cms-ci.yml`はmainへのpushでイメージをpushし、`aramakisai-infra`へのタグ更新PRのマージ後にArgoCDのPreSync Jobが`payload migrate`を実行してからDeploymentを更新する
  - したがってフロントエンドとCMSの変更を1つのPRでmainへ入れると、フロントエンドが先に`site_settings`を読み、CMSが未反映の間は404になる
  - フロントエンドは`festival_meta`を`festival-meta.ts`・`home-page.ts`・`parking-data.ts`・`signage-data.ts`・`sns-links.ts`・`timetable.ts`・`sitemap.ts`の7ファイルから、`page_home`を`home-page.ts`から読む。CMS内部では`auth/invitation.ts`・`hooks/payload-constraints.ts`・`components/useEventDays.ts`・seedスクリプトが`festival_meta`を読む
  - フロントエンドのコードは`booth_number`を参照していない(`cms-types.ts`の型だけ)
  - `cms-schema-check`は、新設段階では`sponsors.booth_number`の型変更だけを、削除段階では加えて`festival_meta`・`page_home`の削除を検出した
- **Implications**: CMS先行の追加(A)→フロントエンド切替(B)→CMSの旧グローバル削除(C)の3回のデプロイに分ける。requirementsの「削除の反映時には参照しないフロントエンドがデプロイ済み」(3.9)と、破壊的変更はフロントエンドの安定稼働を確認してからラベルを付ける運用(Boundary Context)をそのまま満たす

### 5. 表示順のorderable化(sort→_order)
- **Context**: requirements 9。5コレクション(`faq_items`・`map_areas`・`parking_lots`・`sponsors`・`stages`)の数値`sort`を、`signage_slides`・`telops`と同じ`orderable: true`の`_order`に置き換える。`pages`・`topics`は`orderable`にせず`sort`を削除するだけ。実測は7コレクションすべてを`orderable`にした形で行い、5コレクションに絞っても差分の形(テーブルごとの`ADD COLUMN`・インデックス・`DROP COLUMN`)は同じ
- **Sources Consulted**: `payload@3.88.0`の`dist/config/orderable/index.js`・`fractional-indexing.js`、`@payloadcms/drizzle@3.88.0`の`dist/queries/buildOrderBy.js`、公開API
- **Findings**:
  - `orderable: true`の追加と`sort`の削除を1回で`migrate:create`すると`Is _order column in topics table created or renamed from another column?`の対話選択が出て、非対話では生成が完了しない
  - `sort`を残したまま`orderable: true`だけを足すと、生成差分は7テーブルへの`ADD COLUMN "_order" varchar`と`<table>__order_idx`の作成だけになる。その後`sort`を外すと`DROP COLUMN "sort"`だけが生成される(いずれも非対話)
  - Payloadは既存行の`_order`を埋めない。`beforeChange`フックが`_order`の無い文書の保存時に末尾のキーを振るだけなので、初期化はマイグレーションで行う必要がある
  - キーは`BASE_36_DIGITS`(`0-9a-z`、小文字のみ)で、`generateNKeysBetween(null, null, n)`は`a0`…`az`(36件)の次が`b00`…`bzz`(1296件)になる。小文字のみなのでDBの照合順序`en_US.utf8`でも文字コード順と並びが一致する
  - SQLで行番号`r`から`r < 36`なら`'a' || 桁(r)`、それ以外は`'b' || 桁(r / 36) || 桁(r % 36)`を作ると、`generateNKeysBetween`の出力と一致した(`ay az b00 b01`)。`generateKeyBetween('az', null)`は`b00`、`generateKeyBetween('a3', 'a4')`は`a3i`で、初期化後のキーの間・末尾にPayloadが正しくキーを振れる
  - Payloadの`sort`指定の並びは、`buildOrderBy`が`-createdAt`を必ず後ろに足すため「`sort`昇順(PostgresのASCでnullは末尾)→作成日時の新しい順」になる。ローカルで同値・nullを混ぜた6件で確認し、初期化した`_order`順と一致した(`3,6,1,4,2,5`)
  - 本番の7コレクションは`sort`が全件null(公開API)。そのため現在の並びは作成日時の新しい順(管理画面・REST、例: `stages`は`4,3,2,1`)
  - フロントエンドの現在の並び:
    - `faq.ts`・`sponsors.ts`・`campus-map.ts`・`exhibitions.ts`はRESTの`sort: ['sort']`(=作成日時の新しい順)。`campus-map.ts`は加えて`sort`昇順・null末尾の安定ソートをかける
    - `parking-data.ts`は`parking_statuses`の取得順に`lot.sort`昇順・null末尾の安定ソートをかける(本番は`4,3,2,1`)
    - `timetable.ts`の`toTimetable`(タイムテーブル・サイネージ)は`(sort ?? 0)`昇順→`id`昇順で並べる。本番の`stages`は`1,2,3,4`(武道館・屋内・野外・GB155)で、管理画面の並び(`4,3,2,1`)と逆
    - `topics`は`home-page.ts`・`topics.ts`とも`-published_at`で、`sort`を使っていない
    - `pages`は`slug`での単件取得と`sitemap`の更新日時取得だけで、並びを使う表示がない
  - RESTの応答に`_order`が含まれる(`telops`で確認)。`orderable`が足す項目は`admin.hidden`だけで、APIからは隠れない
  - `cms-schema-check`は`sort`の削除を7件とも検出する
- **Implications**: `_order`の追加と初期化はA、フロントエンドの`_order`への切替はB、`sort`の削除(`pages`・`topics`を含む7コレクション)はCに置く。`topics`のフロントエンドは`-published_at`のまま、`pages`は並びを使わないため、両者はフロントエンドの変更が無い。初期化の並びは`stages`だけ現在のタイムテーブルの並び(`COALESCE(sort, 0)`昇順→`id`昇順)、ほかはPayloadの`sort`の並び(`sort`昇順・null末尾→`created_at`降順→`id`降順)にする。いずれも9.3の「表示順の値による並び」を満たし、同値・nullの間は来場者に見えている並びを保つ

### サイドバー分類
- **Context**: requirements 6
- **Sources Consulted**: `payload@3.88.0`の`collections/config/types.d.ts`・`globals/config/types.d.ts`
- **Findings**: コレクション・グローバルとも`admin.group?: false | Record<string, string> | string`を持つ。`signage_settings`は現在`admin.hidden: true`でサイドバーに出ない
- **Implications**: 分類は`admin.group`の文字列で行う。`signage_settings`は6.5に従い`admin.hidden: true`のまま分類しない

### 6. 模擬店メニューの価格のtext→number
- **Context**: requirements 10。`student_exhibitions`の`vendor.menu[].price`(text、maxLength 255、空白をnullにする`beforeValidate`)を0以上の整数にする
- **Sources Consulted**: ローカル検証DB(上記と同じ手順で作成・削除)、`payload@3.88.0`の`fields/config/types.d.ts`、公開API、ユーザー回答
- **Findings**:
  - 本番の`price`は未入力(ユーザー回答)
  - 実列は`student_exhibitions_vendor_menu.price`(`character varying`)。`type: 'number'`・`min: 0`にした`migrate:create`の差分は`ALTER COLUMN "price" SET DATA TYPE numeric;`の1文だけ(非対話)。USINGなしでは`column "price" cannot be cast automatically to type numeric`で失敗する
  - Payloadの`number`フィールドに整数だけを受ける設定は無い(`min`・`max`・`hasMany`等)。整数は`validate`で検査する
  - サイト内の既存の価格表記は、本番トピックの本文にある`1200円`・`900円`(各2回)で、桁区切りがない。フロントエンドのコードに価格の整形処理は無い
  - `cms-schema-check`はグループ内の配列項目の型変更を検出しない(`booth_number`と同じ)
  - フロントエンドは`exhibitions.ts`の`ExhibitionMenuItem.price: string`をそのまま`exhibition-menu.tsx`で表示し、`row.price == null`の行を除く。`cms-types.ts`が`number`になると、この`string`への代入で型検査が通らない
- **Implications**:
  - 生成差分に`USING "price"::numeric`だけを足す。既存値が無いため10.3は満たされる
  - 価格は`300円`の形(桁区切りなし)で表示する
  - 型変更はAに置き、同じPRでフロントエンドを数値の表示にする。価格つきの行が本番に無いので、フロントエンドとCMSの反映の前後で表示は変わらず、両方の型を受ける移行期間は要らない

### 所属編集のUI部品
- **Context**: requirements 8.2(スライドと同じ操作)
- **Findings**: `SignageGroupSlidesField.tsx`は`useDocumentDrawer({ collectionSlug: 'signage_slides' })`・`fetchAllSlides`(`/api/signage_slides?select[title]`)・`addSlideToGroup`(`slides`を更新)と、スライド固有の値を直接持つ
- **Implications**: 対象コレクション・見出しの項目・グループ側の項目名を引数にとる部品へ一般化し、スライドとテロップの両方の所属欄で使う

### 7. 学生団体のログイン後の遷移
- **Context**: requirements 11。ログイン経路ごとの到着先と、Payload 3.88で使える管理画面の差し込み点
- **Sources Consulted**: `@payloadcms/next@3.88.0`の`dist/views/Login/index.js`・`Login/LoginForm/index.js`・`ResetPassword/ResetPasswordForm/index.js`・`Dashboard/index.js`・`Dashboard/Default/index.js`、`payload@3.88.0`の`dist/config/types.d.ts`(`admin.components`)、`cms/src/auth/authentik-endpoints.ts`・`role-mapping.ts`・`collections/users.ts`・`access/policy.ts`、ローカル検証(下記)
- **Findings**:
  - ローカル認証のフォームは`redirect: getSafeRedirect({ fallbackTo: adminRoute, redirectTo: searchParams?.redirect })`で、`redirect`クエリが無ければ`/admin`へ遷移する
  - 招待リンクのパスワード設定(`/admin/reset/{token}`)は成功後に`fetchFullUser()`し、ログイン済みなら`history.push(adminRoute)`で`/admin`へ遷移する
  - 荒牧祭SSOのコールバックは`Location: /admin`を返す。グループ写像(`GROUP_TO_ROLE`)は実行委員だけで、学生団体のレコードでログインするとロールが実行委員に切り替わるため、SSOで学生団体のセッションはできない
  - 学生団体の作成時は渡されたパスワードが捨てられ(`replaceInitialPassword`)、パスワードは招待リンクでしか設定できない。学生団体の最初のログインは招待リンク、以降はローカル認証
  - `admin.components.beforeDashboard`(`CustomComponent[]`)は`DefaultDashboard`の先頭でサーバーコンポーネントとして描画され、`payload`・`user`を受け取る。`admin.components.views.dashboard`はダッシュボード全体の置き換えで、既定の表示を自前で描き直す必要がある
  - 学生団体の`student_exhibitions`の読み取り条件は`ownerFilter`(`owner = ログインユーザー`)。`owner`の項目アクセスは`read: executiveOnlyField`
  - `pnpm generate:importmap`は設定の読み込みで`DATABASE_URL`を要求する
  - ローカル検証: `dev`(`3c79fdb`)を`git worktree add --detach`で取り出し、検証専用DBに全マイグレーションを適用して実行委員1人・学生団体2人(1人だけ学生企画を所有)を作った。`beforeDashboard`に、学生団体のときだけ`payload.find({ collection: 'student_exhibitions', user, overrideAccess: false, depth: 0, limit: 1 })`の結果へ`redirect()`する試作を置き、`make cms-worktree`で起動してブラウザで確かめた
    - 所有ありの学生団体: 招待リンクでのパスワード設定後・ローカル認証後とも`/admin/collections/student_exhibitions/1`(編集画面)に着いた。ログイン済みで`/admin`を直接開いても(SSOのコールバックと同じ全画面遷移)編集画面へ移った
    - 所有なしの学生団体: 招待リンク・ローカル認証とも`/admin`のダッシュボードに着いた
    - 実行委員: ローカル認証後に`/admin`のダッシュボードに着いた
    - 作業コピー・検証DB・一時スクリプトは削除し、起動したサーバーは止めた
- **Implications**:
  - 全経路の到着先が`/admin`なので、差し込み点は`beforeDashboard`の1か所でよい。SSOのコールバック・ログインフォーム・パスワード設定フォームは変えない
  - 企画の特定は既存の読み取り条件に委ね、学生団体の閲覧範囲・権限は変えない

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 1回で統合 | 旧グローバル削除と新設を1つのマイグレーション・1つのPRで行う | PRが1つ | 生成が対話になる。フロントエンドが先に反映され404。削除の検出が出たままフロントエンドの安定稼働を確認できない | 不採用 |
| CMS先行の3段階 | A: 新設+コピー・`_order`の追加と初期化(旧グローバルと`sort`は管理画面で非表示)、B: フロントエンド切替、C: 旧テーブルと`sort`の削除(`price`の数値化はA) | 各段階で本番が壊れない。生成が非対話。3.9とラベル運用に一致 | AとBの間はサイト設定の編集がサイトに出ない | 採用 |
| フロントエンド先行のフォールバック | フロントエンドが`site_settings`を読み、404なら旧グローバルを読む | CMSの段階が1回で済む | フロントエンドに一時コードが入り後で消す必要がある。マイグレーションは結局1回で対話になる | 不採用 |

## Design Decisions

### Decision: 統合はRENAMEではなく新設+INSERT…SELECT
- **Context**: requirements 1.2(値の保持)
- **Alternatives Considered**:
  1. `ALTER TABLE festival_meta RENAME TO site_settings`と列の削除・`page_home_rels`の付け替え
  2. 新設テーブルへのINSERT…SELECTと、後段での旧テーブルDROP
- **Selected Approach**: 2
- **Rationale**: 2つのグローバルを1つにする統合で、RENAMEでは`page_home_rels`の付け替えが別に要り、生成差分も対話になる。2は生成差分に数文を足すだけで、実測で全項目の一致を確認した
- **Trade-offs**: AからCまでの間、旧テーブルが残る(読まれるが編集されない)
- **Follow-up**: CI(`cms-ci`の`migrate`)は空DBで適用するため、コピー文が0件でも失敗しない形にする

### Decision: 移行期間中の旧グローバルは管理画面で非表示
- **Context**: AとBの間、フロントエンドは旧グローバルを読み、実行委員はサイト設定を編集する
- **Alternatives Considered**:
  1. 旧グローバルを表示したまま残す
  2. `admin.hidden: true`で管理画面から隠す(APIの読み取りは残す)
- **Selected Approach**: 2
- **Rationale**: 両方が編集できると、Bの切替時にどちらの値が正か分からなくなる。1.3の「管理画面に表示しない」をAの時点で満たし、APIの提供停止はCで満たす
- **Trade-offs**: AとBの間に編集したサイト設定の値は、Bのデプロイまでサイトに出ない

### Decision: ブース番号の未設定は`null`に正規化
- **Context**: requirements 7.3、7.4。テキスト入力は消去時に`''`を保存し、部分UNIQUEインデックスは`''`を対象にする
- **Selected Approach**: `booth_number`フィールドの`beforeChange`で`''`(前後空白のみを含む)を`null`にする。重複判定のフック(`payload-constraints.ts`)は`== null`ではなく既存の`hasValue`相当で`''`を未設定として扱う
- **Rationale**: 正規化しないと、同じエリアで番号を消した2件目の保存がDB制約違反(500)になる

### Decision: `_order`の初期化はSQLでキーを作る
- **Context**: requirements 9.3。Payloadは既存行の`_order`を埋めず、キー生成関数は`payload`の公開エクスポートに無い
- **Alternatives Considered**:
  1. マイグレーション内でLocal APIを使い1件ずつ更新する
  2. `row_number()`からfractional indexingと同じ形のキーをSQLで作り、1文で更新する
- **Selected Approach**: 2
- **Rationale**: 1は保存フック(通知・制約)を全件で走らせる。2は実測で`generateNKeysBetween`と同じキーになり、Payloadが以後のキーを正しく振れる
- **Trade-offs**: 1テーブル1332件(`a`36件+`b`1296件)が上限。最大の`map_areas`は本番16件

### Decision: 同値・nullの初期化順は、来場者に見えている並びを保つ
- **Context**: 本番の`sort`は全件nullで、9.3の「表示順の値による並び」は同値の間の順を決めない
- **Selected Approach**: `stages`は`COALESCE(sort, 0)`昇順→`id`昇順(`toTimetable`の現在の並び)。ほかは`sort`昇順・null末尾→`created_at`降順→`id`降順(PayloadのREST・管理画面の並び)
- **Rationale**: `stages`を作成日時の新しい順で初期化すると、本番のタイムテーブルとサイネージのステージ列が逆順(GB155・野外・屋内・武道館)になる
- **Trade-offs**: `stages`の管理画面の並びは移行後に`1,2,3,4`へ変わる

### Decision: 価格の型変更はAに置き、フロントエンドを同じPRで直す
- **Context**: requirements 10。`cms-types.ts`の更新とフロントエンドの型は同じPRでそろえる必要がある
- **Selected Approach**: Aのマイグレーションに`price`の型変更(`USING "price"::numeric`)を入れ、同じPRで`exhibitions.ts`・`exhibition-menu.tsx`を数値+「円」の表示にする
- **Rationale**: 本番は未入力で、反映の順序によらず価格つきの行が無い。B・Cに分けたり両対応の型を作ったりする必要がない
- **Trade-offs**: Aのマージまでに文字列の価格が入力されると、数値でない値でAのマイグレーションが失敗する(Deploymentは更新されない)。Aまで価格を入力しない運用で避ける

### Decision: 所属欄の部品を一般化
- **Context**: requirements 8.2
- **Selected Approach**: `SignageGroupSlidesField.tsx`を、`clientProps`で`{ collection, titleField, groupField }`を受け取る所属欄`SignageGroupMembersField.tsx`にする
- **Rationale**: テロップ用に複製すると同じ操作の実装が2つになり、片方だけ直る

### Decision: 学生団体の遷移はダッシュボードの前で行う
- **Context**: requirements 11。ログイン経路が招待リンク・ローカル認証・SSOの3つある
- **Alternatives Considered**:
  1. 各経路の遷移先を変える(SSOのコールバックの`Location`、ログインフォーム・パスワード設定フォームの差し替え)
  2. `admin.components.views.dashboard`でダッシュボードを置き換える
  3. `admin.components.beforeDashboard`のサーバーコンポーネントで、学生団体だけ`redirect()`する
- **Selected Approach**: 3
- **Rationale**: 全経路が`/admin`に着くため1か所で済む。1はPayload組み込みのフォーム2つの差し替えが要り、SSOは学生団体の経路でもない。2は既定のダッシュボードを描き直す必要がある。3はローカルで全経路の遷移を確認した
- **Trade-offs**: 所有する企画がある学生団体は、ログイン後に限らずダッシュボードを開くたびに編集画面へ移る
- **Follow-up**: マイグレーション・スキーマ変更・フロントエンドの変更を伴わず他の変更と独立するため、PR Aに入れる(CMSの変更をまとめるPRで、B・Cの順序制約を受けない)

## Risks & Mitigations
- AのPreSyncでコピーした後、古いPodが応答している数分間に旧グローバルを編集すると、その編集はサイト設定に入らない — 旧グローバルはAのイメージで非表示になるだけなので、Aのデプロイ中は祭基本情報・トップページを編集しない(デプロイ手順に明記)
- アクセス文言は本番値が`'a'`で、Bの後は3.8の固定文言に変わる — requirements 3.8の指定どおりの変化として扱う
- 移行後に作ったテロップはどの通常のグループにも属さず、「すべて」が非表示の間は出ない — requirements 8.5の指定どおり。所属は作成後にグループの編集画面で付ける
- `student_exhibitions`のグループ内`booth_number`の型変更は`cms-schema-check`で検出されない — Aで`sponsors.booth_number`の検出に対してラベルを付ける際、同じ判断で学生企画の型変更も扱う。フロントエンドはどちらも参照しない


## References
- `payload@3.88.0` `dist/globals/config/types.d.ts`・`dist/collections/config/types.d.ts` — `admin.group`の型
- `@payloadcms/ui` `dist/fields/Text/index.js` — テキスト入力の`setValue(e.target.value)`
- `cms/src/migrations/20260827_084500_schema_constraints.ts`ほか — 部分UNIQUEインデックスの定義
- `.github/workflows/cms-ci.yml`・`frontend-ci.yml` — デプロイ経路
- `@payloadcms/next@3.88.0` `dist/views/Login/LoginForm/index.js`・`ResetPassword/ResetPasswordForm/index.js`・`Dashboard/Default/index.js` — ログイン後の遷移先と`beforeDashboard`の描画位置
- `payload@3.88.0` `dist/config/types.d.ts` — `admin.components.beforeDashboard`・`views.dashboard`の型
