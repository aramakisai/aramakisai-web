# Research & Design Decisions

## Summary
- **Feature**: `signage-current-location`
- **Discovery Scope**: Extension(既存のサイネージ・タッチ操作・構内マップへの追加)
- **Key Findings**:
  - サイネージ本体 `/signage` は検索パラメータを受け取らない。タッチ操作の行き先は同一オリジンの iframe で、親の検索パラメータは iframe へ渡らない。地図の行き先へは親の `navigate` だけが遷移する(iframe 内のリンクは `/signage/touch/map` へ行かない)
  - サイネージのスナップショット `SignageSnapshot` は地図データ(`map_areas`・`map_points`)を持たない。構内マップスライドは `ImageSlide` で画像を出し、`pageCount` は画像が無いと 0 を返す
  - `CampusMapView` は子要素を受け取らず、操作を止める props も無い。エリア名ラベル `AreaLabelMarker` はエリアの最大ポリゴンの重心 `polygonCentroid` に中央寄せで置かれる

## Research Log

### 設置エリアの受け渡し経路
- **Context**: 要件 1.1・1.5。`?map_area` を親とタッチ操作の iframe の両方で使う
- **Sources Consulted**: `app/(fullscreen)/signage/page.tsx`、`components/signage/signage-touch-layer.tsx:160-260,435-457`、`lib/signage-touch.ts:6-20,103-108`、`lib/use-touch-clock-shift.ts`、`components/signage/touch/touch-link-guard.tsx`
- **Findings**:
  - `page.tsx` は `force-dynamic` で searchParams を受けていない
  - iframe の src は最初の行き先の `path` に固定され、以降は `contentWindow.location.replace(dest.path)` で切り替える
  - 親→iframe の値渡しは postMessage `signage-touch-clock` の前例があるが、iframe 側の購読開始を待つため「パスの知らせのたびに再送」する作りになっている
  - iframe 内のリンクは `TouchLinkGuard` が `/exhibitions`・`/topics` 系だけ端末用パスへ書き換え、ほかは止める。`/signage/touch/map` へのリンクは無い
- **Implications**: 地図の行き先の path に `?map_area=<id>` を付けるだけで iframe の地図へ渡せる。postMessage より単純で、遷移のたびの再送も要らない

### 地図データの取得経路
- **Context**: 要件 1.4(エリア名)・4.1(マップスライドの地図)
- **Sources Consulted**: `lib/signage-data.ts:113-216`、`lib/signage.ts:39-58,86-105,205-227`、`lib/campus-map.ts:91-124,170-200`、`app/api/signage/route.ts`
- **Findings**:
  - スナップショットは TTL 15 秒、版通知での再取得と 120 秒の保険ポーリングで更新される。`map_areas` には版通知のフックが無い
  - `getCampusMapData` は areas・exhibitions・points をまとめて取る。サイネージには exhibitions は要らない
  - 本番の `map_areas` は 20 件(2026-11-08 時点、公開 API で確認)
- **Implications**: スナップショットに地図データ(areas・points)を足し、既存の更新経路に乗せる。エリアの変更は版通知では届かず、TTL とポーリングで最大 120 秒程度遅れて反映される。運用上、開催中にエリアの形を変えることは想定しにくく許容する

### 表示範囲の外れ値
- **Context**: 要件 4.2(Q-5(a): タッチ操作の構内マップの初期表示と同じ範囲)
- **Sources Consulted**: `lib/exhibition-location-map.ts:82-106`(`excludeOutlierAreas`)、本番 `map_areas`
- **Findings**: 外接矩形の中心を緯度・経度ごとに Tukey の柵で判定する。本番データで除外されるのは「馬術場」(ID 10)だけ
- **Implications**: 馬術場を設置エリアにした端末では、構内マップスライドのピンが画面外になる。Q-5(a) の決定どおりの帰結として扱う

### ピンとラベルの寸法(Figma 実測)
- **Context**: 要件 2.1〜2.5・3.2
- **Sources Consulted**: Figma `1555:63`(`get_design_context`)、`829:281`・`884:794` ほかのメタデータ、`915:683`(縦型ヘッダー部品)、`1276:4102`、`1539:271` の画像を画素で計測
- **Findings**:
  - ラベル: 角丸 9999、地 `rgba(255,255,255,0.92)`、padding 16px/8px、要素間 8px、アイコンと「現在地」の間 4px、文字 24px(`signage/meta`)・行高 1.25、`location_on` は `color/primary`・Material Symbols Sharp Light・FILL 1、「現在地」は Bold、エリア名は Regular、色 `color/text`。外寸 202×46(エリア名「1号館」のとき)
  - 横型スライド: スライド枠(1536×864)の右端から 24px。見出しチップを持つスライド(構内マップ・協賛・落とし物・駐車場・タイムテーブル)は top 27(チップ 52px と上下中央をそろえる)、持たないスライド(登録画像・レイアウト 5 種)は top 24
  - 縦型: ヘッダー部品(1032×176)の x=551, y=9。開催日 `Signage/EventDate`(x=796, y=10, 高さ 44)と上下中央がそろう。縦型のメイン枠(横型の縮小)にはラベルが無い
  - タッチ操作: キャンバスの x=24, y=981(行き先ナビ top 952・高さ 104 の中心 1004 にラベルの中心をそろえる)
  - ピン: Figma では地図画像に描き込まれている(独立ノードなし)。画素計測で `#ebb03c` の `location_on`(FILL 1)、描画された形は幅 29px・高さ 37px。Figma では先端がエリア名ラベルの上端の 10px 上にあるが、実装では企画の場所の地図のピンと同じく先端を重心に合わせる
  - 縦型マップスライドのメイン枠は横型の 0.671875 倍の縮小(地図フレーム 1290×806.25 = 1920×1200 の同倍率)
- **Implications**:
  - Figma の地図画像はエリア名ラベルを高さ 34px で描いており、実装のエリア名ラベル(高さ 22px)の約 1.55 倍の縮尺になっている
  - ユーザーの決定(D-1 (a))により、ピンは実装の地図の縮尺に合わせる。字形の高さ = ラベルの高さ × 37/34
  - Material Symbols の `location_on` は 24 グリッドで横 16・縦 20 を占めるため、字形の高さ 24px は文字サイズ 29px に当たる

### 当時の決定との関係
- **Context**: 既存 spec は ADR として読む
- **Findings**:
  - `digital-signage`: 「端末設定・URL パラメータを持たない」(要件 1.5)、「構内マップスライドは CMS 登録画像。Leaflet 案は遠目に読みにくく外部タイルに依存するため不採用」(research)
  - `signage-touch-navigation`: 「全端末が同じ URL」(要件 1.3)
- **Implications**: いずれもこの spec の要件で置き換わる。地図の見え方は Figma で承認済み。タイル依存は一般向けサイトの構内マップ・タッチ操作の構内マップと同じ条件になる

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 地図の行き先 path に検索パラメータ | 親が `/signage/touch/map?map_area=<id>` を iframe に開かせる | 既存の遷移経路のまま。再送不要 | 地図ページが検索パラメータを読む必要がある | 採用 |
| postMessage で渡す | `signage-touch-clock` と同じ方式 | 前例あり | 購読開始待ちの再送が要る | 不採用 |
| スナップショットに地図データ | `getSignageSnapshot` に areas・points を足す | 既存の更新・失敗時の扱いに乗る | スナップショットが数十 KB 増える | 採用 |
| 別 API で地図データ | サイネージ用の地図 API を新設 | スナップショットを太らせない | 取得・更新経路が二重になる | 不採用 |

## Design Decisions

### Decision: ピンは既存の AreaPin を拡張して使う
- **Context**: 要件 3.2・3.3(エリア名ラベルの真上、ポリゴンとラベルより手前)
- **Alternatives Considered**:
  1. 新しいピン部品と専用の pane を作る
  2. 企画の場所の地図で使っている `AreaPin`(divIcon・`LocationPinIcon`・字形の下端の空きの補正済み)に、色の props を足す
- **Selected Approach**: 2。エリア名ラベルと同じポリゴンの重心に、企画の場所の地図と同じく先端を合わせて立てる(持ち上げない)。手前に出すのは `zIndexOffset` で行う
- **Rationale**: 字形の下端の補正(`-translate-y-[89.58%]`)を作り直さずに済み、新しいファイルも pane も要らない
- **Trade-offs**: 先端の下にエリア名ラベルが重なる(企画の場所の地図と同じ)

### Decision: マップスライドの地図は inert の層で描く
- **Context**: 要件 4.4
- **Alternatives Considered**:
  1. `CampusMapView` に操作を止める props を足す
  2. 地図を `pointer-events: none` の層で包む
  3. 地図を `inert` 属性の層で包む
- **Selected Approach**: 3
- **Rationale**: Leaflet の CSS がポリゴン・ラベル・コントロールに `pointer-events: auto` を付け直す(`leaflet.css:132-136,247-256`)ため、2 では止まらない。縦型ではタップでタッチ操作が開かないので、地図が動かせてしまう。`inert` は属性 1 つで子孫ごと操作対象から外れ、`CampusMapView` を変えずに済む

### Decision: 構内マップスライドの巡回条件は地図データの有無
- **Context**: 要件 4.6
- **Selected Approach**: `pageCount` の `campus_map` は、スナップショットの地図データがあれば 1、取得に失敗して無ければ 0 を返す
- **Rationale**: 画像は使わなくなる。地図データが無いと何も描けないため巡回から外す

## Risks & Mitigations
- 地図タイルの読み込み前にスライドが出て、地の灰色が一瞬見える — 同じ端末では 2 回目以降ブラウザのキャッシュから読む。実ブラウザで初回表示を確認する
- 縦型はメイン枠を CSS の transform で縮小している — Leaflet は transform を考慮しない座標で操作を扱うが、スライドの地図は操作を受けないため影響しない。表示範囲は縮小前の 1536×864 で計算される
- エリアの変更が版通知で届かない — TTL とポーリングで反映される(最大 120 秒程度)
- iframe の位置の知らせ(`signage-touch-path`)に検索パラメータが混ざると、親の行き先の判定がずれうる — 知らせるのは pathname だけであることを実装時に確かめる

## References
- `.kiro/specs/digital-signage/` — 構内マップスライド・向きの判定の当時の決定
- `.kiro/specs/signage-touch-navigation/` — iframe 方式・端末用の地図の当時の決定
- Figma `0kWDqHsLr6xE8b4FFgR1Zx` ページ「デジタルサイネージ」`828:2`
