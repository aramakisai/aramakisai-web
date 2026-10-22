# Research & Design Decisions

## Summary
- **Feature**: `ga-technical-metrics`
- **Discovery Scope**: Extension(既存のGA4読み込みと`sendGaEvent`を拡張し、各機能に計測点を追加する)
- **Key Findings**:
  - 現行の読み込み順では、`config`より前にdataLayerへ積んだ独自イベントは送信されない(実験で確認)。`js`/`config`を先に積めば、gtag.jsの読み込みが遅れても送信される
  - 実プロパティでは拡張計測の「ブラウザ履歴イベント」と「サイト内検索」が有効。クエリ文字列が変わる`pushState`/`replaceState`は1回ごとにpage_viewになり、`?q=`があると`search_term`にキーワード文字列がそのまま送られる。この2つはコードでは止められない
  - プロパティには「page_locationに`/`を含むpage_viewから`click`イベントを作る」というイベント作成ルールがある。そのため既存の`click`件数は実際のクリック数ではない

## Research Log

### A3: GA読み込み前に積んだイベントの扱い
- **Context**: `frontend/src/app/layout.tsx`は、gtag.jsとinitスクリプト(`js`/`config`)の両方を`strategy="lazyOnload"`で読む。そのため、ページ表示直後に`sendGaEvent`が積んだイベントは`config`より前にdataLayerへ入る
- **Sources Consulted**:
  - https://developers.google.com/tag-platform/gtagjs/reference ― 「The Google tag snippet must appear on the same page, above `event` commands, or your data won't be sent.」。`config`前のイベントを保持するか破棄するかは書かれていない
  - 実験(scratchpadの最小HTML、Playwright 1.61.1 chromium、実測定ID`G-4PN34461HS`のgtag.jsを読み込み、`/g/collect`はrouteでabortして実データは送らない)
- **Findings**:
  - 現行順(`event`→`js`→`config`→gtag.js読み込み): collect要求は`page_view`・`click`・`scroll`・後発の`late_evt`だけで、先行の`early_evt`は送られなかった
  - 改善順(`js`→`config`→`event`→gtag.js読み込みは遅延のまま): `early_evt`が`page_view`と同じ時刻に送られた
- **Implications**: gtag.jsの読み込みを遅らせる方式はそのまま維持できる。条件は「最初のイベントより前に`js`/`config`を積む」ことだけ。全送信経路を1つの関数に通し、その関数が初回に初期化を積む形にすれば、呼び出し順に依存しない

### A4: 拡張計測の履歴イベントとURL書き換え
- **Context**: 構内マップの絞り込み(`use-map-filters.ts`、`pushState`、`q`/`category`/`area`)と企画一覧の絞り込み(`exhibition-list.tsx`、`replaceState`)はクエリ文字列を書き換える。マイページのタブ(`mypage-view.tsx`)とスタンプ検証値の除去(`stamp-collector.tsx`)はハッシュだけを書き換える
- **Sources Consulted**:
  - https://support.google.com/analytics/answer/9216061 ― 拡張計測のpage_viewは「each time the page loads or the browser history state is changed by the active site」。監視対象は`pushState`・`popState`・`replaceState`。サイト内検索の既定パラメータは`q, s, search, query, keyword`
  - 実プロパティの設定: analytics MCPには拡張計測設定を読む手段が無く、MCPからは**未読取**。代わりに、配信中のgtag.js(`https://www.googletagmanager.com/gtag/js?id=G-4PN34461HS`)に埋め込まれた設定値を読んだ。値は`vtp_enableHistoryEvents:true`、`vtp_enablePageView:true`、`vtp_enableScroll:true`、`vtp_enableOutboundClick:true`、`vtp_enableDownload:true`、`vtp_enableForm:true`、`vtp_enableVideo:true`、`vtp_searchQueryParams:"q,s,search,query,keyword"`、`vtp_isAutoCollectPiiEnabledFlag:true`
  - 実験(同条件。`replaceState ?q=abc` → `pushState ?page=2` → ハッシュだけ変える`replaceState` → 同じURLへの`pushState` → ハッシュを除く`replaceState`の順に実行)
- **Findings**:
  - クエリが変わる`replaceState`と`pushState`は、どちらも1回ずつpage_viewを生んだ。page_viewの`dl`には`?q=abc`がそのまま入った
  - ハッシュだけの変更と同じURLへの`pushState`は、page_viewを生まなかった
  - `gtag('set',{page_location})`で上書きした値は、独自イベント・手動page_view・scrollに反映された。履歴イベントのpage_viewは上書きを無視し、実際のURL(`q`を含む)を送った
  - 初回page_viewに付く`view_search_results`は、`page_location`を上書きしても`ep.search_term=<キーワード>`を送った
- **Implications**:
  - Requirement 6.2・6.3(タブ・ハッシュ除去)は現行のままで計上されない
  - Requirement 6.1(絞り込み)と1.3(キーワードを送らない)は、拡張計測の「ブラウザ履歴イベントに基づくページの変更」と「サイト内検索」をGA管理画面で無効にしないと満たせない。無効にした後のページ遷移はアプリ側からpage_viewを送る

### 既存のイベント作成ルール
- **Context**: 実験で、クリック操作が無いのにpage_viewのたびに`click`が送られた
- **Findings**: gtag.jsに`__ogt_event_create`があり、内容は`new_event_name:"click"`、条件は`event_name == page_view`かつ`page_location`が`/`を含む(大文字小文字区別なし)。プロパティの直近30日の`click`(2,871件)はこのルールの産物
- **Implications**: 本specの独自イベント名には`click`を使わない。ルール自体の見直しは本specの範囲外(design.mdに記載)

### Web Vitals
- **Sources Consulted**: `frontend/node_modules/next/web-vitals.js`(next 16.4.2に同梱)。Next.jsドキュメントの`useReportWebVitals`
- **Findings**: `useReportWebVitals`は`{ name, value, rating, id, navigationType }`を渡す。CLS・INPはページを隠したときに確定する。そのため、送信時点のURLが計測対象ページと異なる場合がある
- **Implications**: 指標の対象ページは、フックが最初に動いた時点のパスを別項目として送る。追加の依存は不要

### Next.jsの履歴同期
- **Findings**: Next.js(14.1以降)では、`window.history.pushState`/`replaceState`の呼び出しが`usePathname`/`useSearchParams`に反映される。既存コードの絞り込み・ページ送りは、すべてネイティブのhistory APIで書かれている
- **Implications**: page_viewを送るコンポーネントは、`usePathname`と`useSearchParams`の`page`だけを監視すれば、Next遷移・ページ送り・戻る操作のすべてを拾える

### エラー画面の再試行と成否の判定
- **Context**: Requirement 18.2。既存のエラー画面(`(site)/error.tsx`、`(fullscreen)/error.tsx`、`global-error.tsx`)は再試行ボタンに`reset`を渡している
- **Sources Consulted**:
  - https://nextjs.org/docs/app/api-reference/file-conventions/error ― `retry`は「try to re-fetch and re-render the error boundary's children. If successful, the fallback error component is replaced with the result of the re-render」。`reset`は「In most cases, you should use `retry()` instead」で、取得し直さずに再描画する。`retry`はv16.3.0で安定化。エラーの記録は`useEffect(…, [error])`、`error.digest`でサーバーログと突き合わせる
  - 実験(`origin/dev`の一時worktree、Next 16.4.2の開発サーバー、Playwright。`(site)`配下に、サーバーコンポーネントで常に例外を出すページと初回だけ例外を出すページを置き、`(site)/error.tsx`にマウント・アンマウント・`[error]`のeffectのログを入れた)
- **Findings**:
  - `retry`が失敗し続ける場合: 押すたびにサーバーへ再要求が届き(要求回数が1→2→3と増える)、新しいdigestのエラーが返る。エラー画面は「古いインスタンスのアンマウント → 新しいインスタンスのマウント → `[error]`のeffect」の順に作り直された。マウントされたまま`error`だけが差し替わることはなかった
  - `retry`が2回目で成功する場合: 古いインスタンスのアンマウントだけが起き、新しいマウントは無く、本来の画面が表示された
  - `reset`の場合: サーバーへの再要求は発生せず、同じdigestのエラーで作り直され、初回だけ失敗するページでも回復しなかった
  - モジュール変数のフラグと、アンマウント時に`setTimeout(…, 0)`で予約した確認処理で判定させたところ、失敗時は新しいインスタンスのマウントで`retry_fail`、成功時は予約した処理で`retry_success`が、それぞれ1回だけ出た
  - 開発時のStrictModeによる二重マウント(アンマウント直後に同じインスタンスを再マウント)が観察されたが、フラグが偽の状態で起きるため判定に影響しなかった
- **追加実験(`(fullscreen)/error.tsx`と`global-error.tsx`)**: 同じ手順で、3つのエラー画面に同じ判定処理(モジュール変数のフラグは1つを共有)を入れた。`(fullscreen)`配下には常に失敗するページと初回だけ失敗するページを置き、全体エラー画面はルートレイアウトの子に置いたサーバーコンポーネントで例外を出した(クエリで指定したときだけ)
  - `(fullscreen)/error.tsx`: 失敗時は「click retry → サーバー再要求 → 旧インスタンスのunmount → 新インスタンスのmount(`retry_fail`)→ `[error]`のeffect(新しいdigest)」、成功時は「click retry → サーバー再要求 → unmountのみ(`retry_success`)→ 本来の画面」で、`(site)/error.tsx`と同じだった
  - `global-error.tsx`: ルートレイアウトの例外でも、`retry`でルートレイアウトごとサーバーから取得し直された。失敗時・成功時の順は上と同じで、成功時は全体エラー画面が消えて本来の文書(ルートレイアウトとページ)に置き換わった
  - 全体エラー画面の初回表示では、mountのログが2回、間にunmountを挟まずに出た。2回ともフラグは偽なので判定には影響しない
  - 開発時は全体エラー画面の上に開発用オーバーレイが重なり、ボタンを通常のクリックで押せなかった。DOMの`click()`で押した。本番には存在しない
- **本番ビルドでの確認**: 実施していない。ローカルで本番ビルドを起動する手段がリポジトリに無い。`make dev`と`make preview`はどちらも`next dev`を起動し、`next start`等の直接起動はフックで禁止されている。本番ビルドでの確認はPRプレビュー(`frontend-ci.yml`の`deploy-preview`。`NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE=true`のため`/e2e-error-trigger`と`/e2e-error-trigger-fullscreen`が例外を出す)で行う。この2ページは常に例外を出すため、プレビューで確かめられるのは失敗側(`retry_fail`)だけで、成功側は開発サーバーでの実験結果に依る
- **Implications**: 再試行は3つのエラー画面すべてで`retry`に替える。成否はタイマーのしきい値ではなく、エラー画面の作り直しの有無で判定できる。コンポーネント内のrefは作り直しで失われるため、状態はモジュール変数で持つ。3画面で1つのモジュール変数を共有してよい

### 再試行の検証用ページ
- **Context**: Requirement 18.8。既存の`/e2e-error-trigger`と`/e2e-error-trigger-fullscreen`は常に例外を出すため、本番と同じビルド(PRプレビュー)では再試行の失敗側しか再現できない
- **Findings**:
  - 既存ページは`DEV_OVERRIDE_ENABLED`(`NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE=true`)が偽なら`notFound()`、真なら例外を出す。`force-dynamic`で、PRプレビューは`deploy-preview`でこのフラグ付きでビルドされる
  - CIの`e2e (staging preview)`ジョブは、プレビューURLに対して`frontend/e2e/error-pages.spec.ts`を毎回実行している
  - `retry`はサーバーへ再要求する(上の実験)。そのため、再試行の前にブラウザへ付けたCookieは2回目の要求に載る
- **Implications**: 回復条件をリクエストのCookieで与えれば、サーバーに状態を持たずに「失敗→成功」を確定的に再現できる

### プレビューでのGA確認
- **Context**: 実測確認(5.2, 18.2, 18.7)をPRプレビューで行う前提
- **Findings**: Infisical stagingに`NEXT_PUBLIC_GA_MEASUREMENT_ID`は無い(変数名だけを確認。prodにはある)。`deploy-preview`のビルドはstagingの値を使うため、プレビューでは`sendGaEvent`が何も積まない
- **Implications**: プレビューのビルドにだけ測定IDを渡す必要がある。本番の測定IDを渡すと、Cloudflare Accessの内側でプレビューを見た実行委員の閲覧が本番プロパティに混ざる。ダミーの測定IDならdataLayerへの積み順と内容は本番と同じになり、送信先の計測は存在しない

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存`analytics.ts`拡張(採用) | 送信関数を1つにし、初期化・除外・URL整形をその中で行う。各機能は呼び出しを足すだけ | 変更が局所的。呼び出し順に依存しない | `analytics.ts`にGA固有の知識が集まる | 既存`sendGaEvent`のパターンを踏襲 |
| `@next/third-parties`の`GoogleAnalytics` | 公式の読み込みコンポーネントと`sendGAEvent` | 実装が少ない | 読み込みが`afterInteractive`になり、現行の遅延方針が崩れる。/signage除外・URL整形・page_view制御を別途作る必要は残る。依存も増える | 不採用 |
| Measurement Protocol(サーバー送信) | Workersから送る | ブラウザの読み込みに左右されない | `api_secret`の管理が増える。端末情報・Web Vitalsはクライアントでしか取れない。Requirement 1.5の趣旨にも反する | 不採用 |
| GTMコンテナ導入 | タグ管理をGTMへ移す | 管理画面で変更できる | 構成要素が1つ増え、コードと設定が二重管理になる | 不採用 |

## Design Decisions

### Decision: 初期化を送信関数の中で行う
- **Context**: A3。子コンポーネントのeffectは親より先に走るため、レイアウト側で初期化しても、最初のイベントより前に`config`が入る保証は無い
- **Alternatives Considered**:
  1. `<head>`のインラインスクリプトで`js`/`config`を同期的に積む
  2. 送信関数`gtag()`が、初回呼び出し時に`js`/`set`/`config`を積む
- **Selected Approach**: 2。gtag.jsの読み込みだけを、レイアウトのコンポーネントが`load`後のアイドル時に行う
- **Rationale**: インラインスクリプトは`global-error.tsx`(クライアント描画で`<head>`のスクリプトが実行されない)で使えない。/signage判定・URL整形とのロジックの二重化も避けられる
- **Trade-offs**: 初期化が最初の呼び出しに依存する。そのため、page_viewを送るコンポーネントがイベントの無いページでも必ず初期化する
- **Follow-up**: 公開後、GAのリアルタイムレポートで`qr_stamp`と`client_capabilities`が届くことを確認する

### Decision: 履歴イベントとサイト内検索をGA管理画面で無効にし、page_viewはアプリから送る
- **Context**: A4。コード側で絞り込みのpage_viewを止める手段も、`search_term`を消す手段も無い
- **Alternatives Considered**:
  1. 絞り込み状態をURLに載せない ― 共有可能URLという既存仕様を壊す
  2. 絞り込みのクエリ名を`q`から変える ― 検索キーワードは消えるが、絞り込みのpage_viewは残る。既存の共有URLも壊れる
  3. history APIをラップしてGAの検知を抑える ― gtag.js内部の挙動に依存する
  4. 管理画面で2項目を無効にし、`usePathname`と`page`の変化でpage_viewを送る
- **Selected Approach**: 4
- **Trade-offs**: 管理画面の手作業(無効化2項目とカスタム定義の登録)が実装と同時に必要になる。手作業が先行すると、その間ページ遷移のpage_viewが欠ける
- **Follow-up**: 管理画面の変更はデプロイ直後に行う(手順はdesign.mdのMigration Strategy)

### Decision: 機能ごとに1イベント名、共通の`result`で内訳を表す
- **Context**: Requirement 1.4。カスタムディメンションはイベントスコープで最大50個。既存は12個
- **Selected Approach**: イベント名は機能単位(`campus_map`、`parking`等)、内訳は共通の`result`、手段は`method`、数値は`duration_ms`/`item_count`/`metric_value`
- **Rationale**: GAの探索で「イベント名×result」の1つの表で集計できる。追加するディメンションは15個で、合計27個に収まる

### Decision: 駐車場の取得失敗は連続失敗の開始時だけ送る
- **Context**: Requirement 14.2・14.4。20秒間隔の定期取得がCMS障害中も続くと、1端末あたり毎分3件が送られる
- **Selected Approach**: `error`が`false`から`true`に変わったときだけ送る。古い情報の区画は1回の表示につき最初の1回だけ送る

### Decision: 再試行の成否はエラー画面の作り直しの有無で判定する
- **Context**: Requirement 18.2・18.7
- **Alternatives Considered**:
  1. 再試行から5秒以内にエラー画面が再表示されたら失敗、されなければ成功とする ― 5秒に根拠が無い。応答が5秒を超えて遅いと失敗を成功と誤判定し、短くすると成功前に判定してしまう
  2. エラー画面のアンマウントを成功、`[error]`のeffectの再実行を失敗とし、状態をコンポーネント内のrefで持つ ― 実験で、失敗時はエラー画面が別インスタンスとして作り直されることを確認した。refは引き継がれず、失敗時もアンマウントが起きるため成功と誤判定する
- **Selected Approach**: モジュール変数のフラグを立てて`retry()`を呼ぶ。新しいエラー画面がフラグ付きでマウントされたら失敗、アンマウント後の`setTimeout(…, 0)`でフラグが残っていたら成功
- **Rationale**: Next.js公式の`retry`の挙動(成功時はエラー画面が置き換わる)と、実験で確かめた作り直しの順序だけに依存し、時間のしきい値を持たない

### Decision: 検証用ページは既存の`/e2e-error-trigger`をCookieで回復できるように拡張する
- **Context**: Requirement 18.8
- **Alternatives Considered**:
  1. サーバーのメモリ上のカウンタで初回だけ例外を出す ― Workersではリクエストごとにisolateが異なり得るため、2回目の要求が別isolateに届くと再び失敗する
  2. KVやDurable Objectsに回数を記録する ― 検証のためだけに束縛と後片付けが増える。並行するe2e同士で回数を取り合う
  3. クエリパラメータで回復を指示する ― `retry`はURLを変えずに再要求するため、再試行の前後で条件を変えられない
  4. クライアントコンポーネントのモジュール変数で初回だけ例外を出す ― 実際の失敗(ISRのサーバー側の取得失敗)と経路が違う。Reactは描画エラー時に描画をやり直すことがあり、1回目で変数を消費して例外が見えなくなりうる
  5. 経過時間で回復させる(初回表示からN秒後は成功) ― 時間のしきい値に依存し、CIの速度で結果が変わる
  6. 新しい検証用ルートを追加する ― 既存ページはCookieが無ければ従来どおり例外を出すため、拡張すれば既存のe2eをそのまま保てる。ルートを増やす理由が無い
- **Selected Approach**: 既存の`(site)/e2e-error-trigger`で、Cookie`e2e_retry_ok`があれば回復後の本文を返し、無ければ従来どおり例外を出す。対象は`(site)`だけ
- **Rationale**: サーバーに状態を持たず、Cookieの有無だけで結果が決まる。判定処理は3画面で共有の1か所なので、1画面で両側を確かめれば足りる。全体エラー画面の再現にはルートレイアウトへ検証用の分岐が要り、全ページに影響する

### Decision: プレビューのビルドにだけダミーの測定IDを渡す
- **Alternatives Considered**:
  1. 本番の測定IDを渡す ― プレビューの閲覧が本番プロパティに混ざる
  2. stagingに検証用のGAプロパティを作る ― 管理対象が増える。確認したいのはdataLayerへの積み順と内容で、送信後の集計ではない
  3. プレビューでのGA確認をやめる ― 本番ビルドでの送信順(5.2)と再試行の判定(18.2, 18.7)を公開前に確かめる手段が無くなる
- **Selected Approach**: `deploy-preview`のビルドにだけ`G-PREVIEW000`を渡し、e2eで`window.dataLayer`を読む。gtag.jsとcollectへの要求はe2eでabortする
- **Rationale**: 本番プロパティを汚さず、本番と同じビルドで積み順を確かめられる

## Risks & Mitigations
- 管理画面の手作業漏れ ― Migration Strategyに手順と確認方法(リアルタイムレポート)を書く
- /signageへのクライアント遷移後に拡張計測(scroll等)が出る ― 端末は/signageを直接開く運用。独自イベントとpage_viewは除外判定で止める
- `useSearchParams`がSuspense境界外でクライアント描画への切り替えを起こす ― page_view送信コンポーネントを`<Suspense fallback={null}>`で包む
- プレビューを人が開くと、ダミーの測定IDでgtag.jsとcollectへの要求が出る ― 存在しない計測に送られるだけで、本番プロパティには入らない
- 再試行の結果が出る前に来場者がリンクで別ページへ移ると、エラー画面のアンマウントを`retry_success`と誤判定する ― 再試行の結果は通常すぐ返るため頻度は低いと見て許容する

## References
- https://nextjs.org/docs/app/api-reference/file-conventions/error ― エラー画面の`retry`と`reset`
- https://developers.google.com/tag-platform/gtagjs/reference ― コマンドの順序条件
- https://support.google.com/analytics/answer/9216061 ― 拡張計測の履歴イベントとサイト内検索
- https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals ― `useReportWebVitals`
- https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating#using-the-native-history-api ― ネイティブhistory APIと`usePathname`/`useSearchParams`の同期
