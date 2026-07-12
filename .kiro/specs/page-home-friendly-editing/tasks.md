# Implementation Plan

- [x] 1. 基盤: Directusスキーマの追加的変更(page_home / page_home_live / festival_meta)
- [x] 1.1 page_homeにヒーロー画像・WYSIWYG本文・埋め込みURLの各フィールドを追加する(既存の`blocks`フィールドはこの時点では維持する)
  - ヒーロー画像用のファイル参照フィールド、WYSIWYGリッチテキスト用フィールド、埋め込みURL用の文字列フィールドを`page_home`に追加する
  - Directus管理画面上で各フィールドが個別の入力フォームとして表示され、生JSON入力ではなくなっていることを確認する
  - 既存の`page_access`/`page_contact`と同じフィールド命名規則・interface選択に揃える
  - `directus schema snapshot`で書き出し、`directus/schema/snapshot.yaml`の差分としてコミットする
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 4.1, 5.1, 5.3_

- [x] 1.2 直前〜当日・開催後を兼ねる新規singleton collection(`page_home_live`)を作成し、ヒーロー画像・WYSIWYG本文・埋め込みURLの各フィールドを定義する
  - `page_home`と同様のフィールド構成(ヒーロー画像・WYSIWYG本文・埋め込みURL)を持つ新規singleton collectionが作成され、Directus管理画面上でレコードが1件だけ編集可能になっている
  - `singleton: true`・`accountability: all`等、既存の固定ページcollectionと同じmeta設定パターンに揃える
  - `directus schema snapshot`で書き出し、`directus/schema/snapshot.yaml`の差分としてコミットする
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3_

- [x] 1.3 festival_metaに開催フェーズ切替フラグとSNSリンクの各フィールドを追加する
  - `pre_event`/`live`の選択肢を持つ切替用フィールドと、複数のSNSアカウント(プラットフォーム名+URL)を追加・削除・並び替えできる構造化フィールドを`festival_meta`に追加する
  - Directus管理画面上でどちらのフィールドも個別の入力フォームとして編集できることを確認する
  - `directus schema snapshot`で書き出し、`directus/schema/snapshot.yaml`の差分としてコミットする
  - _Requirements: 1.5, 3.3, 4.1_

- [x] 2. 基盤: RBAC migration(page_home_liveの権限付与とPublic読み取り権限)
- [x] 2.1 新規collection `page_home_live` に対し、executiveロールのCRUD権限とstudent_exhibitorロールの読み取り権限を付与する新規migrationファイルを作成する
  - 新規migrationを適用した環境で、executiveロールが`page_home_live`の作成・参照・更新・削除を行えることを確認する
  - 既存の固定UUID定数(executive/student_exhibitorのポリシーID)を再定義せず参照する
  - _Requirements: 3.1_
  - _Depends: 1.2_

- [x] 2.2 Directus Public(匿名)ポリシーに対し、`page_home`/`page_home_live`/`festival_meta`/`announcements`/`topics`の読み取り権限を付与する
  - 未認証(トークン無し)のAPIリクエストで上記5 collectionそれぞれからレコードが取得できることを確認する
  - `announcements`のみ公開日時が現在時刻以前かつ設定済みのレコードに限定するフィルタを適用する
  - Directus core標準の固定Public policy UUIDを新規に作成せず参照する
  - _Requirements: 4.6_
  - _Depends: 1.1, 1.2, 1.3_

- [x] 3. 基盤: frontend側のDirectusスキーマ型・共有型契約・スタイリング基盤
- [x] 3.1 DirectusクライアントのSchema型定義に`page_home`/`page_home_live`/`festival_meta`/`announcements`/`topics`を追加する
  - Directusクライアント経由でこれら5 collectionのフィールドに型安全にアクセスでき、存在しないフィールド名を指定した場合に型エラーになることを確認する
  - _Requirements: 1.1, 1.2_
  - _Depends: 1.1, 1.2, 1.3_

- [x] 3.2 Home Page表示用データの共有型契約(開催フェーズ種別、SNSリンク、お知らせ要約、トピックス要約、Home Page表示用コンテンツ)を定義する
  - 開催前(お知らせ/トピックス付き)と直前〜当日/開催後(お知らせ/トピックス無し)を区別できる型が定義され、後続のデータ取得層・表示コンポーネント双方から参照可能になっている
  - _Requirements: 7.2_
  - _Depends: 3.1_

- [x] 3.3 Tailwind CSSをfrontendにセットアップする
  - Tailwindの設定ファイル・PostCSS設定・グローバルCSSエントリポイントを追加し、Tailwindユーティリティクラスを使ったコンポーネントがビルド・ローカル起動の両方で正しくスタイル適用されることを確認する
  - 将来のFigmaデザイントークン(色・spacing・フォント)をtheme拡張として追加しやすい構成にする
  - _Requirements: 7.1, 7.5_

- [x] 4. 基盤: devブランチ用Cloudflare Workers環境の下準備
  - wrangler設定に、本番用とは別の専用worker名を持つdev環境向けの名前付き環境ブロックを追加し、当該環境向けのビルド・デプロイコマンドが本番用の設定と衝突せず実行できることを確認する
  - _Requirements: 6.1_

- [x] 5. コア機能: HomePageServiceの実装
- [x] 5.1 (P) festival_meta.home_active_variantを判定し、開催前/直前〜当日のいずれかを返す処理を実装する。値が未設定または不正な場合は開催前として扱うフェイルセーフを組み込む
  - 正常値(`pre_event`/`live`)・未設定・不正な文字列のそれぞれを入力した場合に、期待通りの判定結果(不正/未設定時は開催前)が得られる
  - _Requirements: 3.3, 3.4_
  - _Boundary: HomePageService_
  - _Depends: 3.2_

- [x] 5.2 開催前向けのコンテンツ集約処理を実装する(page_homeのヒーロー系フィールド取得に加え、announcementsの公開済み最新N件とtopicsの表示順一覧を取得する)
  - 開催前判定時に、ヒーロー情報とあわせて公開済みのお知らせ・表示順に並んだトピックスが取得できることを確認する
  - _Requirements: 1.3_
  - _Boundary: HomePageService_

- [x] 5.3 直前〜当日・開催後向けのコンテンツ集約処理を実装する(page_home_liveのヒーロー系フィールド取得)
  - 直前〜当日判定時に、page_home_live由来のヒーロー情報のみが取得され、お知らせ・トピックスは含まれないことを確認する
  - _Requirements: 3.2_
  - _Boundary: HomePageService_
  - _Depends: 1.2_

- [x] 6. コア機能: 共通presentationプリミティブの実装
- [x] 6.1 (P) サニタイズ済みのWYSIWYG本文を描画するRichTextコンポーネントを実装し、想定するCloudflare Workers実行環境でサニタイズ処理が動作することを検証する
  - 許可されないタグ(iframeやscript等)を含むHTML文字列を渡した場合に、それらが除去された状態で描画されることを確認する
  - 選定したサニタイズ手段が動作しない場合の代替手段への切り替えを検討し記録する
  - _Requirements: 2.2_
  - _Boundary: RichText_

- [x] 6.2 (P) 埋め込みURLをサンドボックス化した`<iframe>`として描画するSandboxedEmbedコンポーネントを実装する
  - URLが空/未設定の場合は何も描画されず、値がある場合はsandbox属性が付与された`<iframe>`として描画されることを確認する
  - _Requirements: 2.3, 2.4_
  - _Boundary: SandboxedEmbed_

- [x] 7. コア機能: セクション表示コンポーネントの実装(Figma到着前のプレースホルダー)
- [x] 7.1 (P) ヒーロー画像・RichTextによる本文・SandboxedEmbedによる埋め込みを表示するHeroSectionコンポーネントを、Tailwindによる最小限のスタイルで実装する
  - HomePageServiceが返す型付きデータのみをpropsとして受け取り、Directus SDKやデータ取得処理を一切呼び出さずにヒーローセクションが描画されることを確認する
  - _Requirements: 1.4, 7.2, 7.3_
  - _Boundary: HeroSection_
  - _Depends: 6.1, 6.2, 3.2_

- [x] 7.2 announcements由来のお知らせ一覧を表示するNoticesListコンポーネントを実装する
  - お知らせの配列をpropsとして渡すと、各項目の本文がRichText経由でサニタイズ済みの状態で一覧表示されることを確認する
  - _Requirements: 1.3, 7.2, 7.3_
  - _Boundary: NoticesList_
  - _Depends: 6.1_

- [x] 7.3 topics由来のトピックス一覧を表示するTopicsListコンポーネントを実装する
  - トピックスの配列をpropsとして渡すと、画像・本文・リンクを含む一覧が表示されることを確認する
  - _Requirements: 1.3, 7.2, 7.3_
  - _Boundary: TopicsList_

- [x] 7.4 festival_meta.sns_links由来のSNSリンク一覧を表示するSnsLinksコンポーネントを実装する
  - SNSリンクの配列をpropsとして渡すと、各プラットフォームへのリンクが一覧表示されることを確認する
  - _Requirements: 1.5, 7.2, 7.3_
  - _Boundary: SnsLinks_

- [x] 8. コア機能: devブランチ向けCI/CDとaramakisai-infra側の整備
- [x] 8.1 (P) devブランチへのpushで起動するデプロイジョブをCIワークフローに追加し、ビルド時の公開Directus URLに本番のURLを明示的に指定する
  - devブランチへのpushをトリガーに、既存の検証ジョブ通過後にdev環境向けのデプロイが実行される設定になっている
  - 公開Directus URLの値が本番のものになっており、Cloudflareデプロイ資格情報は既存のプレビュー用デプロイと同じ権限範囲のまま追加の資格情報を必要としない
  - _Requirements: 3.5, 3.6, 6.1, 6.5_
  - _Depends: 4_

- [x] 8.2 (P) aramakisai-infra側に、devレビュー環境をAuthentik OIDCログインで保護するCloudflare Access設定を追加する
  - dev.aramakisai.com宛のAccess Applicationが定義され、既存のAuthentikログインポリシーが自動的に適用される設定になっている(未認証アクセスはログイン画面にリダイレクトされる想定)
  - _Requirements: 3.5, 6.3, 6.4, 6.5, 6.6_

- [x] 8.3 aramakisai-infra側に、dev.aramakisai.com をCloudflare Workersのdev環境向けサービスへ接続するために必要なリソースを追加する
  - dev.aramakisai.com へのアクセスがCloudflare Workersのdev環境向けサービスへルーティングされる設定(カスタムドメイン接続・必要なDNSレコード)が定義されている
  - Workers Assets構成との相性を確認し、問題が生じた場合の代替手順を記録する
  - _Requirements: 3.5, 6.2, 6.5, 6.6_

- [x] 9. 統合: Home Pageの結線
- [x] 9.1 HomePageServiceの出力を用いて開催前/直前〜当日それぞれのレイアウトを組み立てるHome Pageを実装する
  - 開催前判定時はヒーロー・お知らせ一覧・トピックス一覧・SNSリンクが、直前〜当日判定時はヒーロー・SNSリンクのみが表示され、festival_metaの切替フラグを変更するだけで表示内容が切り替わることを確認する
  - _Requirements: 1.3, 1.4, 1.5, 3.3, 3.4, 7.4_
  - _Depends: 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4_

- [x] 9.2 Directusへのデータ取得に失敗した場合の最小限のフォールバック表示を実装する
  - Directusからの応答が得られない状況を再現した場合に、ページ全体がクラッシュせず最小限の表示に留まることを確認する
  - _Requirements: 3.4_
  - _Depends: 9.1_

- [x] 10. page_home.blocksフィールドの削除(破壊的変更)
  - frontend実装がpage_home.blocksを一切参照していないことを確認したうえで、`blocks`フィールドをsnapshot.yamlから削除し、additive-schema-checkが破壊的変更として検出することを確認する
  - PR本文にチーム周知内容を記載し、admin overrideを経てマージする運用に従う
  - _Requirements: 1.6, 4.2, 4.3, 4.5_
  - _Depends: 9.1_

- [x] 11. 検証: ユニット・統合テスト
- [x] 11.1 HomePageServiceのユニットテストを作成する
  - 開催前/直前〜当日/不正値それぞれのフェーズ判定と、開催前向けのannouncements/topics取得条件(公開済みのみ、表示順)を検証するテストスイートが通る
  - _Requirements: 1.3, 3.3, 3.4_
  - _Depends: 5.1, 5.2, 5.3_

- [x] 11.2 RichText/SandboxedEmbedのユニットテストを作成する
  - 許可されないタグの除去、空URL時の非表示、sandbox属性の付与をそれぞれ検証するテストスイートが通る
  - _Requirements: 2.2, 2.3, 2.4_
  - _Depends: 6.1, 6.2_

- [x] 11.3 Home Pageの統合テストを作成する
  - Directus SDKをモックした状態で、開催前/直前〜当日それぞれのレンダリング結果が期待通りの要素を含むことを検証するテストスイートが通る
  - _Requirements: 3.1, 3.3_
  - _Depends: 9.1_

- [x] 11.4 devブランチ向けデプロイジョブの構造を検証するワークフローテストを作成する
  - トリガー条件・依存ジョブ・デプロイ先設定を検証するテストスイートが通る
  - _Requirements: 3.5, 6.1_
  - _Depends: 8.1_

- [x] 12. 検証: staging/dev環境での動作確認
- [x] 12.1 staging環境にスキーマ適用後、Directus管理画面上で各フィールドの入力・保存とpage_home_liveへのアクセス可否を確認する
  - executiveロールでログインし、page_home/page_home_live双方の全フィールドを編集・保存できることを確認する
  - _Requirements: 4.4, 5.1, 5.2, 5.3_
  - _Depends: 1.1, 1.2, 1.3, 2.1, 2.2_
  - 2026-07-12: 本番でRBAC migration未反映(page_home_live等403)が発生していたが根本原因3層を特定し解決。`curl https://api.aramakisai.com/items/page_home_live` が200を返すことを確認済み

- [x] 12.2 dev.aramakisai.com上での動作確認を行う
  - 未認証アクセスがCF Accessによりブロックされ、Authentik認証後は本番Directusのデータを用いて開催前/直前〜当日双方の表示がfestival_metaの切替フラグに応じて正しく切り替わることを確認する
  - _Requirements: 3.5, 3.6, 6.4, 6.6_
  - _Depends: 8.1, 8.2, 8.3, 9.1, 10, 2.2_
  - 2026-07-12: RBAC権限反映を確認。CF Access/Authentik認証フローそのものの手動確認は別途実施
