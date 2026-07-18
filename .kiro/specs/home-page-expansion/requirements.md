# Requirements Document

## Project Description (Input)
トップページの拡充。お知らせのテーブル、トピックのカード、festival_metaの概要を表示するコンポーネントを追加したい
また、festival_metaに祭の概要を書くwysiwygを追加したい。トピックやお知らせの添付画像やファイルは複数登録可能に変更

## Introduction
既存の `page-home-friendly-editing` spec (実装完了済み) により、Home Page は `page_home`/`page_home_live` の2バリアント構成でお知らせ (`announcements`) とトピックス (`topics`) を表示できる状態にある。本 spec はその上に、(1) お知らせのテーブル形式表示、(2) トピックカードの添付複数化対応、(3) `festival_meta` の祭概要 (WYSIWYG) を表示する専用コンポーネントを追加する。あわせて `topics`/`announcements` の添付ファイルを単一から複数登録可能なスキーマへ拡張する。前 spec が `announcements`/`topics` collection 自体のフィールド変更を明示的に Out of Boundary としていたため、本 spec がその領域を引き継ぐ。さらに、既存では一覧表示のみだった `topics`/`announcements` について、各記事の詳細を確認できる専用ページ (個別記事ページ) と、トピックス側の一覧ページを追加する。加えて `festival_meta` にヒーロー画像フィールドを追加し、開催日程・入場料等を整理して表示する `festival_meta` 専用の概要ページ (About ページ、`aramakisai.com/2025/about` の情報構成を参考) を新設する。

## Boundary Context (Optional)
- **In scope**:
  - `festival_meta` への祭概要 WYSIWYG フィールド追加、および Home Page 上でそれを表示するコンポーネントの新設
  - `announcements` の表示をテーブル形式へ変更 (既存 `AnnouncementsList` の表示ロジック変更)
  - `topics` カード表示の複数添付ファイル対応 (既存 `TopicsList` の表示ロジック変更)
  - `topics`/`announcements` の添付ファイルスキーマを単一 `file-image` フィールドから複数ファイル登録可能な構成 (M2M junction 等) へ additive に拡張
  - 上記スキーマ変更に伴う RBAC (Public 読み取り, `executive` CRUD) の権限付与
  - `topics` の一覧ページ (`/topics` 相当) の新設 (既存 Home Page のトピックカードと共通のカードコンポーネントを再利用)
  - `topics` の個別記事ページ (`/topics/[id]` 相当) の新設
  - `announcements` の個別記事ページ (`/announcements/[id]` 相当) の新設 (既存の一覧ページ `frontend/src/app/announcements/page.tsx` は変更対象、テーブル形式化を含む)
  - サイト共通 Footer (`frontend/src/components/footer.tsx`) への `festival_meta.sns_links` アイコンリンク表示追加 (全ページ共通)
  - `festival_meta` へのヒーロー画像フィールド追加、および `festival_meta` の情報 (ヒーロー画像・開催日程・入場料・支払い注記・概要WYSIWYG) を整理して表示する About ページ (`/about` 相当) の新設
  - ヘッダー共通ナビゲーションへの `/topics`・`/about` へのリンク追加
- **Out of scope**:
  - `page_home`/`page_home_live`/`festival_meta.home_active_variant` によるバリアント切替ロジック自体の変更 (既存のまま利用)
  - `student_exhibitions`/`sponsors`/`stages`/`performance_slots`/`map_areas`/`time_slots`/`faq_items` 等、他 collection の変更
  - `dev.aramakisai.com` レビュー環境や CI/CD ワークフロー自体の変更
  - 最終的なビジュアルデザイン (Figma) の確定
  - 会場住所・地図等のアクセス情報 (既存 `/access` ページの責務のまま。About ページでは扱わない)
  - `festival_meta` へのテーマ画像・主要イベント一覧・公式キャラクター等、参考サイトにあるが現行スキーマに存在しないフィールドの新設 (本specでは既存スキーマ+ヒーロー画像+概要WYSIWYGの範囲に限定する)
  - Home Page (`page.tsx`) 自体への `festival_meta` ヒーロー画像の表示 (Home Page は `page_home`/`page_home_live` の `hero_image` を既に使用しており、本specの `festival_meta` ヒーロー画像は About ページ専用とする)
- **Adjacent expectations**: `page-home-friendly-editing` spec の Revalidation Triggers (「`announcements`/`topics` のスキーマ変更があった場合、Home Page 側の表示ロジックを再確認する」) に基づき、本 spec 完了後は同 spec の design.md 記述との整合を確認する。

## Requirements

### Requirement 1: お知らせのテーブル形式表示
**Objective:** As a 一般来場者, I want トップページのお知らせを一覧性の高いテーブル形式で見る, so that 複数のお知らせを素早く比較・確認できる

#### Acceptance Criteria
1. While Home Page がお知らせを1件以上保持している, the Home Page shall 公開日時・タイトルを列とするテーブル形式で `announcements` を一覧表示する
2. When お知らせの一覧が表示される, the Home Page shall 各行を `published_at` の降順で並べる
3. If `announcements` が0件である, then the Home Page shall 「お知らせはありません」の案内を表示する
4. When ユーザーがテーブル内のお知らせ行を選択する, the Home Page shall 当該お知らせの本文 (リッチテキスト) および添付ファイルを閲覧できる状態にする
5. The Home Page shall 既存の `AnnouncementSummary` 型が保持する `title`/`body`/`publishedAt` に加え添付ファイル情報を用いてテーブルを描画する

### Requirement 2: トピックカードの複数添付対応表示
**Objective:** As a 一般来場者, I want トピックスのカードで複数の画像・添付ファイルを閲覧する, so that 1つのトピックについてより多くの視覚情報を得られる

#### Acceptance Criteria
1. While トピックが複数の添付ファイルを保持している, the Home Page shall そのトピックのカード上に全ての添付画像をサムネイル一覧として表示する
2. When トピックの添付ファイルに画像以外の形式 (PDF等) が含まれる, the Home Page shall 画像はサムネイル表示、非画像ファイルはダウンロード用リンクとして表示する
3. If トピックに添付ファイルが1件も存在しない, then the Home Page shall 従来通りタイトル・本文・リンクのみのカードを表示する
4. The Home Page shall 既存のグリッドレイアウト (カード形式) を維持したまま複数添付を1カード内に収める
5. If トピックにサムネイル画像 (添付画像の先頭、または旧 `image` フィールド) が1件も登録されていない, then the トピックカード共通コンポーネント shall `frontend/public/images/` 配下に配置する NO IMAGE 差し替え画像をサムネイル領域に表示する
6. The NO IMAGE 差し替え画像 shall Home Page のトピックカード・トピックス一覧ページ (Requirement 8)・トピックス個別記事ページ (Requirement 9) の全てで共通コンポーネント経由で一貫して使用される

### Requirement 3: festival_meta 概要表示コンポーネント
**Objective:** As a 一般来場者, I want トップページで祭全体の概要文を読む, so that 祭のコンセプトや案内を数値情報 (開催日程・入場料) とは別に把握できる

#### Acceptance Criteria
1. When `festival_meta` に概要 (WYSIWYG) が設定されている, the Home Page shall 専用の概要コンポーネントとしてそのリッチテキストを表示する
2. If `festival_meta` の概要が未設定 (空文字列またはNULL) である, then the Home Page shall 概要コンポーネントを描画しない
3. The Home Page shall 概要コンポーネントを既存の `FestivalOverview` (開催日程・入場料) コンポーネントとは独立した表示ブロックとして配置する
4. The Home Page shall 概要コンポーネントのリッチテキストを既存の `RichText` コンポーネント経由でサニタイズして描画する

### Requirement 4: festival_meta への概要WYSIWYGフィールド追加
**Objective:** As a 荒牧祭実行委員, I want Directus管理画面で祭の概要文をWYSIWYGエディタで入力する, so that フォーマット付きの説明文を非エンジニアでも安全に編集できる

#### Acceptance Criteria
1. The `festival_meta` collection shall 祭概要を保持する新規フィールド (rich-text-html インターフェース) を追加する
2. The Directus schema snapshot shall 既存フィールドの削除・型変更を伴わない additive な差分としてこの追加を表現する
3. When 実行委員 (`executive` ロール) が Directus 管理画面で `festival_meta` を編集する, the Directus shall 新規概要フィールドをWYSIWYGエディタとして表示する
4. The 新規概要フィールド shall 未入力を許容する (NOT NULL 制約を課さない)

### Requirement 5: topics 添付ファイルの複数登録対応
**Objective:** As a 荒牧祭実行委員, I want トピックスに画像・ファイルを複数登録する, so that 1つのトピックに関する資料を過不足なく掲載できる

#### Acceptance Criteria
1. The `topics` collection shall 複数のファイルを関連付け可能な添付フィールド (M2M junction 等の additive な構成) を新設する
2. The Directus schema snapshot shall 既存の単一 `image` フィールドを削除・型変更せず維持したまま、新規添付フィールドを追加する
3. When 実行委員が既存の `topics.image` にファイルを保持したレコードを編集する, the Directus shall 既存データを損なわずに新規添付フィールドへの追加登録を可能にする
4. When 実行委員 (`executive` ロール) が新規添付フィールドにファイルを登録する, the Directus RBAC shall その操作を許可する
5. When 匿名ユーザーが Public API 経由で `topics` を取得する, the Directus RBAC shall 新規添付フィールドおよび関連ファイルの読み取りを許可する

### Requirement 6: announcements 添付ファイルの複数登録対応
**Objective:** As a 荒牧祭実行委員, I want お知らせに画像・ファイルを複数登録する, so that お知らせの内容を裏付ける資料や画像を添付できる

#### Acceptance Criteria
1. The `announcements` collection shall 複数のファイルを関連付け可能な添付フィールド (M2M junction 等の additive な構成) を新設する
2. The Directus schema snapshot shall 既存の `id`/`title`/`body`/`published_at` フィールドを変更せず、新規添付フィールドのみを追加する
3. When 実行委員 (`executive` ロール) が新規添付フィールドにファイルを登録する, the Directus RBAC shall その操作を許可する
4. When 匿名ユーザーが Public API 経由で `announcements` を取得する, the Directus RBAC shall 新規添付フィールドおよび関連ファイルの読み取りを許可する
5. The 新規添付フィールド shall 未登録 (0件) を許容する

### Requirement 8: トピックス一覧ページ
**Objective:** As a 一般来場者, I want Home Page 以外の場所でもトピックス全件を一覧で見る, so that Home Page に載りきらないトピックスも含めて全件確認できる

#### Acceptance Criteria
1. The システム shall トピックス一覧専用のページ (ルート) を新設する
2. When ユーザーがトピックス一覧ページにアクセスする, the トピックス一覧ページ shall 全ての `topics` をカード形式で表示する
3. The トピックス一覧ページ shall Home Page のトピックカードと同一の共通カードコンポーネント (Requirement 2 で拡張したもの) を再利用して描画する
4. If `topics` が0件である, then the トピックス一覧ページ shall 空状態の案内を表示する
5. When ユーザーがトピックス一覧ページ上のカードを選択する, the トピックス一覧ページ shall 当該トピックの個別記事ページへ遷移させる
6. The サイト共通ヘッダーナビゲーション shall トピックス一覧ページへのリンクを表示する

### Requirement 9: トピックス個別記事ページ
**Objective:** As a 一般来場者, I want 個々のトピックの詳細ページを見る, so that カード上の要約だけでは収まらない本文・複数添付ファイルを確認できる

#### Acceptance Criteria
1. The システム shall トピックスの個別記事ページ (トピックごとに一意なルート) を新設する
2. When ユーザーが存在する `topics` レコードの個別記事ページにアクセスする, the トピックス個別記事ページ shall タイトル・本文 (リッチテキスト)・全添付ファイル (Requirement 2/5 で拡張した複数添付) を表示する
3. If アクセスされた個別記事ページに対応する `topics` レコードが存在しない, then the トピックス個別記事ページ shall 既存の 404 ページ (`not-found.tsx`) を描画する
4. The トピックス個別記事ページ shall 添付ファイルのうち画像はサムネイル表示、非画像ファイルはダウンロード用リンクとして表示する

### Requirement 10: お知らせ個別記事ページ
**Objective:** As a 一般来場者, I want 個々のお知らせの詳細ページを見る, so that テーブル上の要約だけでは収まらない本文・添付ファイルを確認できる

#### Acceptance Criteria
1. The システム shall お知らせの個別記事ページ (お知らせごとに一意なルート) を新設する
2. When ユーザーが存在する `announcements` レコードの個別記事ページにアクセスする, the お知らせ個別記事ページ shall タイトル・公開日時・本文 (リッチテキスト)・全添付ファイル (Requirement 6 で追加した複数添付) を表示する
3. If アクセスされた個別記事ページに対応する `announcements` レコードが存在しない, then the お知らせ個別記事ページ shall 既存の 404 ページ (`not-found.tsx`) を描画する
4. When ユーザーが既存のお知らせ一覧ページ (Requirement 1 のテーブル形式) の行を選択する, the お知らせ一覧ページ shall 対応する個別記事ページへ遷移させる

### Requirement 12: フッターへのSNSアイコンリンク表示
**Objective:** As a 一般来場者, I want どのページからでもフッターで公式SNSへアクセスする, so that Home Page以外を閲覧中でも公式SNSにすぐたどり着ける

#### Acceptance Criteria
1. The サイト共通 Footer コンポーネント shall `festival_meta.sns_links` を全ページ (Home Page/お知らせ/トピックス/固定ページ等) で共通表示する
2. When `sns_links` の各エントリが既知のプラットフォーム (例: X, Instagram) に一致する, the Footer shall 対応するアイコンとともにリンクを表示する
3. If `sns_links` のエントリが既知プラットフォームのいずれにも一致しない, then the Footer shall プラットフォーム名のテキストラベル付きの汎用アイコンでリンクを表示する
4. The Footer のSNSアイコンリンク shall スクリーンリーダー向けにプラットフォーム名を伝えるアクセシブルラベル (`aria-label` 等) を持つ
5. If `festival_meta.sns_links` が0件である, then the Footer shall SNSリンク領域を描画しない
6. The Footer のSNSアイコンリンク shall 既存の `SnsLinks` コンポーネントが受け取る `SnsLink` 型 (`platform`/`url`) をそのまま利用する

### Requirement 13: festival_meta へのヒーロー画像フィールド追加
**Objective:** As a 荒牧祭実行委員, I want Directus管理画面で祭全体のヒーロー画像を登録する, so that About ページで祭の雰囲気を伝える画像を掲載できる

#### Acceptance Criteria
1. The `festival_meta` collection shall ヒーロー画像用の新規フィールド (`file-image` インターフェース, `directus_files` へのM2O) を追加する
2. The Directus schema snapshot shall 既存フィールドの削除・型変更を伴わない additive な差分としてこの追加を表現する
3. When 実行委員 (`executive` ロール) が Directus 管理画面で `festival_meta` を編集する, the Directus shall 新規ヒーロー画像フィールドをファイル選択UIとして表示する
4. The 新規ヒーロー画像フィールド shall 未登録を許容する (NOT NULL 制約を課さない)
5. When 匿名ユーザーが Public API 経由で `festival_meta` を取得する, the Directus RBAC shall 新規ヒーロー画像フィールドの読み取りを許可する (既存 `fields: "*"` 権限による自動カバーを確認する)

### Requirement 14: festival_meta 情報の About ページ
**Objective:** As a 一般来場者, I want 祭全体の概要・開催情報をまとめたページを見る, so that Home Page とは別に祭の基本情報をじっくり確認できる

#### Acceptance Criteria
1. The システム shall `festival_meta` の情報を表示する About 専用ページ (`/about` 相当) を新設する
2. When ユーザーが About ページにアクセスする, the About ページ shall `festival_meta` のヒーロー画像 (Requirement 13)・開催日程・入場料・支払い注記を整理された構造 (表形式または見出し付きブロック) で表示する
3. The About ページ shall `festival_meta` の概要 (WYSIWYG, Requirement 3/4) を既存の概要表示コンポーネントを再利用して表示する
4. If `festival_meta` のヒーロー画像が未登録である, then the About ページ shall ヒーロー画像領域を描画しない
5. If `festival_meta` の開催日程・入場料が共に未設定である, then the About ページ shall 該当する開催情報ブロックを描画しない
6. The サイト共通ヘッダーナビゲーション shall About ページへのリンクを表示する

### Requirement 11: additive-only制約とスキーマ変更の安全な反映
**Objective:** As a 開発者, I want 本 spec のスキーマ変更が additive-only ルールと既存 CI ゲートを満たしている, so that 本番 Directus DB に安全に反映できる

#### Acceptance Criteria
1. The `directus/schema/snapshot.yaml` の差分 shall `additive-schema-check.yml` (`check-additive-schema.ts`) の検出対象となる collection/field 削除・型変更・`is_nullable: true→false` を含まない
2. If 新規添付フィールドの実現に custom migration (RBAC・junction の複合制約等) が必要である, then the `directus/migrations/` shall 命名規則 `YYYYMMDD{連番サフィックス}-説明.js` に従う再実行安全な migration ファイルとして追加する
3. When 本スキーマ変更が `main` にマージされる, the `directus-schema-sync.yml` shall `aramakisai-infra` への自動 PR 作成フローに乗せる
4. The 開発者 shall staging 環境 (`stg-api.aramakisai.com`) での事前検証を、本番反映前に完了させる
