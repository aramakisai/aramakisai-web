# Gap Analysis: exhibition-location-map

## 前提の注意

- 本書は実装方針を決定するものではなく、選択肢と材料を提示する。決定は design フェーズで行う。
- CMS 側の変更は不要という requirements.md の前提を確認済み (`student_exhibitions.area_id` / `booth_number` / `booth_label` / `map_areas.geometry` はすべて既存)。
- `campus-map` spec の design.md (Boundary Commitments) と `exhibition-pages` spec の所有領域には、本調査の範囲では抵触しない。ただし新規追加する「単一エリアへのビューポート収め込み」「初期表示に戻す操作」「マップピン」は `campus-map` に存在しない表現であり、requirements.md の Adjacent expectations 通り本 spec が独自に定義する必要がある。

## 1. 現状調査サマリ

### 既存資産 (実測)

**地図描画 (`frontend/src/components/campus-map/`)**

- `CampusMapView({ areas, selectedAreaId, onSelectArea })` (`campus-map-view.tsx`) — Leaflet `MapContainer` 本体。`CAMPUS_MAP_CONFIG` (center/zoom/bounds/タイル URL) を直接参照し、`className="h-dvh w-full"` で**ビューポート全体を前提に固定サイズ指定**している。props 自体は汎用的 (エリア配列・選択 ID・選択ハンドラのみ) で企画詳細ページへもそのまま渡せるが、**レイアウトはフルスクリーン専用**。
- `CampusMapScreen` (`campus-map-screen.tsx`) — `/map` ページの画面全体を構成する Client Component。`MapMenuButton` / `MapSearchOverlay` / `MapSidePanel` / `MapBottomSheet` という全画面前提の UI シェルを含み、企画詳細ページでは不要 (再利用対象外)。`next/dynamic(..., { ssr: false })` による `CampusMapView` の動的読み込みパターンはこのファイル内にあり、**このパターン自体は再利用すべき箇所**。
- `AreaPolygonLayer` / `AreaLabelMarker` — GeoJSON ポリゴン描画・キーボード選択・エリア名ラベル。`areas` 配列を渡すだけで動作し、そのまま再利用可能。
- `MapZoomControl` — ズームボタン。再利用可能。「初期表示位置へ戻す」ボタンは存在せず、**新規コンポーネントが要る** (Req 2.4)。
- `use-map-filters.ts` — `window.history.pushState` で URL を直接書き換える。`/map` 専用のフィルタ状態管理であり、企画詳細ページの単一エリア表示には不要 (再利用対象外)。

**ジオメトリ・色・設定 (`frontend/src/lib/`)**

- `campus-map-geometry.ts`: `parsePolygonGeometry()` (zod 検証) / `polygonCentroid()` はそのまま再利用可能。**`polygonBounds()` に相当する関数は存在しない** — Req 1.8 (該当エリアが収まる位置と縮尺) の実現に必要になる可能性が高い新規関数。
- `campus-map-config.ts`: `CAMPUS_MAP_CONFIG` (minZoom/maxZoom/bounds/tileUrlTemplate) を共有すれば Req 2.3 (同じ縮尺範囲・表示範囲上限) をそのまま満たせる。ただし `center`/`initialZoom` は会場全体用の固定値であり、単一エリア表示にはそのまま使えない。
- `campus-map.ts`: `resolveAreaColor()` は再利用可能。`toCampusMapArea(area: MapArea): CampusMapArea | null` (geometry 検証 + 色解決をまとめる関数) は**存在するが export されていない**。`getCampusMapData()` は一覧全体を取得する用途で、単一エリアの取得には過剰。

**企画データ (`frontend/src/lib/exhibitions.ts`)**

- `getExhibitionDetail(id, category)` は `fetchJoinSources(id)` で `map_areas` を含めて取得済みだが、返す `ExhibitionDetail` には**エリアの `geometry`/`color` が含まれない** (`resolveLocationForCategory` が文字列に変換した結果しか持たない)。地図描画にはエリアの生データ (id/name/geometry/color) が別途必要。
- **`area_id` の解決に食い違いの種がある**: `ExhibitionCardSummary.areaIds` は「直接の `area_id` ∪ 出演ステージの `area_id`」の和集合 (`resolveAreaIds()`, 検索絞り込み用)。一方 requirements.md は明示的に「対象は既存の `student_exhibitions.area_id` → `map_areas` のリレーション」とスコープを絞っている。`category === 'stage'` の企画は `resolveLocationForCategory` 上でも area_id を見ておらず出演ステージ名のみを表示している。つまり **stage カテゴリの企画では `exhibition.area_id` が未設定 (null) であることが構造的にあり得る** — この場合 Req 4.1 により地図セクションは表示されない、で要件上は一貫しているが、「stage カテゴリでは地図が出ない企画が多くなる」という体験は Figma 側の意図と一致するか design フェーズで確認が要る (Research Needed)。
- 直接の `area_id` (stage 由来を含まない) を公開する API が現状ない。`ExhibitionDetail` の拡張 (例: `areaId: number | null` の追加) が新規に必要。

**アイコン (`frontend/src/components/icons.tsx`)**

- `createIcon(testId, path, viewBox)` ファクトリが Material Symbols Sharp (weight 300, outline) の SVG を生成する。`PlaceIcon` は outline のみ。**fill (塗りつぶし) 形状の path データを新たに用意すれば、同じファクトリ関数へ 1 エントリ追加するだけで済む** — ファクトリ自体の変更は不要。path データの入手 (Figma / Material Symbols フォントの fill バリアント) が Research Needed。

**ルーティング / レイアウト**

- `(fullscreen)/map/page.tsx` は Server Component。`(fullscreen)/layout.tsx` は `<div className="min-h-screen min-h-dvh">{children}</div>` のみで Header/Footer を出さない。
- `(site)/layout.tsx` は `<Header />` + `{children}` + `<Footer />`。`(site)/exhibitions/[id]/[category]/page.tsx` も Server Component で、`getExhibitionDetail` の結果を素直に描画するのみ (React state を持たない)。
- **route group 自体が地図コンポーネントに制約を課しているわけではない**。`leaflet.css` の import は `campus-map-view.tsx` という Client Component 内で行われており、`(fullscreen)` 固有の仕組みには依存しない。制約の実体は `CampusMapView` 側の `h-dvh w-full` という**ハードコードされたサイズ指定**であり、これは route group ではなくコンポーネント自身の問題。

### 慣習・制約

- Edge Runtime (`frontend/`): Node.js 専用 API 不可。react-leaflet は `ssr: false` の動的インポートでブラウザ専用として読み込まれており、既存パターン踏襲であれば新たな抵触は生じない。
- Server Component がデータ取得、対話が要る部分のみ Client Component に切り出す既存分離方針。
- CMS 全件取得 + アプリ側絞り込みの既存規約。
- テスト配置は対象ファイルと同階層 `*.test.ts(x)`。`react-leaflet` を `vi.mock` で差し替える既存パターン (`campus-map-view.test.tsx`) がそのまま応用できる。

## 2. 要件フィージビリティ分析

### Requirement-to-Asset Map

| 要件 | 既存資産 | ギャップ |
|---|---|---|
| 1. 企画位置セクション表示・強調・ラベル | `AreaPolygonLayer` / `AreaLabelMarker` / `resolveAreaColor` | ほぼ充足。**Missing**: マップピン (塗り位置アイコン、要件 1.3-1.5)。**Missing**: 該当エリアに収まる初期ビュー算出 (要件 1.8, `polygonBounds` 相当が未実装) |
| 2. 地図操作・縮尺範囲・復帰操作 | `CAMPUS_MAP_CONFIG` (min/maxZoom, bounds) をそのまま流用可 | **Missing**: 初期表示に戻す操作手段 (要件 2.4)。UI 未実装 |
| 3. 構内マップへの遷移 | `buildCampusMapHref` / `?area=<id>` の契約 (`use-map-filters.ts:29` で確認済み) | ほぼ充足。**Constraint**: 地図面のドラッグ/ズームを遷移契機にしない実装 (要件 3.3) — `AreaPolygonLayer` の `onAreaClick` を埋め込み文脈では無効化/未接続にする必要 |
| 4. 所在エリア未定/取得失敗時のフォールバック | `getExhibitionDetail` の `kind: 'error'/'missing'` 判別 / `CampusMapDataResult` のエリア個別エラー表現パターン | **Missing**: `ExhibitionDetail` に直接の `area_id` (stage 由来を含まない) を露出する仕組み。現状は文字列化済み `location` のみ |
| 5. 読み込み中・失敗時のフォールバック、初期表示の非ブロック化 | `CampusMapScreen` の `dynamic(..., {ssr:false, loading:...})` パターン | パターン踏襲で対応可。**Unknown**: セクション占有領域確保の具体寸法 (Figma 参照が必要) |
| 6. 表示幅追従・アクセシビリティ | Tailwind ブレークポイント、`useIsAboveMapBreakpoint`、既存カラートークン | ほぼ充足。**Missing**: SP (390) / PC (1440) の具体レイアウト値は Figma 参照が必要 (Research Needed) |

### Research Needed

1. **単一エリアへのビューポート収め込みアルゴリズム** — Leaflet の `fitBounds()` をそのまま使うか、`polygonCentroid()` に加えて外環のバウンディングボックスを算出する `campus-map-geometry.ts` への追加関数が要るかを design で決める。
2. **マップピンの path データ** — Material Symbols Sharp の fill (weight 300 相当) の `place` アイコン SVG path を Figma または Google Fonts Material Symbols から取得する。`icons.tsx` の `createIcon` ファクトリ自体の変更は不要。
3. **`ExhibitionDetail` への直接 `area_id` 露出方法** — `resolveAreaIds()` (和集合) とは別に、直接の `area_id` のみを返す経路を `exhibitions.ts` に追加するか、`getExhibitionDetail` 内で `map_areas` の該当レコードを直接引き当てる専用関数を新設するかの比較。
4. **stage カテゴリでの地図非表示の扱い** — `category === 'stage'` の企画は `area_id` が未設定であるケースが構造的にあり得る。Figma 側で stage 企画にも地図セクションが定義されているか (2:468 / 2:531 ノード) を design フェーズで実データと突き合わせる。
5. **セクション占有領域の具体寸法** — Req 5.1 (読み込み中も占有領域を確保) を満たす固定高さ/アスペクト比を Figma の PC/SP ノードから採寸する。
6. **`AreaPolygonLayer` のクリック無効化方法** — 埋め込み文脈でポリゴンクリックを「選択解除」等の副作用に繋げない実装 (props 拡張 or 単に no-op ハンドラを渡すだけで足りるかの確認)。

## 3. 実装アプローチ選択肢

### Option A: 既存コンポーネントを拡張する

`CampusMapView` に高さ/初期ビュー用の props (例: `viewportHeightClassName`, `fitBoundsAreaId`) を追加し、企画詳細ページ・構内マップページ双方から共有する。

- ✅ 新規ファイルが少ない。ポリゴン描画・色解決・ズーム制御のロジックを完全に一本化できる
- ✅ `campus-map` 側の挙動変更 (タイル・ポリゴン規則) が両方の画面に自動で伝播する
- ❌ `CampusMapView` が「全画面の構内マップ」と「セクション埋め込み」の 2 つの責務を持ち、条件分岐が増える
- ❌ `campus-map` spec の Boundary Commitments (「地図タイル・ポリゴン描画規則・ズーム範囲定数は campus-map の所有」) との責務境界があいまいになりやすい。変更のたびに両 spec のレビューが必要になる

### Option B: 企画位置セクション専用の新規コンポーネントを作る

`AreaPolygonLayer` / `AreaLabelMarker` / `MapZoomControl` / `CAMPUS_MAP_CONFIG` / `resolveAreaColor` / `parsePolygonGeometry` はそのまま import し、`CampusMapView` 相当の `MapContainer` 定義だけを本 spec 配下 (例: `frontend/src/components/exhibition-location-map/`) に新規作成する。マップピンや「初期表示に戻す」ボタンもここに置く。

- ✅ `campus-map` の Boundary Commitments を壊さない。所有関係が明確 (地図の描画規則は import で従うだけ)
- ✅ 埋め込み用の高さ・初期ビュー・ピン・復帰ボタンをこのコンポーネントだけで完結させられる
- ❌ `MapContainer` の設定 (bounds/zoom/attribution など) が 2 箇所に分散し、`campus-map` 側の定数変更時に本 spec 側も追従が要る (ただし `CAMPUS_MAP_CONFIG` という共有定数を通すため、実体としては定数 import で同期される)
- ❌ ファイル数がやや増える

### Option C: ハイブリッド (`MapContainer` のラッパーだけ切り出す)

`CampusMapView` から `MapContainer` + `TileLayer` の組み立てを `useCampusMapContainerProps()` のような小さな共有フック/関数に抽出し、`CampusMapView` (全画面) と新規の埋め込み用コンポーネントの両方がそれを呼ぶ。

- ✅ 設定値の二重管理を避けつつ、責務は分離できる
- ✅ 将来他の埋め込み用途が増えても再利用できる
- ❌ 抽出の粒度判断が要る (過剰な抽象化にならないよう、現時点で必要な差分 = `className`/初期ビュー算出だけに絞るべき)
- ❌ `campus-map` 側のリファクタを伴うため、本 spec 単独では完結しない (`campus-map` spec 側の合意が要る)

## 4. Effort / Risk

| 項目 | Effort | Risk | 理由 |
|---|---|---|---|
| 地図描画の埋め込み (Option B) | S | Low | 既存コンポーネントの import のみで大半が賄える。新規はコンテナのサイズ指定と初期ビューのみ |
| 地図描画の埋め込み (Option A) | S | Medium | 実装量は Option B と同程度だが、`campus-map` spec との責務境界調整が要る分リスクが上がる |
| 単一エリアへのビューポート収め込み (Req 1.8) | S | Low | 外環座標の min/max を取るだけの純粋関数。`polygonCentroid` と同レベルの複雑度 |
| マップピン新規実装 (Req 1.3-1.5) | S | Low | `AreaLabelMarker` と同じ `divIcon` パターンを踏襲できる。path データの入手のみ外部要因 |
| 初期表示に戻すボタン (Req 2.4) | S | Low | Leaflet の `map.setView()`/`flyTo()` を呼ぶだけの小さな Client Component |
| 遷移リンクとドラッグ/ズームの分離 (Req 3.3) | S | Low | 埋め込み文脈では `onAreaClick` を no-op にするだけで自然に満たせる可能性が高い |
| `ExhibitionDetail` への area_id 露出 (Req 4.1-4.3) | S〜M | Medium | `exhibitions.ts` の既存関数群 (`resolveAreaIds` 等) との整合を取りつつ、和集合と直接参照を混同しない設計が要る。stage カテゴリの扱い次第で影響範囲が変わる |
| 読み込み中/失敗時のフォールバック (Req 5) | S | Low | `CampusMapScreen` の `dynamic(ssr:false, loading:...)` パターンをそのまま踏襲できる |
| フィルアイコン追加 (Req 1.4, 6) | S | Low | `createIcon` ファクトリへ 1 エントリ追加のみ。path データの入手は外部作業 |

## 5. 実装フェーズへの推奨事項

### 優先して決めること

1. **Option A/B/C のどれを取るか** — `campus-map` spec の Boundary Commitments を尊重するなら Option B (専用コンポーネント + 定数/ロジックの import) が最も安全。Option A/C は `campus-map` 側の変更を伴うため、着手前に `campus-map` の Revalidation Triggers を確認し、必要なら `campus-map` spec 側の合意を取る。
2. **`area_id` の扱い** — `resolveAreaIds()` の和集合とは独立した、直接の `area_id` のみを返す経路を `exhibitions.ts` に追加するか検討する。stage カテゴリの企画で地図セクションが表示されないケースが多くなる可能性を Figma と突き合わせて確認する。

### 設計時に踏襲すべきこと

- `MapContainer` の組み立ては `next/dynamic(..., { ssr: false })` を Client Component 内で呼ぶ既存パターンをそのまま使う (Server Component である `page.tsx` 側で `ssr: false` を指定するとビルドが失敗する制約は変わらない)。
- ポリゴンの色・描画規則・ズーム範囲は `campus-map-config.ts` / `campus-map.ts` / `campus-map-geometry.ts` の既存 export をそのまま import し、本 spec 側で再定義しない。
- テストは `campus-map-view.test.tsx` と同じ `vi.mock('react-leaflet', ...)` パターンを踏襲する。
- アイコン追加は `icons.tsx` の `createIcon` ファクトリにそのまま従う (新しい抽象化を導入しない)。

### design フェーズへ持ち越す Research 項目

- 単一エリアへのビューポート収め込みの算出方法 (`fitBounds()` 利用 vs 独自のバウンディングボックス計算)
- マップピンの fill path データの入手元
- `ExhibitionDetail`/`ExhibitionCardSummary` への直接 `area_id` 露出の具体的な API 形状
- stage カテゴリの企画における地図セクション非表示の扱いが Figma の意図と一致するか
- Req 5.1 のセクション占有領域の具体寸法 (Figma PC/SP ノードの採寸)
- 埋め込み文脈での `AreaPolygonLayer` クリック無効化の実装方法 (props 拡張 vs no-op ハンドラ)

## 次のステップ

- `/kiro:spec-design exhibition-location-map` で design フェーズへ進む
