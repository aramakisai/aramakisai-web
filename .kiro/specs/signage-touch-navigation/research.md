# Research & Design Decisions

## Summary
- **Feature**: `signage-touch-navigation`
- **Discovery Scope**: Extension(既存の`/signage`と一般向けページの部品を組み合わせる)
- **Key Findings**:
  - 行き先の内容は`/signage`の中に置く同一オリジンのiframe(`/signage/touch/*`)で表示する。上位文書は`/signage`から一度も遷移しないため、緊急地震速報の購読・全画面表示が切れない。iframe内の地図・ピンチ・ドラッグは`transform: scale`下でも正しく動く(実験1)
  - iframe内のピンチは上位文書の拡大(visualViewport)を起こす。`/signage`の`user-scalable=no`で止まる(実験3)。止めないと拡大がサイネージ表示へ戻った後も残る
  - アドレスバーは設置時の1タップでFullscreen APIの全画面にして消す。上位文書が遷移・再読込しないので全画面は維持される(実験2)。電子黒板は借り物のためインストール等は採らない

## Research Log

### 既存サイネージの構造
- `SignageScreen`が配信経路(`useSignageChannel`)・速報(`parseQuakePayload`)・1920×1080キャンバスの`transform: scale`(`useCanvasLayout`)をすべて持つ(`frontend/src/components/signage/signage-screen.tsx:73,103-107,120-131`)
- 速報オーバーレイはキャンバス内の最後の子(`signage-screen.tsx:158-166`)、`absolute inset-0 bg-background`(`signage-quake-overlay.tsx:219`)。解除は`quake.active`が偽になった時点で即時に外れる
- 既存のフェードは`fade-in 600ms ease-out`(`frontend/src/app/globals.css:745-756`)。スライド切替(`signage-main.tsx:42`)と出演枠(`signage-left-column.tsx:48`)が`CrossFade`(`components/cross-fade.tsx`)経由で使う
- `/signage`は`force-dynamic`で、端末は再読込せず何日も動き続ける(`app/(fullscreen)/signage/page.tsx:6`)

### 行き先ページの中身と対象外導線
- 一覧ページは薄いラッパー: 企画一覧`ExhibitionList`(`(site)/exhibitions/page.tsx:40`)、タイムテーブル`TimetableView`(`(site)/timetable/page.tsx:61`)、駐車場`ParkingList`(`(site)/parking/page.tsx:43`)、トピック`TopicsList`(`(site)/topics/page.tsx:37`)、構内マップ`CampusMapScreen`(`(fullscreen)/map/page.tsx:41`)
- `(site)`レイアウトがヘッダー・フッター・下部ナビを出す(`(site)/layout.tsx:26-33`)。マップはハンバーガー`MapMenuButton`(`campus-map-screen.tsx:127`)と現在地`MapUserLocation`(`campus-map-view.tsx:94`)を出す
- 企画詳細に対象外の部品: 共有`ShareButton`・ブックマーク`BookmarkButton`(マイページの保存)・外部リンク`ExhibitionLinks`・スタンプ`StampCollector`(`(site)/exhibitions/[id]/[category]/page.tsx:162,210-222`)。トピック詳細の本文はCMSのHTML(`(site)/topics/[id]/page.tsx:103`)で外部リンクを含み得る
- 企画カードの`bookmarkable`(`exhibition-list.tsx:110`)、カード・行のリンク先は公開パス固定(`exhibition-card.tsx:50`、`topic-card.tsx:17`、`lib/timetable.ts:128`)
- 絞り込みのURL結合: `ExhibitionList`は`history.replaceState`で`/exhibitions?…`へ書き換え(`exhibition-list.tsx:65,71`)、`useMapFilters`は`history.pushState`で`/map?…`へ(`use-map-filters.ts:58`)。どちらも`location.search`から復元する(`exhibition-list.tsx:34`、`use-map-filters.ts:31`)
- 既定の検索・日付切替は画面上部にある(`ExhibitionFilters`は一覧の先頭`exhibition-list.tsx:86`、日付ボタンは`timetable-view.tsx:58`付近、マップ検索は`MapSearchOverlay`)。要件5.1の配置を満たすには操作部品を組み替える必要がある

### 実験1: scale下・iframe内のLeaflet(タップ・ドラッグ・ピンチ)
- 方法: `leaflet@1.9.4`(本番と同じ`node_modules`)で、1920×1080キャンバスを`fitCanvas`と同じ式で`scale`した親に、(a)地図を直接、(b)同一オリジンiframe内の地図、を置き、Playwright(chromium、`hasTouch`/`isMobile`)からCDP`Input.dispatchTouchEvent`でタップ・200pxドラッグ・2本指ピンチ(間隔100→200)を送った。スクリプトは`scratchpad/run-exp.mjs`
- 結果(期待値: タップは赤い矩形に当たる、ドラッグ後の中心lng=200、ピンチ後ズーム=1):

| CSS表示幅/DPR | scale | 直接 | iframe |
|---|---|---|---|
| 1920/2 | 1 | 命中・200・1 | 命中・200・1 |
| 3840/1 | 2 | 命中・200・1 | 命中・200・1 |
| 1280/3 | 0.67 | 命中(誤差0.5)・200・1 | 命中(誤差1)・211・1 |

- 0.67倍のiframeのドラッグ+5%は指を離す時点の速度による慣性。座標変換の誤りではない
- iframe内の`innerWidth`はiframeのCSS幅(キャンバス単位)。メディアクエリもiframe幅で評価される(`mq1024`がiframe幅900で偽)
- **含意**: Leaflet1.9は親の`scale`を補正する。iframeに入れても座標は正しい。端末のCSS幅が1920でも3840でもiframe内のレイアウトはキャンバス単位で同一になる

### 実験2: 全画面表示とiframe内の遷移
- 方法: 上位文書でタップ時に`documentElement.requestFullscreen()`、その後iframeの`src`を2回変更。iframeの`load`ごとに`contentWindow`へ`pointerdown`(capture)を付け直して数えた(`scratchpad/run-fs.mjs`)
- 結果: 全画面は2回の遷移後も維持。iframe内のタップを親が毎回受け取れた
- **含意**: 上位文書が遷移しない構成ならFullscreen APIも切れない。無操作の検知は親がiframeの`window`を直接聞ける(同一オリジン)

### 実験3: iframe内のピンチによる上位文書の拡大
- 方法: 上位文書のviewportを既定(`width=device-width,initial-scale=1`)と`maximum-scale=1,user-scalable=no`の2通りで、iframe内の非地図領域を2本指で広げた(`scratchpad/run-pz.mjs`)
- 結果: 既定は`visualViewport.scale=5`、`user-scalable=no`は1
- **含意**: `/signage`のviewportで拡大を禁止する。地図のピンチはLeafletが`touch-action: none`で自分で処理するため影響しない(実験1は既定viewportで成立)

### 手の届く範囲(電子黒板の最大サイズ)
- エルモの現行ELMO Boardは55・65・75・86型(OSレスモデルの発表資料、2026-08-07。Android搭載の86型はEL86R2、3840×2160、Android 9)。最大は86型
- 86型16:9の表示高さ: 86×25.4×9/√337=1070.9mm。1080基準で1px=0.992mm
- 画面下端100cm・上限122cm→下端から22cm=220/1070.9×1080=221.9px。操作部品の上端をキャンバスy≥859に置けば86型で床から121.9cm以下
- 小さい型ほど1pxが小さく条件は緩い(75型: 933.8mm、22cm=254px)
- 前提: キャンバス下端が画面下端に一致すること。16:9パネルを全画面で使えば`fitCanvas`の余白は0(`signage-viewport.ts:22-32`)。16:9より縦長だと上下に等分の余白ができ操作部品が上がる

### Cloudflare Accessの範囲
- Accessアプリ`aramakisai_signage`のdestinationsは`aramakisai.com/signage`と`aramakisai.com/api/signage`(aramakisai-infra `terraform/access.tf:91-110`)。同ファイルのコメント(:90)の通り配下パスも含む
- 実測(2026-10-22、curl): `/signage/touch/map`→302(Accessログインへ)
- **含意**: `/signage/touch/*`は既存の保護範囲に入る。iframeは同一オリジンなので`CF_Authorization`がそのまま送られる。セッションは730h(`access.tf:96`)

### アドレスバーを出さない方式
- Fullscreen APIの`requestFullscreen`はユーザー操作が要る(MDN)。iframe内のタップでも上位文書がユーザー操作を得る(HTML Standard activation notificationは祖先のwindowにも付与)
- 全画面ではアドレスバーが隠れた状態に固定される(Chrome「URL bar resizing」: "For fullscreen scenarios, where the URL bar is locked to a hidden state")。スクロールで出ない
- 上位文書が遷移しなければ全画面は切れない(実験2)。上位文書を再読込・遷移させるコードは無い(`design.md`「上位文書の再読込・遷移の経路」)。Chromeによるタブの再読込・戻る操作では解除されるため、次のタップで全画面に戻す
- 採用しなかった方式: Web App ManifestでWebAPKとしてインストールし`display: fullscreen`で起動する方式。起動直後から全画面になるが、端末へのインストールが要り、借り物の電子黒板には採れない

### フェーズ
- `BUILD_PHASE='pre_event'`(`lib/phase.ts:16`)。開催前の公開パスは`/topics`・`/parking`・`/signage`等(`phase.ts:30-49`)と前置詞`/topics/`(`phase.ts:58-61`)。`/exhibitions`・`/timetable`・`/map`は非公開
- middlewareは非公開パスを404へrewriteする(`frontend/src/middleware.ts:16-27`)。拡張子付きパスはmiddlewareを通らない(`middleware.ts:31-33`)
- `/signage/touch/*`は前置詞に無いため、live切替前の本番では404。電子黒板を使う開催当日はliveのため5つとも表示される
- PRプレビューはフェーズの切替が有効(`.github/workflows/frontend-ci.yml:175`)。11/1までの実機確認に使える

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations |
|---|---|---|---|
| A. `/signage`内にiframe(採用) | 上位文書は`/signage`のまま、行き先は`/signage/touch/*`のページをiframeで出す | 購読・全画面が切れない。毎回最新データ。破棄すれば操作内容が全消去。iframe内はキャンバス単位でレイアウトが揃う。公開ページのURL書き換えがiframe内に閉じる | 文書が2つになりメモリが増える。行き先切替のたびに文書を読み込む |
| B. `/signage`内で状態切替(ルーティング無し) | 5つの行き先のデータを`/signage`で取得し、クライアントで表示を切り替える | 文書1つ | `/signage`は再読込されないため行き先のデータが古くなる。詳細ページ用の取得経路を新設。`h-dvh`・ブレークポイントが端末のCSS幅で評価される |
| C. `/signage/layout.tsx`で入れ子ルート | サイネージをレイアウトに置き、行き先を子ルートにする | 文書1つ・Next標準 | 上位URLが`/signage/touch/…`へ変わり、再読込・電源断で行き先から起動する。公開部品の`replaceState`で上位URLが公開パスへ化ける |

## Design Decisions

### Decision: 行き先はiframeで表示する
- **Selected Approach**: A
- **Rationale**: 要件4(購読維持)・3.4(操作内容の消去)・6(アドレスバー)を、上位文書を動かさないという1つの性質で同時に満たせる
- **Trade-offs**: 行き先の切替で毎回文書を読み込む(`location.replace`で履歴を増やさない)

### Decision: 操作部品は端末用の部品で組み直し、見るだけの部分は既存部品を使う
- **Context**: 要件5.1は検索・絞り込み・日付切替・ズームを下端221px以内に求める。既定の部品は上部に置かれURLと結合している
- **Selected Approach**: 状態はReactの`useState`に持ちURLへ書かない(iframe破棄で消える)。絞り込みロジック(`filterExhibitions`)・カード・地図・表は既存のものを使う
- **Trade-offs**: 端末用の操作部品(検索・絞り込み・日付切替)を新設する。見た目はFigmaで決める

### Decision: 対象外導線はiframe側のリンク方針1か所で止める
- **Selected Approach**: `/signage/touch`のレイアウトがクリックを捕捉し、`/exhibitions/:id/:category`・`/topics/:id`・`/exhibitions`・`/topics`を端末用パスへ読み替え、それ以外を止める。止めるリンクはCSSでリンクの見た目を消す。共有・ブックマーク・外部リンク・スタンプ・現在地は描画しない
- **Rationale**: CMS本文中のリンクまで個別対応せずに済む

### Decision: アドレスバーはFullscreen APIで消す
- **Selected Approach**: Chromeの通常のタブで`/signage`を開き、全画面でないときのタップで上位文書を`requestFullscreen()`する。そのタップは通常のタップとしても扱う。設置担当が設置時に1回タップする
- **Rationale**: 端末に変更を加えない。上位文書が遷移しないので一度全画面にすれば維持される
- **Trade-offs**: タブの再読込・戻る操作で解除された後は、次のタップまでアドレスバーが出る

## Risks & Mitigations
- 全画面の解除(タブの再読込・戻る操作) — 次のタップで全画面に戻す。戻る操作で`/signage`から離れたら設置担当が開き直す
- 画面キーボードが検索欄を覆う — Chrome既定(`interactive-widget=resizes-visual`)ではレイアウトは変わらず、視覚ビューポートが入力欄まで動く。設置時の動作確認項目に入れる
- 文書2つによるメモリ増 — 操作終了でiframeを破棄する。サイネージ側は現状通り
- iframe内の`Link`遷移は共有履歴に積まれる。Androidの戻る操作でiframe内が戻る — 行き先の切替は`location.replace`で積まない。iframe破棄で操作内容は消える

## References
- [ELMO Board OSレスモデル発表資料(2026-08-07)](https://www.elmo.co.jp/wp/wp-content/uploads/20260807_pr_elmoboard_osless_model.pdf) — 現行サイズ55〜86型
- [86" ELMO Board R2 (EL86R2)](https://www.elmousa.com/product/86-elmo-board-r2-el86r2) — Android搭載86型、3840×2160
- [MDN: Element.requestFullscreen()](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) — ユーザー操作が必要
- [HTML Standard: User activation](https://html.spec.whatwg.org/multipage/interaction.html#activation-notification) — 祖先のwindowにも付与
- [Chrome: URL bar resizing](https://developer.chrome.com/blog/url-bar-resizing) — 全画面ではアドレスバーが隠れた状態に固定
- [Cloudflare Access: Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) — 配下パスは上位の規則を継承
