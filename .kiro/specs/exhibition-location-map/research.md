# Research & Design Decisions

## Summary

- **Feature**: `exhibition-location-map`
- **Discovery Scope**: Extension (`campus-map` が構築した地図基盤を企画詳細ページへ展開する)
- **Key Findings**:
  - `ExhibitionDetail` は `ExhibitionCardSummary` を継承しており `areaIds` を既に保持する。対象エリアの解決に新しい取得経路は不要。
  - 埋め込みを阻む唯一の実体は `CampusMapView` の `className="h-dvh w-full"`。route group や `leaflet.css` の import 位置は制約にならない。
  - `/map` 側のクエリ解釈 (`parseCampusMapQuery`) は `selectedAreaId: number | null` の単数であり、遷移時に対象エリアを一つに絞る必要がある。
  - 矩形範囲 (bounds) の算出関数は既存になく、leaflet 1.9.4 の `latLngBounds` を用いる薄いヘルパのみを新設する。

## Research Log

### 対象エリアの解決経路

- **Context**: 要件 1.2 は「直接の所在エリア」と「出演ステージの所在エリア」の双方を対象エリアとする。この解決を新規に実装するか、既存資産を再利用できるかを判断する必要があった。
- **Sources Consulted**: `frontend/src/lib/exhibitions.ts`、`cms/src/collections/stages.ts`、`cms/src/collections/student-exhibitions.ts`
- **Findings**:
  - `stages` コレクションは `area_id` (`map_areas` へのリレーション) を持つ。
  - private 関数 `resolveAreaIds` が「直接の `area_id` を先に `Set` へ追加し、続いて出演ステージの `area_id` を追加する」和集合を返す。
  - この結果は `ExhibitionCardSummary.areaIds` として公開されており、`ExhibitionDetail` はこれを継承する。
  - `resolveLocationForCategory` は `category === 'stage'` の場合に `area_id` を参照せずステージ名のみを返す。所在地テキストの表記規則と地図のエリア解決は別系統である。
- **Implications**:
  - `exhibitions.ts` への新規 export は不要。`getExhibitionDetail` の戻り値をそのまま利用する。
  - `Set` の挿入順が保持されるため `areaIds[0]` は「直接の所在エリア、それがなければ最初の出演ステージの所在エリア」と一致する。要件 3.3 の選択規則はこの配列順に対応づけられる。
  - この対応は `resolveAreaIds` の実装順序に依存する暗黙の契約であるため、design.md の契約として明示し、回帰テストで固定する。

### 埋め込み可能性と route group の影響

- **Context**: 構内マップは `(fullscreen)` route group 配下で全画面表示される。同じ地図を `(site)` 配下の企画詳細ページに埋め込めるかを確認する必要があった。
- **Sources Consulted**: `frontend/src/components/campus-map/campus-map-view.tsx`、`campus-map-screen.tsx`、`frontend/src/app/(fullscreen)/layout.tsx`、`frontend/src/app/(site)/layout.tsx`
- **Findings**:
  - `(fullscreen)/layout.tsx` は `<div className="min-h-screen min-h-dvh">` のみで、地図固有の機構を持たない。
  - `leaflet.css` の import は `campus-map-view.tsx` 内で完結し、Client Component の境界を越えない。
  - `CampusMapView` は `MapContainer` に `className="h-dvh w-full"` を直接与える。ビューポート高への依存はこの一箇所。
  - `CampusMapScreen` は `'use client'` を持つモジュールのトップレベルで `dynamic(..., { ssr: false })` を呼ぶ。Server Component 内で `ssr: false` を指定するとビルドが失敗する旨のコメントが同ファイルにある。
- **Implications**:
  - 埋め込みの障害は route group ではなく `CampusMapView` の高さ指定にある。
  - 企画詳細ページ (`page.tsx`) は Server Component のまま維持し、Client Component を一枚挟んでから `dynamic(ssr: false)` を呼ぶ既存パターンを踏襲する。

### 遷移先クエリの形式

- **Context**: 要件 3.2 は構内マップページへエリア選択状態を引き継ぐ。複数の対象エリアをすべて引き渡せるかを確認する必要があった。
- **Sources Consulted**: `frontend/src/lib/campus-map.ts`、`frontend/src/lib/exhibitions.ts` の `buildFilterHref`
- **Findings**:
  - `CampusMapFilters.selectedAreaId` は `number | null` の単数である。
  - `buildCampusMapHref(filters)` は内部で `buildFilterHref('/map', ...)` を呼び、URL 上は `area=` のカンマ区切り形式を取りうるが、`parseCampusMapQuery` は単一のエリア ID しか解釈しない。
- **Implications**:
  - 複数エリアを URL へ列挙しても `/map` 側は先頭以外を無視する。要件 3.3 の「一つを選ぶ」規則は必要であり、`areaIds[0]` をそのまま用いる。
  - `buildCampusMapHref` のシグネチャは変更しない。

### 矩形範囲の算出

- **Context**: 要件 1.10 はすべての対象エリアが初期表示で収まることを求める。既存に範囲算出の手段があるかを確認した。
- **Sources Consulted**: `frontend/src/lib/campus-map-geometry.ts`、`frontend/package.json`、Leaflet 1.9 の `LatLngBounds` API
- **Findings**:
  - 既存の公開関数は `parsePolygonGeometry` と `polygonCentroid` のみで、bounds を返すものはない。
  - 依存は `leaflet@1.9.4` / `react-leaflet@5.0.0`。`latLngBounds()` は座標配列から範囲を構築し、`extend()` で結合できる。
  - `MapContainer` は `bounds` / `boundsOptions` を受け取り、`useMap().fitBounds()` で再適用できる。
- **Implications**:
  - 範囲算出のアルゴリズムを自前で実装せず、複数の `PolygonGeometry` を leaflet の bounds へ畳み込む薄いヘルパのみを新設する。
  - 同じヘルパを初期表示と「企画位置に戻す」操作の双方で用いる。

### マップピンの描画手段

- **Context**: 要件 1.4〜1.7 はエリア位置を塗りつぶしの Material Symbols Sharp アイコンで示す。既存の地図上ラベル実装が転用できるかを確認した。
- **Sources Consulted**: `frontend/src/components/campus-map/area-label-marker.tsx`、`frontend/src/components/icons.tsx`、Google `material-design-icons` リポジトリ
- **Findings**:
  - `AreaLabelMarker` は `renderToStaticMarkup` で React 要素を文字列化し `divIcon` に渡す。CMS 由来の文字列を React の既定エスケープに通す意図がある。`interactive={false}` によりクリックはポリゴン層へ素通りする。
  - `icons.tsx` の `createIcon(testId, path, viewBox)` ファクトリは非 export だが汎用であり、path を渡すだけでアイコンを一件追加できる。`fill="currentColor"` 固定のため色は className で与える。
  - 既存の `PlaceIcon` は outline 形状 (weight 300) のみ。塗りつぶし形状は `location_on_wght300fill1_24px.svg` として公式リポジトリに存在する。
- **Implications**:
  - ピンは `AreaLabelMarker` と同じ `divIcon` + `renderToStaticMarkup` パターンで実装する。新しい描画方式を持ち込まない。
  - `icons.tsx` に塗りつぶし形状のアイコンを一件追加する。ファクトリ自体は変更しない。

### エリアデータの取得単位

- **Context**: 企画詳細ページは対象エリアの区画データのみを必要とする。既存の `getCampusMapData()` は全出展物も併せて取得する。
- **Sources Consulted**: `frontend/src/lib/campus-map.ts`
- **Findings**:
  - `getCampusMapData()` は `areas` と `exhibitions` を独立した成否として返す。企画詳細ページに不要な出展物一覧の取得を伴う。
  - `MapArea` から `CampusMapArea` へ変換する `toCampusMapArea` は非 export である。geometry の検証と色解決を内包し、検証に失敗した場合は `null` を返す。
- **Implications**:
  - 変換規則を本 spec 側で再実装すると `campus-map` が所有する色解決・形状検証が二重化する。
  - `campus-map.ts` に対し、エリアのみを取得する関数と `toCampusMapArea` の export 追加を本 spec が行う。既存 export のシグネチャは変更しないため、`campus-map` spec の Revalidation Triggers には該当しない。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: `CampusMapView` を拡張 | 高さやコントロールの有無を props で切り替え、同一コンポーネントを両画面で使う | 実装箇所が一つに集約される | 全画面表示の責務を持つコンポーネントに埋め込み文脈の分岐が入り込む。`campus-map` spec が所有する描画規則へ本 spec が変更を加えることになる | 採用しない |
| B: 専用コンポーネントを新設 | 埋め込み用のコンテナを新設し、ポリゴン層・色解決・設定値を import で再利用する | 責務境界が明瞭。`campus-map` の所有物を読むだけで済む | 表示コンテナのコードが二箇所に分かれる | **採用** |
| C: 共通の下位コンポーネントへ抽出 | `CampusMapView` から地図本体を切り出し、両者がそれを使う | 重複が最小 | 既存の全画面表示を巻き込むリファクタとなり、`campus-map` spec の所有領域を改変する。本 spec の範囲を超える | 採用しない |

## Design Decisions

### Decision: 埋め込み用コンポーネントを新設する

- **Context**: 企画詳細ページに地図を表示するにあたり、`CampusMapView` を再利用するか専用実装を置くかを決める必要があった。
- **Alternatives Considered**:
  1. Option A — `CampusMapView` に埋め込みモードを追加する
  2. Option B — 専用コンポーネントを新設し、下位の層とロジックを import で再利用する
  3. Option C — 地図本体を共通コンポーネントへ抽出する
- **Selected Approach**: Option B。`ExhibitionLocationMapView` を新設し、`AreaPolygonLayer` / `resolveAreaColor` / `CAMPUS_MAP_CONFIG` を import する。
- **Rationale**: `CampusMapView` は `campus-map` spec が所有する。全画面表示の責務に埋め込み用の分岐を持ち込むと、両 spec が同一コンポーネントを共同所有する状態になり、設計原則の「No Hidden Shared Ownership」に反する。下位の層は読み取り専用の依存として扱える。
- **Trade-offs**: `MapContainer` の組み立てが二箇所に分かれる。ただし埋め込み側はコントロール構成・初期表示の決め方・高さの与え方がいずれも異なり、共通化しても分岐が増えるだけである。
- **Follow-up**: `campus-map` 側の `MapContainer` 設定 (`maxBounds` / `zoomControl` / `attributionControl`) が変わった際、埋め込み側が追従すべきかを判断する。

### Decision: 対象エリアの解決に既存の `areaIds` を用いる

- **Context**: 要件 1.2 の対象エリア解決を、新規実装するか既存の公開型から取るかを決める必要があった。
- **Alternatives Considered**:
  1. `exhibitions.ts` に直接の `area_id` とステージ由来の `area_id` を分離して露出する export を追加する
  2. `ExhibitionDetail.areaIds` をそのまま用いる
- **Selected Approach**: 2。`getExhibitionDetail` の戻り値に含まれる `areaIds` を対象エリアの ID 列として扱い、先頭要素を遷移先クエリに用いる。
- **Rationale**: `resolveAreaIds` は直接の `area_id` を先に `Set` へ追加するため、配列順が要件 3.3 の優先順位と一致する。`exhibitions.ts` は `exhibition-pages` が所有しており、新規 export を求めずに要件を満たせる。
- **Trade-offs**: 配列順への依存が暗黙の契約となる。
- **Follow-up**: 配列順を固定する回帰テストを設け、`resolveAreaIds` の変更が本 spec を壊すことを検知できるようにする。

### Decision: エリア取得と変換を `campus-map.ts` の export 追加で賄う

- **Context**: 企画詳細ページはエリアの区画データのみを必要とするが、既存の取得関数は出展物一覧も併せて取得する。
- **Alternatives Considered**:
  1. `getCampusMapData()` をそのまま呼び、出展物の結果を破棄する
  2. 本 spec 側で `map_areas` を直接取得し、変換を再実装する
  3. `campus-map.ts` にエリアのみを取得する関数と `toCampusMapArea` の export を追加する
- **Selected Approach**: 3。
- **Rationale**: 1 は企画詳細ページの初期表示に不要な取得を持ち込む。2 は `campus-map` が所有する色解決と形状検証を二重化する。3 は既存 export のシグネチャを変えず、`campus-map` spec 自身が `exhibitions.ts` に対して行った export 追加と同じ形を取る。
- **Trade-offs**: 本 spec が他 spec の所有ファイルへ変更を加える。変更は追加のみに限定する。
- **Follow-up**: `campus-map` spec の Allowed Dependencies に本 spec からの依存が生じる旨を、当該 spec の再検証時に確認する。

## Risks & Mitigations

- 地図資産の読み込みが企画詳細ページの初期表示を遅らせる — `dynamic(ssr: false)` と `loading` プレースホルダにより初期 HTML と hydration をブロックしない。セクションの占有領域を先に確保しレイアウトシフトを防ぐ。
- `resolveAreaIds` の実装順序変更により遷移先エリアが変わる — 配列順を固定する回帰テストを設ける。
- 埋め込み地図のドラッグ操作がページスクロールと競合する — 地図面のドラッグは遷移の契機とせず、遷移は明示的なリンク操作のみに限る (要件 3.4)。狭い画面での操作性は実機確認で検証する。
- `campus-map` 側の地図設定変更に埋め込み側が追従しない — `CAMPUS_MAP_CONFIG` を共有することで縮尺範囲と表示範囲の上限は自動的に追従する。コントロール構成の差分は design.md に記録する。

## References

- [Leaflet 1.9 `LatLngBounds`](https://leafletjs.com/reference.html#latlngbounds) — 複数ポリゴンの範囲算出に用いる
- [React Leaflet `MapContainer`](https://react-leaflet.js.org/docs/api-map/) — `bounds` / `boundsOptions` の受け渡し
- [Material Symbols `location_on`](https://github.com/google/material-design-icons/tree/master/symbols/web/location_on/materialsymbolssharp) — 塗りつぶし形状 (`wght300fill1`) の取得元
- `.kiro/specs/campus-map/design.md` — 地図描画規則と Boundary Commitments の所有元
- `.kiro/specs/exhibition-location-map/gap-analysis.md` — 実装差分の棚卸し
