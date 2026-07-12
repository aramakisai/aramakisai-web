# Requirements Document

## Project Description (Input)
トップページ(page_home)のDirectusスキーマをユーザーフレンドリーに再設計する。現状は`blocks`フィールド1個のみ(型json, interface: input-code)で実行委員が生JSONを手打ちする必要があり不便。WordPressのブロックエディタのような自由なブロック編集は不要だが、以下の要件を満たすフォームベースの編集体験にしたい。

## 背景
- page_homeは現在frontend側で全く参照されておらず(page.tsxは静的な仮実装)、schemaのみ先行して存在する状態
- 既存のpage_access/page_contactは`content`(interface: input-rich-text-html)+個別URLフィールドという構成で、実行委員にとって分かりやすい前例になっている

## 要件
1. WYSIWYGリッチテキスト編集: `input-rich-text-html`(TinyMCE)を本文系フィールドに採用
2. 可変ブロック(お知らせ/トピックス等): `interface: list`(Repeater)を使い、行の追加・削除・並び替えができる構造化フォームにする。生JSON手打ちは廃止
3. iframe埋め込み対応(地図・SNS・フォーム等): WYSIWYG本文への生HTML iframe貼り付けは許可しない(XSS/レイアウト崩壊リスクのため)。代わりに既存の`map_embed_url`/`form_embed_url`と同様の専用URLフィールドを用意し、frontend側でサンドボックス化した`<iframe>`として描画する
4. 開催時期によって3つの表示モードを切り替える必要がある。単一のpage_home schemaに`phase`のようなselectフィールドを持たせ、frontend側で条件出し分けする方針(2種類のページ構造を別途用意するのではない):
   - 開催1ヶ月前〜直前: ヒーロー画像、お知らせ/トピックスの可変ブロック、アクセス案内、SNSアカウントリンクなど、比較的シンプルなCRUD
   - 直前〜当日: 全機能を解放したページ(既存の他collection: performance_slots/stages/student_exhibitions等と連携する動的な内容が中心になる見込み。詳細はrequirements策定時に詰める)
   - 開催後: 当日の内容を維持しつつ「ご来場ありがとうございました」的な閉会メッセージに差し替え。エディタから軽微な編集で対応できる程度

## 制約・注意点
- Directusスキーマ変更はCLAUDE.mdのadditive-onlyルール対象。既存`blocks`フィールドの削除は破壊的変更に当たるが、frontend側で未使用のため実害は無い見込み。ただしチーム周知とstaging事前検証は必須
- schema変更はgitopsリポジトリへの自動PR→ArgoCD経由でK8s Jobが本番適用する運用のため、mainマージ前にstagingで動作確認すること
- @cloudflare/next-on-pages制約上、Node.js専用APIは使用不可(Edge Runtime)

## Requirements

### Introduction
`page_home` collection は現状 `blocks` フィールド1つ(型 json, interface: `input-code`)のみを持ち、実行委員がDirectus管理画面で生JSONを手打ちする必要がある。本specは、既存の `page_access`/`page_contact` と同様のフォームベース編集体験(WYSIWYGリッチテキスト・Repeaterによる可変ブロック・埋め込み専用URLフィールド)に再設計する。あわせて、開催時期(開催前/直前〜当日/開催後)によるトップページのコンテンツ出し分けは、単一collection内のフェーズ条件分岐ではなく「開催前用」「直前〜当日・開催後兼用」の2 singleton collectionを用意し切替フラグで表示を切り替える構成とし、切替前にdevブランチ+CF Access保護のレビュー環境で事前検証できるようにすることを目的とする。

### Boundary Context
- **In scope**: `page_home` 系collectionのフィールド再設計(`blocks` 廃止含む、開催前用/直前〜当日・開催後兼用の2 singleton構成への変更)、対応するfrontend側のHome Page実装(初回)、2 singleton間の表示切り替え制御、埋め込みURLのサンドボックス化iframeレンダリング、切替検証用devブランチのCloudflare Workersデプロイ設定(aramakisai-web側wrangler)、**および** `dev.aramakisai.com` 用のCF Access Application/Policy・DNSレコードといった `aramakisai-infra` リポジトリ側のTerraform変更(クロスリポジトリでのタスク追跡の煩雑さを避けるため、本specのtasksとして一元管理する)。Tailwind CSSの導入と、デザインチームからのFigmaデザイン差し替えを見据えたpresentation層/data層の分離
- **Out of scope**: WordPress風の自由な複合ブロックエディタ(M2A構成)の実装、`page_access`/`page_contact`/`page_privacy`/`page_sponsor_guide` 等 他の固定ページのスキーマ変更、RBAC/権限定義の変更、SNS・地図等の外部サービスとの実際の連携仕様確定(本specでは埋め込みURLフィールドの用意まで)、最終的なビジュアルデザインの確定(Figmaデザインの作成自体はデザインチーム側の責務であり、本specは到着前のプレースホルダー実装までを担う)
- **Adjacent expectations**: 既存 `directus-schema` spec の design.md (`page_home / page_access` 節)がこのspec完了後に古い記述となるため、完了時に steering ([[product]]) および該当specとの整合を確認すること。`aramakisai-infra` 側の変更(`terraform/dns.tf`, `terraform/access.tf`)は本spec配下で行うが、適用(`terraform apply`)自体はaramakisai-infra側の既存運用フローに従う

### Requirement 1: Home Page用collectionのフォームベース再設計
**Objective:** As a 実行委員, I want Home Page用collectionの内容を個別入力フォームで編集できること, so that 生JSONを手打ちせずにトップページを更新できる

#### Acceptance Criteria
1. When 実行委員がDirectus管理画面でHome Page用collection(開催前用・直前〜当日/開催後兼用のいずれか)のレコードを開く, the Directus管理画面 shall 生JSON入力(interface: input-code)ではなく個別の入力フォーム項目を表示する
2. Home Page用の各collection shall 本文系コンテンツ用にWYSIWYGリッチテキスト入力(interface: input-rich-text-html)フィールドを1つ以上含む
3. The system shall お知らせ/トピックス等の可変コンテンツについて、実行委員がDirectus管理画面上で行の追加・削除・並び替えを行える手段を提供する(既存の`announcements`/`topics` collectionの活用を含む)
4. Home Page用の各collection shall ヒーロー画像用のフィールドを持つ
5. Where SNSアカウントへのリンクが必要な場合, the system shall SNSリンクを複数登録できるフィールド(Repeaterまたは同等の構造)を、Home Page用の各collectionまたは共通のメタ情報collectionのいずれかに持つ
6. The system shall 既存page_homeの `blocks` フィールド(型 json, interface: input-code)を廃止する

### Requirement 2: 埋め込みコンテンツの安全な取り扱い
**Objective:** As a 実行委員, I want 地図やSNS等の埋め込みを安全に設定できること, so that XSSやレイアウト崩壊のリスクなくトップページを運用できる

#### Acceptance Criteria
1. Home Page用の各collection shall 地図・SNS・フォーム等の外部埋め込み用に、既存の `map_embed_url`/`form_embed_url` と同様の命名規則に従った専用URL文字列フィールドを持つ
2. Home Page用の各collection shall WYSIWYG本文フィールドへの生HTML iframeタグの直接入力を許可しない構成とする
3. When Home Pageが埋め込み用URLフィールドの値を描画する, the Home Page shall サンドボックス化(sandbox属性付き)された`<iframe>`として描画する
4. If 埋め込み用URLフィールドの値が空である, then the Home Page shall 対応する埋め込みセクションを表示しない

### Requirement 3: 開催フェーズによる表示切り替え(2 singleton構成)
**Objective:** As a 実行委員/開発者, I want 開催前用と直前〜当日・開催後兼用の2つの完成された固定ページを用意し、切替日には単純なフラグ操作のみで表示を切り替えられること, so that 切替当日に複雑なフィールド編集作業をせず安全に運用でき、事前に十分な期間レビューできる

#### Acceptance Criteria
1. The system shall Home Page用に2つのDirectus singleton collectionを持つ: 開催前(開催1ヶ月前〜直前)用のcollectionと、直前〜当日・開催後を兼ねるcollection
2. 直前〜当日・開催後を兼ねるcollection shall 開催後に「ご来場ありがとうございました」的な閉会メッセージへ差し替える際、実行委員によるフィールド編集のみで対応できる構成とし、開催後専用の3つ目のcollectionを新設しない
3. The system shall 現在どちらのsingletonをHome Pageとして表示するかを切り替える単一のフラグ(select等)を、既存の`festival_meta` singleton collection(祭全体メタ情報)のフィールドとして持つ
4. When 実行委員がDirectus管理画面で当該切替フラグの値を変更する, the Home Page shall 追加のデプロイ作業なしに次回アクセス時から対応するsingletonの内容を表示する
5. Before 本番環境で実際の切替操作を行う, the 開発者 shall 新設するdevブランチ上のCloudflare Workersデプロイと、専用レビュー環境(CF Access保護の`dev.aramakisai.com`)を用いて、2つのsingletonと切替フラグの動作を事前に検証する
6. The dev review 環境 shall バックエンドとして本番Directus(`api.aramakisai.com`)を参照する構成とする(読み取り専用アクセスのみで本番データを変更する経路がなく、機密情報も含まないため、専用テスト環境を別途用意しない)
7. `festival_meta.home_active_variant`は本番Directus上の唯一のフラグであり、dev環境が本番Directusを参照する構成(AC6)である以上、dev環境からこのフラグを操作すると本番のHome Page表示も同時に切り替わってしまう。When 開発者がdev環境でpre_event/live双方の表示をレビューする, the system shall 本番の`festival_meta.home_active_variant`を書き換えることなく、dev環境(Cloudflare Workers `env.dev`)専用の環境変数によるフェーズ表示オーバーライドを提供し、設定時はfestival_metaの値より優先して適用する

### Requirement 6: devレビュー環境の構築(aramakisai-infra側変更を含む)
**Objective:** As a 開発者, I want devブランチ用のCF Access保護されたレビュー環境(`dev.aramakisai.com`)を、aramakisai-infra側の変更も含めて本specのタスクとして一元管理したい, so that クロスリポジトリでspecやタスクが分散して追跡しづらくなることを避けられる

#### Acceptance Criteria
1. The 開発者 shall aramakisai-web側で、devブランチのビルド成果物を`dev.aramakisai.com`宛にルーティングするCloudflare Workersのカスタムドメイン設定(`wrangler.toml`の該当設定)を追加する
2. The 開発者 shall aramakisai-infra側の`terraform/dns.tf`に、既存の`api_stg`等のレコード定義パターンに準拠した`dev.aramakisai.com`用のCNAMEレコードを追加する
3. The 開発者 shall aramakisai-infra側の`terraform/access.tf`に、既存の`aramakisai_web_workers_dev` Access Applicationと同様にAuthentik OIDCログインを要求する`dev.aramakisai.com`用のCloudflare Zero Trust Access Application/Policyを追加する
4. The dev review環境 shall Authentikで認証されていないユーザーからのアクセスをCF Accessによって拒否する
5. This spec の tasks.md shall aramakisai-web側の変更とaramakisai-infra側の変更(dns.tf/access.tf)の両方をタスクとして含み、aramakisai-infra側に独立した別specを起票しない
6. aramakisai-infra側のTerraform変更の実適用(`terraform apply`)は、aramakisai-infra既存の運用フロー(HCP Terraformワークスペース等)に従う

### Requirement 7: デザインチーム連携を見据えた拡張性
**Objective:** As a 開発者, I want presentation層をdata層から分離しTailwind CSSで実装したい, so that 後日デザインチームからFigmaデザインが届いた際に、HomePageServiceやDirectusスキーマに触れず見た目だけを差し替えられる

#### Acceptance Criteria
1. The system shall スタイリング基盤としてTailwind CSSを採用する
2. Home Page用の表示コンポーネント(ヒーロー・お知らせ一覧・トピックス一覧・SNSリンク等) shall HomePageServiceが返す型付きデータのみをpropsとして受け取り、Directus SDKやデータ取得処理に直接依存しない
3. Where デザインチームからのFigmaデザインが未提供である間, the 開発者 shall 情報設計・構造を満たす最小限のプレースホルダー実装でHome Pageを構築する
4. When デザインチームからFigmaデザインが提供された場合, the 開発者 shall presentation層コンポーネントの差し替えのみで対応し、HomePageService/Directusスキーマの変更を伴わない
5. The system shall Tailwind設定(`tailwind.config.ts`等)を、将来Figmaのデザイントークン(色・spacing・フォント等)を反映しやすい構成にする

### Requirement 4: 既存運用フロー・additive-onlyルールとの整合
**Objective:** As a 開発者, I want page_homeのスキーマ移行を安全に行いたい, so that additive-onlyルールとstaging事前検証フローを守りつつ本番影響を避けられる

#### Acceptance Criteria
1. The 開発者 shall page_homeのスキーマ変更を`directus schema snapshot`で書き出し、`directus/schema/snapshot.yaml`の変更としてコミットする
2. When page_homeの`blocks`フィールド削除を含むPRを作成する, the additive-schema-check workflow shall 破壊的変更として検出する
3. If additive-schema-checkが破壊的変更を検出した場合, then the 開発者 shall PRの説明にチーム周知内容を記載し、repo adminによるbranch protection overrideを経てマージする
4. Before mainへのマージ, the 開発者 shall staging環境のDirectus管理画面上でスキーマ適用後の編集操作(各フィールドへの入力・保存)を確認する
5. The frontend実装 shall page_home.blocksフィールドを参照するコードを含まない(移行時点で未使用であることの確認)
6. The system shall Directus Public(匿名)ポリシーに対し、`page_home`/`page_home_live`/`festival_meta`/`announcements`/`topics`の読み取り権限を付与する(現状これらのcollectionはPublicポリシーへの権限付与が一切無く、未認証の一般来場者がAPI経由で何も読み取れない状態のため)

### Requirement 5: 既存固定ページとの一貫性
**Objective:** As a 開発者, I want Home Page用collectionの設計を既存のpage_access/page_contactと一貫させたい, so that 実行委員が他ページの編集方法から類推でき、学習コストを抑えられる

#### Acceptance Criteria
1. Home Page用の各collection shall 既存のsingleton固定ページ(page_access, page_contact)で使われているフィールド命名規則(例: `*_embed_url`, `content`)を踏襲する
2. Home Page用の各collection shall 他のsingletonページと同様、`singleton: true`・`accountability: all`等の既存メタ設定パターンに従う
3. Where 複数ページで共通する構造(埋め込みURL、WYSIWYG本文)が存在する場合, Home Page用の各collection shall 同一のinterface選択(input, input-rich-text-html)を用いる
