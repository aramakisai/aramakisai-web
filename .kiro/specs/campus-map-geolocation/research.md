# Research & Design Decisions

## Summary
- **Feature**: `campus-map-geolocation`
- **Discovery Scope**: Extension (既存の構内マップへのボタン・レイヤー・通知の追加)
- **Key Findings**:
  - Leafletの`Control.addTo`は下側の角では`corner.insertBefore(container, corner.firstChild)`で挿入する。`MapZoomControl`より後にaddToした独自コントロールはズームの真上に積まれる。間隔は上側のコントロールの`margin-bottom`だけで決まる
  - 既定のmarkerPane(z-index 600)にエリア名ラベルがあるため、R3.5を満たすには現在地を独自のPane(600〜650の間)に置く必要がある。PathはPaneごとに専用のSVGレンダラが作られ、そのSVGルートは`pointer-events="none"`なので下の操作を妨げない
  - 既存の`StampToast`は文言が`kind`で固定、「マイページ」リンクが常時表示、`z-40`である。構内マップでは地図のPane(z-index 400〜)とボトムシート(`z-[1050]`)の下に隠れる。文言とリンクの有無を任意propsで追加し、重なり順は呼び出し側のラッパーで上げる

## Research Log

### Figmaの実測値
- **Context**: 寸法・色・状態をFigmaと一致させる
- **Sources Consulted**: figma MCP `get_metadata` / `get_design_context` / `get_variable_defs`(fileKey `0kWDqHsLr6xE8b4FFgR1Zx`)。アセットSVGはスクラッチパッドに取得して属性だけを読んだ(コードでは使わない)
- **Findings**:
  - `MapLocateButton` `1170:757`: variant `State=default` `1170:753` / `State=active` `1170:755`。42x42、背景白、枠1px `color/gray-200`(#e7e5e4)、角丸`radius/md`(8px)、効果`shadow/card`。中身はMaterial Symbols Sharp Light(300)、24px、行高24px、FILL 0、`my_location`。色はdefaultが`color/text`、activeが`color/primary`(#ebb03c)。この2状態以外のvariantは無い
  - `MapUserLocation` `1170:758`: 120x120のsymbol。`accuracy` `1170:759`は塗り`color/location-accuracy`(#1a73e826、alpha 0.15)、線`color/location`(#1a73e8)1px(内側)。`dot` `1170:760`は直径16px、塗り`color/location`、白の線2px(内側)、ドロップシャドウ(y=1、blur 3、#000 30%)。白の線とシャドウは変数に束縛されていない
  - 状態フレームSP `1170:1264` / `1170:1294`(390x844): `MapLocateButton`はx=336、y=482、`MapZoomControl`はx=336、y=532。ボタン下端524からズーム上端532まで8px。左端が一致する
  - 取得失敗SP `1170:1294`: トーストはx=16、y=716、358x48。`StampToast`のインスタンスで文言「現在地を取得できませんでした」、リンク非表示、`color/gray-800`背景。ボトムシート(y=627〜)の上に重なって描かれている。ボタンはdefault
  - 現在地表示PC `1170:1230`(1440x900): ボタンはズームの真上、右下の角
  - `StampToast` `989:1084`のKindはadded/exists/bookmarked。違いは文言だけ
- **Implications**: ボタンは独自の見た目をTailwindで書く(Leafletが生成するDOMではないため)。マーカーは点をdivIcon、精度円を`L.Circle`で描く。トーストはボトムシートより手前に出す必要がある

### 既存コードの実測
- **Context**: 統合点と再利用の可否
- **Sources Consulted**: `frontend/src/components/campus-map/*.tsx`、`frontend/src/components/stamp-toast.tsx`、`frontend/src/components/stamp-collector.tsx`、`frontend/src/app/globals.css`、`frontend/tailwind.config.ts`、`frontend/src/lib/campus-map.ts`、`frontend/src/app/layout.tsx`
- **Findings**:
  - `MapZoomControl`はreact-leafletの`ZoomControl`(`position="bottomright"`)。見た目はglobals.cssの`.leaflet-control-zoom`上書きで、右余白は`.leaflet-bottom.leaflet-right .leaflet-control-zoom { margin-right: 24px }`
  - `CampusMapView`では`<AttributionControl>`→`<MapZoomControl>`の順にマウントし、addTo順で縦の並びを決めている。react-leafletの`createControlHook`は`useEffect`内で`instance.addTo(map)`する。Reactは兄弟のeffectを前から順に実行するため、`<MapZoomControl>`の後ろに置いた独自コントロールはズームより後にaddToされる
  - 色トークンは`tailwind.config.ts`の`theme.extend.colors`にある(globals.cssに`@theme`は無い)。Tailwind v4をJS config経由で使っているため`--color-*`のCSS変数は生成されない。JSで色値が要る箇所は`lib/campus-map.ts`が`tailwind.config`をimportして値を読む前例がある
  - Material Symbolsは`layout.tsx`の`MATERIAL_SYMBOLS_ICON_NAMES`でアイコン名サブセットを指定して読み込む。`my_location`は未登録で、追加しないと字形にならない
  - `StampToast`: propsは`kind`だけ。文言は`MESSAGES[kind]`で固定、`<Link href="/mypage">マイページ</Link>`は常に描画。`role="status"`、3000ms後に退場、200ms後に`null`を返す。タイマーはマウント時の1回だけなので、再表示には呼び出し側で`key`を変えて再マウントする必要がある。位置は`fixed right-4 bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]`、`lg:`以上は`bottom-[calc(1rem+...)]`、幅358px、`z-40`
  - 構内マップの重なり順: Leafletの各Paneはz-index 400〜700、コントロール角は1000。地図コンテナもその祖先もスタッキングコンテキストを作らないため、これらはルートの文脈で比較される。ボトムシートは`z-[1050]`(全画面・ドラッグ中は`z-[1100]`)、検索欄`z-[1080]`、メニューのオーバーレイ`z-[1090]`、メニューボタン`z-[1100]`。`z-40`のトーストは地図とシートの下に隠れる
  - `/map`は`(fullscreen)`レイアウトで下部ナビゲーションが無い。それでもトーストのSP位置は下端から80px(4rem+1rem)で、Figmaのy=716(844-716-48=80)と一致する
  - `campus-map-view.test.tsx`は`react-leaflet`と子コンポーネントをモジュールごとモックしている。新しい子を足すとそのモックが要る
- **Implications**: トーストは文言とリンクの有無を任意propsで追加すれば再利用できる。重なり順は呼び出し側で上げる。アイコン名の登録をlayout.tsxに追加する

### Leaflet 1.9.4 / react-leaflet 5.0.0のソース
- **Sources Consulted**: `node_modules/leaflet/src/control/Control.js`、`src/layer/vector/Renderer.getRenderer.js`、`src/layer/vector/SVG.js`、`src/dom/DomEvent.js`、`dist/leaflet.css`、`react-leaflet/lib/Pane.js`・`Pane.d.ts`・`Circle.d.ts`、`@react-leaflet/core/lib/circle.js`・`control.js`
- **Findings**:
  - `Control.addTo`: 位置に`bottom`を含むと`corner.insertBefore(container, corner.firstChild)`。CSSは`.leaflet-control { float: right(右側); clear: both }`、`.leaflet-bottom .leaflet-control { margin-bottom: 10px }`、`.leaflet-right .leaflet-control { margin-right: 10px }`。floatの縦マージンは相殺されないので、上下の間隔は上側の`margin-bottom`になる
  - `DomEvent.disableClickPropagation`は`mousedown touchstart dblclick contextmenu`だけを`stopPropagation`し、`click`は止めずに`_leaflet_disable_click`フラグで地図側のclick処理だけを無効にする。ReactのonClick(ルートへの委譲)は届く
  - `Map.getRenderer` → `_getPaneRenderer(pane)`: overlayPane以外のPaneを指定したPathには、そのPane専用のレンダラが作られる
  - `SVG._initContainer`: `this._container.setAttribute('pointer-events', 'none')`。CSSは`.leaflet-pane > svg path`と`.leaflet-marker-icon`を`pointer-events: none`にし、`.leaflet-interactive`の付いたものだけ戻す。`interactive: false`の層はクリックを下へ通す
  - 既定Paneのz-index: overlay 400 / shadow 500 / marker 600 / tooltip 650 / popup 700
  - react-leafletの`Pane`は`name`(既定Pane名は不可)と`style`を受け、子レイヤーのcontextの`pane`をそのPaneにする
  - `Circle`の`radius`はメートル(地図の縮尺に追従)。`updateCircle`は`center`の参照が変わると`setLatLng`、`radius`が変わると`setRadius`を呼ぶ。Pathの`className`は生成時だけ反映される
  - `Marker`は`position`が変わると`setLatLng`、`icon`が変わると`setIcon`
  - `map.panTo(latlng, options)`はズームを保ったまま中心を移す。`maxBounds`がある場合は表示が範囲を外れない位置に補正される
- **Implications**: ボタンは`L.Control`を自前で作り、その容器へReactをportalで描く。マーカーは独自Pane(z-index 625)に置く

### Geolocation API
- **Sources Consulted**: [W3C Geolocation](https://www.w3.org/TR/geolocation/)、[MDN Geolocation.watchPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
- **Findings**:
  - `watchPosition(success, error, options)`はwatch IDを返し、`clearWatch(id)`で止める。許可を求めるのは呼び出し時で、ページを開いただけでは求めない
  - 非セキュアコンテキストでは`PERMISSION_DENIED`でerrorCallbackが呼ばれる。エラーコードは`PERMISSION_DENIED`=1、`POSITION_UNAVAILABLE`=2、`TIMEOUT`=3
  - watchは「位置の有意な変化」を待ってから取得を繰り返す。timeoutのタイマーは各取得の開始から数え、許可待ちと文書が非表示の時間は含まない。静止していてもTIMEOUTにはならない
  - `clearWatch`後に、既にキューに積まれたコールバックが抑止されるかは仕様に明記がない
  - `accuracy`は95%信頼のメートル単位の半径
  - 非表示の文書には位置の更新が届かない
- **Implications**: errorCallbackは種類を問わず失敗として扱う(R4.2・4.3)。`'geolocation' in navigator`が偽ならR4.4。古いwatchのコールバックはセッションIDで捨てる。精度円の半径には`accuracy`をそのまま使う

### Permissions-Policy
- **Sources Consulted**: `frontend/`配下のgrep(`next.config.*`、`public/`、`src/`、`wrangler.toml`)、`curl -sI https://aramakisai.com/map`
- **Findings**: Permissions-Policyヘッダーは設定されていない。geolocationの既定の許可リストは`self`なので、トップレベルの`/map`で使える
- **Implications**: ヘッダーの変更は要らない

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 独自`L.Control`+portal | Leafletのコントロール角にボタンを入れ、中身はReactで描く | ズームと同じ角・余白・SPの持ち上げ(`max-md:[&_.leaflet-bottom]:mb-4`)に自動で追従する | addToの順序に依存する | 採用 |
| 地図外の絶対配置ボタン | `CampusMapScreen`にfixedのボタンを置く | Leafletに依存しない | ボトムシートの高さ追従とズームの位置を二重に計算する | 不採用 |
| マーカーをoverlayPaneに置く | 既定のPaneで描く | Pane追加不要 | markerPaneのエリア名ラベルより奥になりR3.5違反 | 不採用 |

## Design Decisions

### Decision: 位置の監視は1つのフックが持つ
- **Context**: R2(開始・初回の中心移動・取得中の押下での現在地への移動・離脱時の停止)、R4(失敗時の停止と通知)
- **Selected Approach**: `useUserLocation`がwatch ID・状態・失敗回数を持ち、ボタン・マーカー・トーストは結果を描くだけにする
- **Rationale**: Geolocation APIとの境界を1か所に閉じ込め、jsdomで`navigator.geolocation`をモックして単体テストできる

### Decision: トーストは`StampToast`に任意propsを2つ足して再利用する
- **Context**: R4.6(同じ見た目・リンク無し)、R4.7(同じ位置)、R4.8(`role="status"`)
- **Alternatives Considered**:
  1. 新しいトーストを作る — 見た目と位置が二重管理になる
  2. `kind`に`location-error`を足す — Figmaは`Kind=added`のインスタンスで文言を上書きしている。kindの意味(スタンプの結果)が崩れる
  3. `message?`と`showLink?`を足す — Figmaのインスタンス上書き(Kind=added、文言上書き、リンク非表示)と1対1に対応する
- **Selected Approach**: 3。既定値は従来どおりなので`StampCollector`は変更しない
- **Trade-offs**: `z-40`はそのままにして、構内マップ側で`relative z-[1060]`のラッパーをbodyへportalする。他ページの重なり順は変えない

### Decision: 中心移動はアニメーションなしの`panTo`
- **Context**: R2.4(縮尺を変えずに中心を移す、初回だけ)
- **Selected Approach**: `map.panTo(latlng, { animate: false })`
- **Rationale**: ズームを変えない。既存の`MapViewportSync`も`animate: false`で、動きの停止設定(`data-motion`)を扱う必要が生じない

### Decision: 色トークンは`tailwind.config.ts`へ追加する
- **Selected Approach**: `theme.extend.colors`に`location: '#1a73e8'`と`'location-accuracy': '#1a73e826'`を追加する。点はTailwindクラス(`bg-location`)、精度円のJSのpathOptionsは`lib/campus-map.ts`と同じく`tailwind.config`のimportで値を読む
- **Rationale**: このリポジトリでは`--color-*`のCSS変数が生成されないため、JSで値が要るときはconfigのオブジェクトを読むのが既存の流儀で、hexを二重に持たない

## Risks & Mitigations
- addToの順序が崩れるとボタンがズームの下に回る — `<MapZoomControl />`の直後にマウントすることをdesignに明記し、E2Eでボタン下端とズーム上端の差8pxを実測する
- 精度円の線はLeafletでは中心線上に描かれ、Figmaは内側1px — 半径方向に0.5pxの差。精度円の半径は測位で毎回変わる値なので見た目の差として扱わない
- `role="status"`を内容ごと挿入する方式はスクリーンリーダーによって読み上げが安定しない場合がある — R4.6・4.8は既存のStampToastと同じ振る舞いを求めているため、既存と同じ方式を採る
- PC(lg以上)ではトースト(右下16px、358px幅)がズームとボタンの上に3秒間重なる — R4.7で既存トーストと同じ位置と定めているため、そのまま受け入れる
- 既存の観察(本specでは変えない): Figma SPのズームの右余白は約12px、コードは24px。ボタンはズームと同じ規則で右端を揃える

## References
- [W3C Geolocation](https://www.w3.org/TR/geolocation/) — watch・timeout・エラーコード・accuracyの定義
- [MDN watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
- Leaflet 1.9.4ソース(`node_modules/leaflet/src`)、react-leaflet 5.0.0 / @react-leaflet/core 3.0.0の型とソース
