# Requirements Document

## Project Description (Input)
CMS管理画面の整理: 祭基本情報とトップページのグローバル統合・サイト設定への改名・不要カラム削除・コレクション分類、ブース番号の文字列化、サイネージテロップのグループ所属

### 現状
- 祭全体の設定が、グローバル「祭基本情報」(`festival_meta`)と「トップページ」(`page_home`: トップメッセージ、ヒーロー画像複数)に分かれている。祭基本情報の項目の並びは意味のまとまりに沿っていない。
- 両グローバルには、本番で値が入っていないかフロントエンドで描画されていない項目(駐車場マップ画像`parking_map`、ヒーロー画像`hero_image`、テーマのメインビジュアル`theme_image`、サイトタイトル`site_title`、サイト説明文`meta_description`、トップメッセージ`hero_message`)と、年度をまたいで変わらない会場の固定情報(会場名`venue_name`、会場住所`venue_address`、Google Maps埋め込みURL`campus_map_url`、アクセス文言`access_summary`)がある。
- 管理画面のサイドバーでは、全コレクション・グローバルが分類なしで並ぶ。
- 学生企画(`student_exhibitions`)と協賛・出店(`sponsors`)のブース番号は数値で、`GB155`のような教室番号を入力できない。
- よくある質問・マップエリア・固定ページ・駐車場・協賛・出店・ステージ・トピックは、表示順を数値の「表示順」(`sort`)で持ち、管理画面で番号を手入力して並べ替える。サイネージのスライドとテロップはドラッグで並べ替えられる。
- 学生企画の模擬店メニュー(`vendor.menu`)の価格(`price`)は文字列で、「円」の有無などの表記が入力者に委ねられている。
- 学生団体(`student_exhibitor`)は1ユーザーにつき1件の学生企画を所有する。ログイン後は管理画面のダッシュボードが開き、自団体の企画は学生企画の一覧から開く。
- サイネージのスライドはグループに所属し、「すべて」が表示中なら全スライド、そうでなければ表示中のグループに所属するスライドだけが表示される。テロップはグループを持たず、有効か否かだけで表示される。

## Introduction
実行委員がCMS管理画面で目的の設定やコレクションを迷わず見つけられるよう、祭全体の設定を1つのグローバル「サイト設定」に統合し、項目をタブで分類し、使われていない項目と固定情報を取り除く。あわせて、コレクションをサイドバー上で用途別に分類し、ブース番号に教室番号を入力できるようにし、サイネージのテロップをスライドと同じグループ単位で表示・非表示を切り替えられるようにし、表示順を持つコレクションをドラッグで並べ替えられるようにする。既存データは失わない。

## Boundary Context
- **In scope**: グローバルの統合と改名、項目のタブ分類、項目の削除とフロントエンドへの固定情報の移設、コレクション・グローバルのサイドバー分類、ブース番号の型変更、テロップのグループ所属と表示判定、表示順を持つコレクションのドラッグ並べ替え、これらに伴うフロントエンドの追随と既存データの移行
- **Out of scope**: 既存コレクションの表示名の変更、サイネージ設定(`signage_settings`)の項目変更、テロップの固定表示、ブース番号のフロントエンドでの表示
- **Adjacent expectations**: 破壊的なスキーマ変更は`cms-schema-check.yml`の検出対象となり、対応するフロントエンドがデプロイ・安定稼働済みであることを確認した上で`breaking-change-acknowledged`ラベルを付けてマージする

## Requirements

### Requirement 1: サイト設定グローバルへの統合
**Objective:** As a 実行委員, I want 祭全体の設定を1か所で編集したい, so that 祭基本情報とトップページのどちらにあるかを探さずに済む

#### Acceptance Criteria
1. The CMS shall 祭基本情報とトップページの項目(削除対象を除く)を、1つのグローバル「サイト設定」(slug`site_settings`)として提供する
2. When 統合のマイグレーションが適用される, the CMS shall 祭基本情報とトップページに保存されていた値(リッチテキストとそのHTML、画像の参照、開催日程、SNSリンクを含む)をサイト設定へ移し、移行前と同じ値を返す
3. When 統合のマイグレーションが適用された後, the CMS shall 管理画面とAPIに祭基本情報(`festival_meta`)とトップページ(`page_home`)を表示・提供しない
4. When 実行委員がサイト設定を保存する, the CMS shall 祭基本情報の保存時と同様にサイネージへ更新を通知する

### Requirement 2: サイト設定の項目のタブ分類
**Objective:** As a 実行委員, I want サイト設定の項目が用途別のタブにまとまっていてほしい, so that 長い一覧から目的の項目を探さずに済む

#### Acceptance Criteria
1. The CMS shall サイト設定の編集画面で、項目を「基本」「トップページ」「About」「連絡先」「SEO」のタブに分けて表示する
2. The CMS shall 「基本」タブに祭名、開催日程、テーマ、テーマの説明文をこの順で表示する
3. The CMS shall 「トップページ」タブにヒーロー画像(複数)を表示する
4. The CMS shall 「About」タブに祭概要を表示する
5. The CMS shall 「連絡先」タブにお問い合わせフォームURL、学生団体向け問い合わせ先URL、SNSリンクをこの順で表示する
6. The CMS shall 「SEO」タブに既定OG画像を表示する
7. The CMS shall タブ分けによってAPIが返す項目の名前と階層を変えない(タブは名前を持たない)

### Requirement 3: 未使用項目と固定情報の削除
**Objective:** As a 実行委員, I want 使われない項目や毎年変わらない項目が編集画面に出ないでほしい, so that 入力しても反映されない項目に迷わない

#### Acceptance Criteria
1. The CMS shall フロントエンドで参照されていない駐車場マップ画像(`parking_map`)をサイト設定に持たない
2. The CMS shall 本番で未入力かつフロントエンドで描画されていないヒーロー画像(`hero_image`)、テーマのメインビジュアル(`theme_image`)、トップメッセージ(`hero_message`とそのHTML`hero_message_html`)をサイト設定に持たない
3. The CMS shall 本番で未入力のサイトタイトル(`site_title`)とサイト説明文(`meta_description`)をサイト設定に持たない(各コレクションの`meta_description`は残す)
4. The Frontend shall サイトの説明文(meta description)を、祭概要からの自動生成だけで出力する
5. The CMS shall 会場名(`venue_name`)、会場住所(`venue_address`)、Google Maps埋め込みURL(`campus_map_url`)、アクセス文言(`access_summary`)をサイト設定に持たない
6. The Frontend shall 会場名として「群馬大学 荒牧キャンパス」を、会場住所として「371-8510 群馬県前橋市荒牧町4-2」を、CMSを参照せずに表示・構造化データへ出力する
7. The Frontend shall Google Maps埋め込みURLとして、移行時点の本番の`campus_map_url`の値をCMSを参照せずに使う
8. The Frontend shall アクセス文言として「JR前橋駅北口2番乗り場から関越交通バスで約28分、「群馬大学荒牧」下車。お車の場合は開催中の臨時駐車場をご利用いただけますが、混雑状況によってはご用意できない場合があります。できる限り公共交通機関をご利用ください。」をCMSを参照せずに表示する
9. When 項目の削除がCMSへ反映される, the Frontend shall 削除される項目を参照しない状態で既にデプロイされている

### Requirement 4: フロントエンドの追随
**Objective:** As a 来場者, I want 設定の統合後もサイトの表示が変わらないでほしい, so that 管理側の整理に関係なく同じ情報を見られる

#### Acceptance Criteria
1. The Frontend shall 祭基本情報・トップページから取得していた値を、サイト設定から取得する
2. When サイト設定への統合が本番に反映された後, the Frontend shall トップページ、About、アクセス、タイムテーブル、駐車場、サイネージ、サイトマップ、メタデータ(`<title>`・OG・構造化データ)で、統合前と同じ内容を表示・出力する
3. If サイト設定の取得に失敗する, the Frontend shall 統合前の祭基本情報・トップページの取得失敗時と同じ扱いで表示する

### Requirement 5: サイトタイトルの扱い
**Objective:** As a 実行委員, I want サイトのタイトルが祭名から決まってほしい, so that 祭名を1か所で直せば`<title>`やSNS共有時のサイト名にも反映される

#### Acceptance Criteria
1. The Frontend shall `<title>`のテンプレートとOGのサイト名に、サイト設定の祭名(`name`)を使う
2. When 実行委員が祭名を変更して保存する, the Frontend shall 変更後の祭名を`<title>`とOGのサイト名に反映する

### Requirement 6: コレクションのサイドバー分類
**Objective:** As a 実行委員, I want 管理画面のサイドバーでコレクションが用途別にまとまっていてほしい, so that 目的のコレクションをすぐに見つけられる

#### Acceptance Criteria
1. The CMS shall サイドバーの「サイト掲載」にお知らせ、トピック、固定ページ、よくある質問、協賛・出店を表示する
2. The CMS shall サイドバーの「企画・ステージ」に学生企画、ステージ、ステージ出演枠を表示する
3. The CMS shall サイドバーの「会場・マップ」にマップエリア、マップ地点、駐車場を表示する
4. The CMS shall サイドバーの「当日運営」に駐車場の空き状況(`parking_statuses`)、落とし物を表示する
5. The CMS shall サイドバーの「サイネージ」にスライド、グループ、テロップを表示し、サイネージ設定(`signage_settings`)は現行どおり非表示のままとする
6. The CMS shall サイドバーの「管理」にサイト設定、ユーザー、メディアを表示する
7. The CMS shall 分類によって既存コレクション・グローバルの表示名を変えない

### Requirement 7: ブース番号の文字列化
**Objective:** As a 実行委員, I want ブース番号に教室番号のような英字を含む値を入力したい, so that 屋内の教室で出店する企画にも実際の場所を割り当てられる

#### Acceptance Criteria
1. The CMS shall 学生企画と協賛・出店のブース番号に、英数字を含む最大20文字の文字列(例:`GB155`)を受け付ける
2. If 20文字を超えるブース番号が保存される, the CMS shall 保存を拒否し、入力エラーを表示する
3. When ブース番号の型変更のマイグレーションが適用される, the CMS shall 既存のブース番号を同じ数字の文字列として保持する(未設定は未設定のまま)
4. If 同じマップエリア内で既に使われているブース番号が保存される, the CMS shall 型変更前と同様に保存を拒否する
5. The CMS shall 同一エリア内の重複を、ブース番号の文字列が完全に一致する場合に判定する

### Requirement 8: テロップのグループ所属
**Objective:** As a 実行委員, I want テロップもスライドと同じグループ単位で出し分けたい, so that 閉祭後や緊急時にグループの表示を切り替えるだけでテロップも切り替わる

#### Acceptance Criteria
1. The CMS shall サイネージのグループに、スライドと同様に所属テロップを持たせる
2. The CMS shall テロップの所属を、グループの編集画面で、スライドの所属と同じ操作で編集できるようにする
3. While 「すべて」グループが表示中である, the Signage Page shall 有効なテロップをすべて表示する
4. While 「すべて」グループが非表示である, the Signage Page shall 有効なテロップのうち、表示中のグループに所属するものだけを表示する
5. If 有効なテロップがどの表示中のグループにも所属しない, the Signage Page shall そのテロップを表示しない(「すべて」が表示中の場合を除く)
6. When テロップの所属またはグループの表示を変更して保存する, the Signage Page shall スライドのグループ切替と同じ時間内に、テロップの表示を切り替える
7. The CMS shall 未認証の読み取りに対し、表示対象(有効かつ上記の判定で表示されるもの)のテロップだけを返す
8. When テロップのグループ所属のマイグレーションが適用される, the CMS shall 既存のテロップをすべての通常のグループに所属させる
9. The CMS shall テロップの並び順を、グループ所属の導入前と同じ規則で保つ

### Requirement 9: 表示順のドラッグ並べ替え
**Objective:** As a 実行委員, I want 表示順を持つコレクションをドラッグで並べ替えたい, so that 番号を振り直さずに並びを変えられる

#### Acceptance Criteria
1. The CMS shall よくある質問、マップエリア、駐車場、協賛・出店、ステージの一覧画面で、サイネージのスライド・テロップと同じくドラッグで並べ替えられるようにする
2. The CMS shall 上記のコレクションと、固定ページ・トピックから数値の「表示順」(`sort`)を取り除く(固定ページ・トピックはドラッグ並べ替えの対象にせず、トピックは公開日時の新しい順の表示を保つ)
3. When 並べ替えのマイグレーションが適用される, the CMS shall 各コレクションの並びを、移行前の表示順の値による並びと同じにする
4. The Frontend shall 上記のコレクションを、管理画面でドラッグした並びのとおりに表示する

### Requirement 10: 模擬店メニューの価格の数値化
**Objective:** As a 実行委員, I want 模擬店メニューの価格を数値で入力させたい, so that サイト上の価格表記がそろう

#### Acceptance Criteria
1. The CMS shall 学生企画の模擬店メニューの価格(`price`)を0以上の整数で受け付ける
2. The Frontend shall 価格を「円」を付けて表示する
3. When 価格の型変更のマイグレーションが適用される, the CMS shall 既存の価格から数値を取り出して保持する
4. The CMS shall 価格が空の行をサイトに表示しない現行の扱いを保つ

### Requirement 11: 学生団体のログイン後の遷移
**Objective:** As a 学生団体, I want ログインしたらすぐ自団体の企画を編集したい, so that ダッシュボードや一覧から企画を探さずに済む

#### Acceptance Criteria
1. When 学生団体がログインする、またはダッシュボードを開く, the CMS shall 自団体が所有する学生企画の編集画面を開く
2. If ログインした学生団体が所有する学生企画が無い, the CMS shall 現行どおりダッシュボードを開く
3. The CMS shall 実行委員のログイン後の遷移を変えない
