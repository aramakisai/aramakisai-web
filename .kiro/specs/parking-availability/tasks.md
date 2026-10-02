# Implementation Plan

- [x] 1. CMSの駐車場データと公開切替
- [x] 1.1 駐車場コレクションを定義して登録する
  - `parking_lots`コレクションに名称(必須、最大255)・空き状況・表示順を持たせる。台数のフィールドは持たない
  - 空き状況は「空き/混雑/満車」(`available`/`crowded`/`full`)の必須の選択式とし、既定値を持たせない
  - 最終更新時刻は標準の`updatedAt`を使い、専用フィールドは作らない
  - 管理画面は名称をタイトルに、一覧列を名称・空き状況・更新時刻、既定の並びを表示順にする
  - accessは既存の一括結線の既定に任せ、個別に書かない。ロール定義は変更しない
  - コレクション登録口に追加し、定義の単体テスト(必須・選択肢・既定値なし)が通る。テストは既存の`cms/src/collections/*.test.ts`の流儀で書く
  - _Requirements: 2.1, 2.2, 2.4, 2.6_

- [x] 1.2 (P) 駐車場空き情報の公開切替を追加する
  - `festival_meta`に`parking_enabled`(チェックボックス、ラベル「駐車場空き情報を公開する」、既定false)を追加する
  - 管理画面の`festival_meta`で切替が表示され、未設定時は非公開として扱われる。単体テストは既存の`cms/src/globals/festival-meta.test.ts`の流儀で書く
  - _Requirements: 6.1_
  - _Boundary: festival_meta (CMS)_

- [x] 1.3 マイグレーションを生成し型を再生成する
  - `cms/`で`pnpm migrate:create parking_lots`を実行し、マイグレーションの登録口に追加されたことを確認する
  - 生成内容が`parking_lots`テーブルと enum、`payload_locked_documents_rels`への`parking_lots_id`列・FK・index、`festival_meta`への列追加に限られ、`media.prefix`等のDROPが混入していないことを確認する
  - `pnpm generate:types`でfrontend側の型も更新する
  - ローカルDBに`pnpm migrate`が成功し、frontendの型に`parking_lots`と`parking_enabled`が現れ、`cms/`の`pnpm type-check`が通る
  - 注記: ローカルDBは共有CMS(3100)と同じPostgresなので、ブランチを破棄する場合は追加テーブルとマイグレーション記録の後片付けが要る
  - _Requirements: 5.1_

- [x] 1.4 駐車場の権限をテストで検証する
  - `cms/src/access/policy.test.ts`の`isHiddenInAdmin`のブロックに、駐車場がstudent_exhibitorでは非表示(true)、executiveでは表示(false)になるケースを足す
  - `cms/src/access/access.int.test.ts`に新しいdescribeを立て、未認証での読み取り許可と、作成・更新・削除の拒否を検証する。userを渡さず`overrideAccess:false`にし、対象レコードは`overrideAccess:true`で作ってafterAllで削除する
  - 学生団体ロールは、更新に加えて作成・削除の拒否も検証する
  - `DATABASE_URL`と`PAYLOAD_SECRET`を設定した状態で`cms/`の`pnpm test`を実行し、追加ケースがskippedではなくpassedになる(未設定だとdescribe.skipIfで黙ってスキップされる)
  - _Requirements: 2.3, 2.4, 2.5, 5.4_

- [x] 2. frontendの取得層
- [x] 2.1 (P) CMS取得のキャッシュ有効期間を呼び出し側から指定できるようにする
  - 一覧取得にエッジキャッシュのTTLを渡すオプションを追加する。省略時は従来の60秒のまま
  - 駐車場に固有の値を持ち込まず、機能に依存しない設定値として扱う
  - キャッシュキーはURLだけなので、同じクエリを別のTTLで共有しない
  - 単体テストで、指定時はそのTTLで保持され、省略時は60秒が変わらないことを確認する。既存の`cms.test.ts`の流儀(cachesをstubし、putに渡ったヘッダを検証)で書く
  - _Requirements: 3.7, 4.2_
  - _Boundary: cms.ts_

- [x] 2.2 (P) 駐車場の型と純粋関数を用意する
  - 生成された型から駐車場・空き状況・取得結果(駐車場一覧と取得時刻)と、`ParkingResponse`(enabledの判別共用体)の型を導出する
  - 最終更新から30分を超えたかを判定する関数を用意する。時刻の`HH:mm`整形は新規に作らず、既存の`formatEventDayTime`を使う
  - CMS取得や環境変数を参照せず、クライアントからimportできる状態にする
  - 単体テストで、30:00は古くない・30:01は古いという境界値が通る
  - _Requirements: 1.2, 3.6_
  - _Boundary: parking.ts_
  - _Depends: 1.3_

- [x] 2.3 (P) 公開切替の値を読む取得関数を追加する
  - 既存の`festival_meta`取得(TTL60秒)から`parking_enabled`を読む関数を追加する。戻り値は`CmsResult<boolean>`で、取得失敗は非公開と区別して失敗として返す
  - 管理画面での切替が再デプロイなしで次回取得に反映される
  - 単体テストで、true/false/未設定(nullを含む)と取得失敗の4通りが通る
  - _Requirements: 6.6_
  - _Boundary: festival-meta.ts (frontend)_
  - _Depends: 1.3_

- [x] 2.4 駐車場の取得結果を組み立てるサーバー側の取得関数を実装する
  - 取得関数はサーバー側専用のモジュールに置き、純粋関数のモジュールとは分ける
  - 公開判定は`DEV_OVERRIDE_ENABLED`が真なら常に公開、それ以外は`parking_enabled`に従う。`festival_meta`の取得失敗も失敗として返す
  - 非公開なら駐車場一覧を取得せず非公開の結果だけを返す
  - 公開時は表示順の昇順・上限100件で、TTL20秒を指定して取得し、取得時刻を添える
  - 単体テストで、`parking_enabled`と`DEV_OVERRIDE_ENABLED`の4通りの組み合わせの公開判定、非公開時に駐車場一覧を取得しないこと、駐車場一覧とfestival_metaのどちらのCMS失敗も失敗として返ることが通る。`DEV_OVERRIDE_ENABLED`の切替は、`phase.test.ts`と同じ`vi.resetModules`+`vi.stubEnv`+動的import、または`vi.doMock('@/lib/phase')`で書く
  - _Requirements: 1.1, 3.7, 6.3, 6.5, 6.6_
  - _Depends: 2.1, 2.2, 2.3_

- [x] 3. ポーリングと配信ルート
- [x] 3.1 (P) 機能に依存しないポーリングフックを実装する
  - 取得関数・間隔・初期値(サーバー取得失敗時はnull)・継続判定を受け取り、最新データと失敗フラグを返す
  - 指定間隔で再取得し、タブ非表示中は止め、表示に戻ったら直ちに1回再取得する
  - 失敗時は直前のデータを保持して失敗フラグだけを立て、次の間隔で再試行する。初期値nullのまま失敗してもnullを保つ
  - 継続判定が偽を返した取得結果で以降の再取得を止める。既定は常に継続
  - 無操作による停止は持たない
  - fetcher・shouldContinueは最新値をref(またはReact 19の`useEffectEvent`)で参照し、描画ごとにタイマーを張り直さない
  - 応答を待ってから次を予約するsetTimeoutの連鎖で、取得の重なりを防ぐ
  - 世代番号で古い応答を捨てる
  - アンマウント時にタイマーとlistenerを解除する
  - shouldContinueで停止した後は、表示復帰でも再開しない
  - fake timersのフックテストで、非表示停止・復帰時再取得・失敗時保持・nullからの回復・継続判定による停止が通る。テストは`await act(async () => vi.advanceTimersByTimeAsync(...))`で書き、visibilityStateは`Object.defineProperty(document,'visibilityState',{configurable:true,...})`と`dispatchEvent(new Event('visibilitychange'))`で切り替える
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 6.4_
  - _Boundary: usePolling_

- [x] 3.2 (P) 駐車場のJSONを返すAPIルートを実装する
  - `/api/parking`のGETで取得関数の結果を返し、ブラウザの再取得をCMSへ直接向けずこのルートに集める
  - `dynamic = 'force-dynamic'`を宣言し、応答に`Cache-Control: no-store`を付ける
  - 非公開時も200で`{ enabled: false }`を返し、CMS取得失敗時は502を返す
  - Node専用APIを使わない
  - テストはroute.tsのGETを直接importし、parking-dataを`vi.mock`して、公開時・非公開時・CMS失敗時・festival_metaの失敗時(502)の各ステータスと本文、`no-store`ヘッダを検証する
  - _Requirements: 3.2, 3.7, 3.8, 5.2, 6.3_
  - _Boundary: /api/parking_
  - _Depends: 2.4_

- [x] 4. 駐車場空き情報ページ
- [x] 4.1 (P) 空き状況バッジと行の表示部品を実装する
  - 実装前にFigmaのnode-idをMCPで実測する。対象はファイル`0kWDqHsLr6xE8b4FFgR1Zx`のページ「駐車場空き情報ページ」(`815:4666`)のフレーム`815:4667`(PC)・`815:4703`(SP390)と、部品`812:570`(コンテンツ/駐車場)・`812:577`(ParkingStatusBadge)・`812:608`(ParkingRow)
  - 各駐車場を、空き状況バッジ(色と文字ラベル)・名称・`HH:mm更新`で1行にする
  - 30分を超えた駐車場は2行目を古い情報の表示(`history`アイコンと注記)に置き換える
  - 時刻の数字は`tabular-nums`、アイコンはMaterial Symbols Sharp(weight 300)のフォントで描画する
  - コンポーネントテストで、3段階のバッジ・通常の行・古い情報の行の表示が確認できる
  - _Requirements: 1.2, 1.3, 3.6_
  - _Depends: 2.2_

- [x] 4.2 一覧の状態管理とポーリングを結線する
  - 実装前にFigmaのnode-idをMCPで実測する。対象はファイル`0kWDqHsLr6xE8b4FFgR1Zx`のページ「駐車場空き情報ページ」(`815:4666`)のフレーム`815:4667`(PC)・`819:74`(PC取得失敗)・`819:88`(PC0件)・`821:113`(PC非公開)・`815:4703`(SP390)・`815:4739`(SP取得失敗)・`815:4777`(SP0件)・`821:121`(SP非公開)
  - 取得先は`/api/parking`、間隔は20秒、継続判定は公開中のみとする。古い情報の判定の現在時刻は`useNow(renderedAt)`で更新する
  - 状態行に取得時刻を出し、取得失敗中は`sync_problem`アイコンと失敗の文言に切り替えて一覧は直前の内容を残す。初回取得失敗で値が無いときは、時刻なしの「最新の情報を取得できません」を出し、一覧は出さない
  - 0件は「駐車場の情報はありません」を出す。非公開は一覧表示の1か所で描画し、再取得の結果が非公開になったら非公開の表示に切り替えてポーリングを止める
  - `history`・`sync_problem`を`frontend/src/app/layout.tsx`の`MATERIAL_SYMBOLS_ICON_NAMES`に追加する
  - コンポーネントテストで、通常・取得失敗・初回失敗・0件・非公開・非公開への切替の各表示が確認でき、スマホ幅のレイアウトに横方向にはみ出す固定幅がない
  - _Requirements: 1.1, 1.4, 1.5, 3.1, 3.5, 3.6, 6.2, 6.4_
  - _Depends: 2.2, 3.1, 3.2, 4.1_

- [x] 4.3 駐車場空き情報ページを組み立てる
  - 実装前にFigmaのnode-id`815:4667`・`815:4703`・`821:113`・`821:121`をMCPで実測し、見出しと非公開表示の配置を合わせる
  - `dynamic = 'force-dynamic'`を宣言し、初回データをサーバー側の取得関数で取って、レスポンスごと一覧表示に渡す。取得失敗時は初期値nullで描画する。`renderedAt`も渡す
  - 非公開時もページは200を返す
  - `route-metadata.ts`の`CodeRoutePath`型と`ROUTE_METADATA`に`/parking`を追加し、`route-metadata.test.ts`の完全一致の期待値も更新する
  - `route-classification.test.ts`の分類に合わせ、`route-classification`の`INTENTIONALLY_PRIVATE_ROUTES`に`/parking`を追加する
  - `/parking`は開催前の公開パスに加えず、既存の公開フェーズ制御に従わせる
  - ページテストで、公開時に一覧、非公開時に非公開の文言だけ、取得失敗時にエラー表示が描画される
  - frontendで`pnpm type-check`と`pnpm build`が通る(Edge制約の担保)
  - _Requirements: 1.1, 5.2, 5.3, 6.2_
  - _Depends: 2.4, 4.1, 4.2_

- [x] 5. (P) サイト全体の導線への組み込み
  - サイトマップに`/parking`を、公開フェーズが公開中かつ`parking_enabled`が真のときだけ載せる
  - `parking_enabled`は既存のfestival_meta取得結果から読む
  - 既存の下部ナビの`/parking`リンクは残し、`navigation.ts:57-59`のコメントは丸ごと削除する(timetableも実装済みのため)
  - 単体テストで、公開中のみサイトマップに`/parking`が含まれ、非公開・開催前では含まれない。`sitemap.test.ts`に`parking_enabled: true`のケースを追加する
  - _Requirements: 5.3, 6.2_
  - _Boundary: sitemap, navigation_
  - _Depends: 2.3_

- [x] 6. 実環境での検証
  - マイグレーションを伴うため`make cms-worktree`と`make dev CMS=worktree`で起動する。サーバーの直接起動やポート3000には触れない
  - `BUILD_PHASE`がpre_eventなので、フェーズトグル(`phase-toggle.tsx`、Cookie`aramakisai_phase_override=live`)で開催中に切り替えてから`/parking`を開く
  - データはworktreeのCMS管理画面で手動登録する。古い情報は、worktree DBの対象行の`updated_at`を30分以上前に書き換えて作る。取得失敗は`make dev-stop CMS=worktree`でworktree CMSを止めて作る
  - 幅390pxで`/parking`の通常・古い情報・取得失敗・0件の各状態を開き、横スクロールが出ないことを実測する
  - ローカルは`DEV_OVERRIDE_ENABLED`で常に公開扱いになる(6.5)ため、非公開は実ブラウザで見ない。非公開の表示と切替による停止は4.2・4.3のテストで担保する
  - 管理画面をスマホ幅で開き、駐車場1件の空き状況を変更・保存できることを確認する
  - ローカルのNodeには`caches`が無くTTL20秒は効かないため、反映時間の実測は「ポーリング間隔ぶんで反映されること」の確認に留める。TTL込みの3.2・3.7は、designの理論値と本番反映後の確認で担保する
  - タブ非表示中にリクエストが止まり、表示復帰で直ちに再取得されることをネットワークログで確認する
  - 検証後にworktree CMSを停止し、追加したデータを削除する
  - 各状態のスクリーンショットと反映時間の実測値が揃い、すべて基準を満たす
  - _Requirements: 1.5, 2.6, 3.2, 3.3, 3.4, 6.5_
