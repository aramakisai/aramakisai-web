# Gap Analysis: campus-map

## 前提の注意

- 本書は実装方針を決定するものではなく、選択肢と材料を提示する。決定は design フェーズで行う。
- 調査時点で `cms/src/collections/student-exhibitions.ts` と `frontend/src/lib/exhibitions.ts` は未コミットの変更を含む。カテゴリ構造が移行途中のため、後述の「要件との食い違い」を design 前に解消する必要がある。

## 1. 現状調査サマリ

### 既存資産 (実測)

**データ取得とドメインロジック (`frontend/src/lib/exhibitions.ts`)**

- `getExhibitionListData(query): Promise<ExhibitionListResult>` — 企画一覧用の取得・結合・絞り込み・ページングを一括で行う。Server Component から直接呼ぶ。
- `resolveAreaIds()` — `student_exhibitions.area_id` と、`performance_slots` → `stages.area_id` を辿った出演エリアの和集合を企画単位の `areaIds` として組み立てる。要件 3-3 が求める集約規則がそのまま実装済み。
- `parseExhibitionQuery(searchParams)` / `buildExhibitionsHref(query)` — `?q=` `?category=` `?area=` `?page=` の解釈と正規化された URL 生成。
- `filterExhibitions(items, query)` / `paginate(items, page, pageSize)` — CMS 側の `where` を使わず、全件取得 (`limit: 0`) 後にメモリ上で絞り込む方式。
- `normalizeText()` — NFKC 正規化 + 小文字化。全角半角・大文字小文字を吸収する。
- `AreaOption { id, name }` — エリアの軽量 DTO。`ExhibitionFilters` に渡している。

**CMS クライアント (`frontend/src/lib/cms.ts`)**

- `cms.findMany('map_areas', { sort: ['sort'], limit: 0, depth: 0 })` の形で呼ぶ。コレクション名から戻り値の型が解決される。
- 戻り値は `{ ok: true, value } | { ok: false, error }` の判別可能ユニオン。例外を投げない。
- 認証ヘッダは付けない。公開 API のみを叩く前提。

**再利用可能なコンポーネント**

- `ExhibitionCard({ exhibition })` — Server Component。カード全体が詳細ページへの `Link`。
- `ExhibitionFilters({ query, areas })` — Client Component。キーワード入力 (300ms デバウンス) とカテゴリ/エリアのトグルチップ、`router.replace()` での URL 書き換えを持つ。要件 4 の検索・絞り込みの挙動がほぼそのまま入っている。
- `icons.tsx` — `PlaceIcon` `SearchIcon` `ChevronLeftIcon` `ChevronRightIcon` `ImageIcon` 他。地図の拡大/縮小に使うアイコンはない。

**CMS 側**

- `map_areas`: `name` (text, required) / `geometry` (json, required, GeoJSON Polygon) / `sort` (number)。`defaultSort: 'sort'`。
- access は各コレクションに書かず、`cms/src/collections/index.ts` の `withAccess()` が `accessFor(slug)` を機械的に付与する。
- `policy.ts` の `PUBLISHED_FILTER` に `map_areas` と `stages` のエントリがないため、**未認証でも全件 READ 可**。`student_exhibitions` のみ `status === 'published'` で絞られる。要件 3-6 は CMS 側で自動的に満たされる。
- `stages.area_id` → `map_areas` の片方向参照。企画とステージは `performance_slots` (`stage_id` / `time_slot_id` / `exhibition_id`) を介した 2 ホップ。
- `select` フィールドの既存例は `sponsors.type` (required + defaultValue) と `sponsors.tier` (optional)。定数配列から `.map(({name, label}) => ({label, value: name}))` で options を生成する書き方も `student_exhibitions.categories` にある。
- マイグレーションは `YYYYMMDD_HHMMSS_<説明>.ts` + 同名 `.json`。`index.ts` の配列末尾に 1 エントリ追記する。enum カラム追加は `CREATE TYPE ... AS ENUM(...)` → カラム追加、`down` は逆順。

### 慣習・制約

- **Edge Runtime**: `frontend/` は `@opennextjs/cloudflare` 経由の Cloudflare Workers。Node.js 専用 API 不可。
- **データ取得の規約**: CMS の `where` でフィルタせず全件取得してアプリ側で絞る。エリア数・企画数が小さい前提。
- **Server / Client の分離**: `page.tsx` (Server) がデータ取得し、対話が要る部分だけ Client Component に切り出す。
- **テスト配置**: 対象ファイルと同階層に `*.test.ts(x)`。CMS のフィールド定義検証は DB 不要の `*.test.ts`、ロール別 access は `access.int.test.ts`。
- **型の手書き禁止**: `payload generate:types` の出力を `frontend/src/cms-types.ts` に取り込む。

## 2. 要件フィージビリティ分析

### Requirement-to-Asset Map

| 要件 | 既存資産 | ギャップ |
|---|---|---|
| 1. 全画面地図表示 | なし | **Missing**: 地図ライブラリ未導入。**Constraint**: OSM タイルサーバの利用ポリシー (後述)。**Missing**: ヘッダー/フッターを出さないレイアウト機構 |
| 2. ポリゴン描画と選択 | `map_areas.geometry` / `cms.findMany` | **Missing**: GeoJSON 描画とクリック処理。**Unknown**: `geometry` が `json` 型で型が緩く、Polygon としての妥当性を保証しない |
| 3. 選択エリアの出展物リスト | `resolveAreaIds` / `filterExhibitions` / `ExhibitionCard` | ほぼ充足。**Missing**: 0 件時の文言とエリア選択前の案内 |
| 4. 検索とカテゴリ絞り込み | `ExhibitionFilters` / `parseExhibitionQuery` / `normalizeText` | ほぼ充足 |
| 5. レスポンシブ配置 | Tailwind のブレークポイント | **Missing**: ボトムシート (ドラッグ、高さ可変)。**Unknown**: ブレークポイントの具体値を要件に書くか design に委ねるか |
| 6. 表示色の CMS 管理 | `sponsors.type` の select 実装例 / マイグレーション手順 | **Missing**: `map_areas.color` フィールドとマイグレーション。破壊的変更ではないため `cms-schema-check.yml` は通る見込み |
| 7. 詳細ページへの導線 | `ExhibitionCard` が `Link` を内包 | **Constraint**: 詳細ページの URL が `/exhibitions/[id]/[category]` の 2 階層。エリア由来のリストからどの `category` を指すか決める必要がある |
| 8. 取得失敗時の振る舞い | `CmsResult` の判別可能ユニオン | 部分的に充足。**Missing**: 地図タイル読み込み失敗の検知と表示 |

### カテゴリ構造 (requirements.md 反映済み)

コレクション定義は次の構造になっている。requirements.md の Requirement 3・4・7 はこれに合わせて修正済み。

- `student_exhibitions.categories`: `select` + `hasMany: true` + `required: true`。値は `stage` / `exhibit` / `vendor` / `other`。
- カテゴリごとに `stage` / `exhibit` / `vendor` / `other` の 4 つの `group` フィールドがあり、それぞれ `name` / `description` / `images` を持つ。`admin.condition` で該当カテゴリ選択時のみ表示される。

つまり 1 企画が複数カテゴリを持ち、カテゴリごとに別の企画名・紹介文・画像を持つ。FE 側の `ExhibitionCardSummary` は `category` 単数を持ち、1 企画が複数カードに展開される設計になっている。

この構造は直前のマイグレーション (`20260918_015706_student_exhibitions_multi_category_content`) で入ったばかりで、`exhibition-pages` spec の作業が未コミットの状態にある。

所在地の表記は `resolveLocationForCategory()` (`frontend/src/lib/exhibitions.ts:318`) が決めており、ステージカテゴリでは出演ステージ名を「、」で連結し、それ以外ではエリア名と `booth_label` を組み合わせる。`booth_number` は表示に使っていない。

### Research Needed

1. **OSM タイルサーバの利用可否** (最重要)
   OSM Foundation の Tile Usage Policy は `tile.openstreetmap.org` について次を定めている。
   - 必須: 正しい URL、目立つ位置への attribution (`© OpenStreetMap contributors`)、アプリを識別できる User-Agent、有効な HTTP Referer、HTTP キャッシュヘッダの尊重。
   - 禁止: 一括ダウンロード / プリフェッチ、`no-cache` ヘッダの既定送信、Referer を妨げる Referrer-Policy、HTTP 版 URL、ライブラリ既定の User-Agent。
   - 「商用サービスや寄付を募るサービスは、アクセスがいつ取り消されてもおかしくないことを特に認識すべき」とあり、要件を満たせない場合は代替の OSM 由来サービスか自前ホスティングを使うよう明記されている。SLA はない。

   さらに「`tile.openstreetmap.org` でのオフライン利用は許可されない」と明記されている。後続の `pwa-offline` spec でオフライン対応を行う方針が決まったため、**公式タイルサーバの直接参照は選択肢から外れ、会場周辺のタイルを事前生成して自前配信する方針で確定した** (requirements.md 1-3)。残る論点は配信形式であり、個別 PNG タイルを静的アセット / R2 に置くか、PMTiles のような単一ファイル形式にするかを design で決める。attribution 文言はポリシー上「© OpenStreetMap contributors」で確定している。

   会場周辺 800m 四方をズーム 15〜19 で用意した場合、タイルは 327 枚・約 4.8MB。ズーム上限を 18 に下げれば 102 枚・約 1.5MB (z19 だけで全体の約 7 割を占める)。ズーム上限の決定がそのまま配信容量とオフラインキャッシュ容量を決める。

2. **地図ライブラリの選定**
   - MapLibre GL JS: 公式ドキュメントに「WebGL を使ってブラウザで描画する TypeScript ライブラリ」と明記。Next.js 向けの例は `'use client'` 付きで示されている。`GeoJSONSource` クラスと「Add a GeoJSON polygon」「Show polygon information on click」のサンプルが存在する。WebGL 必須のため、古い端末での動作確認が要る。
   - Leaflet: 公式リファレンスに SSR やブラウザ専用の明記はないが、`L.map(id, options)` が DOM 要素を必須引数に取る設計。Vector Layers に `Polygon`、Other Layers に `GeoJSON`、`Evented.on(type, fn)` が存在する。
   - **react-leaflet の React 19 対応は未確認。** GitHub README にバージョン情報がなく、`react-leaflet.js.org` の CHANGELOG を別途確認する必要がある。ラッパーを使わず Leaflet を直接叩く選択肢もある。
   - バンドルサイズの実測値は両者とも公式ドキュメントに記載がなく、未確認。

3. **ヘッダー/フッターを出さないレイアウトの実現方法**
   `app/layout.tsx` が `<Header />` → `{children}` → `<Footer />` を無条件にレンダリングしており、route group は 1 つも存在しない。実現方法は後述の Option で扱う。

4. **`geometry` のランタイム検証**
   Payload の `json` 型が生成する型は `{[k:string]: unknown} | unknown[] | string | number | boolean | null` で、GeoJSON Polygon であることを型が保証しない。要件 2-7 (不正な geometry の除外) を満たすには型ガードかスキーマ検証が要る。`zod` は devDependencies に既にある。

## 3. 実装アプローチ選択肢

地図描画とレイアウトの 2 軸で選択肢が分かれる。

### 3.1 地図描画

#### Option A: 地図ライブラリを導入する (MapLibre GL JS または Leaflet)

タイルのパン・ズーム・GeoJSON のクリック判定をライブラリに任せる。地図本体を Client Component として新規作成し、`page.tsx` (Server) がエリアと企画を取得して props で渡す。

- ✅ 要件 1-5、1-6、2-4 の地図操作が実装済みのものとして手に入る
- ✅ GeoJSON Polygon の描画とクリック判定が標準 API で書ける
- ❌ 依存が 1 つ増える。React 19 との互換 (特に react-leaflet) を検証する必要がある
- ❌ Client Component の JS が増える。当日のモバイル回線での初期表示を測る必要がある

#### Option B: タイル画像と SVG を自前で組む

タイルを `<img>` で敷き、GeoJSON Polygon を投影計算して SVG の `<path>` に変換し、クリックは SVG のイベントで取る。

- ✅ 依存ゼロ。バンドルが最小
- ✅ ポリゴンの見た目 (デザイントークンの色、選択状態) を完全に制御できる
- ❌ パン・ズーム・慣性・ピンチ操作を自前で実装することになる。要件 1-5、1-6 のコストが跳ね上がる
- ❌ 投影計算 (Web メルカトル) を自前で持つ

#### Option C: ズームとパンを持たない固定ビューにする

会場全体が収まる範囲で地図を固定し、ポリゴンだけを操作対象にする。タイルは静止画として事前生成して自前配信する。

- ✅ OSM タイルサーバへのランタイム依存が消える (Research Needed 1 が解決する)
- ✅ 実装が最も軽い。SVG オーバーレイだけで済む
- ❌ 要件 1-5、1-6 を満たさない。要件の変更が前提になる
- ❌ 地図を拡大して細部を見る体験が失われる

### 3.2 ヘッダー/フッターの除去 (要件 1-3)

#### Option A: route group でレイアウトを分割する

`app/(site)/` と `app/(map)/` に分け、`app/layout.tsx` からは `<Header />` / `<Footer />` を外して各グループの `layout.tsx` に移す。

- ✅ Next.js の標準機能。「このページはシェルを持たない」がディレクトリ構造で表現される
- ✅ 以後シェルなしのページ (`digital-signage` が該当しうる) を足すのが容易
- ❌ 既存の全ページを `(site)/` 配下へ移動する必要がある。差分が大きく、他の進行中 spec とコンフリクトしやすい

#### Option B: Header / Footer 側でパスを見て `null` を返す

`Header` は既に Client Component で `usePathname()` を使っているため、条件を 1 つ足すだけで済む。`Footer` は Server Component のため、Client 化するか別の手段が要る。

- ✅ 差分が小さい。既存ページを動かさない
- ❌ 「どのページがシェルを持たないか」がコンポーネント内部の条件に埋もれる
- ❌ Footer の扱いが非対称になる

#### Option C: 全画面地図をシェルの内側に収める

ヘッダー/フッターを残したまま、地図をビューポートの残り高さいっぱいに広げる。

- ✅ レイアウトに手を入れない。最小の差分
- ❌ 要件 1-3 を満たさない。Figma のデザインとも一致しない

## 4. Effort / Risk

| 項目 | Effort | Risk | 理由 |
|---|---|---|---|
| 地図描画 (3.1 Option A) | M | Medium | ライブラリの選定と React 19 互換の検証が要るが、GeoJSON 描画自体は標準 API の範囲 |
| 地図描画 (3.1 Option B) | L | High | パン・ズーム・投影を自前で持つ。当日の操作感が読めない |
| 地図描画 (3.1 Option C) | S | Low | SVG オーバーレイのみ。ただし要件の変更が前提 |
| タイルの事前生成と自前配信 | M | Medium | 自前配信で方針確定。生成スクリプトと配信形式 (個別タイル / 単一ファイル) の決定が残る |
| レイアウト分割 (3.2 Option A) | M | Medium | 既存全ページの移動を伴い、他 spec とコンフリクトしうる |
| レイアウト分割 (3.2 Option B) | S | Low | Header は 1 行の条件追加。Footer の扱いだけ設計が要る |
| リストと検索 (Req 3, 4) | S | Low | `resolveAreaIds` / `filterExhibitions` / `ExhibitionFilters` がそのまま使える |
| `map_areas.color` 追加 (Req 6) | S | Low | 既存の select 実装とマイグレーション手順に倣う。加算のみで破壊的変更でない |
| ボトムシート (Req 5-2, 5-3) | M | Medium | ドラッグでの高さ変更を実装するか、固定 2 段階に割り切るかで変わる |
| `geometry` の検証 (Req 2-7) | S | Low | `zod` が既にある。スキーマを 1 つ書けば済む |

## 5. 実装フェーズへの推奨事項

### 優先して決めること

1. **タイルの配信形式とズーム上限** — 自前配信は確定済み。残るのは個別 PNG タイルか単一ファイル形式かの選択と、ズーム上限の決定。後者は配信容量と `pwa-offline` のキャッシュ容量を直接決めるため、両 spec を通して一度だけ決める。
2. **地図ライブラリ** — react-leaflet の React 19 対応を確認したうえで、MapLibre / Leaflet / ラッパーなしを比較する。配信形式に単一ファイルを選ぶ場合、ライブラリ側の対応が選択を縛る。

### 設計時に踏襲すべきこと

- データ取得は `page.tsx` (Server Component) で行い、地図とシートだけを Client Component に切り出す。既存の企画一覧と同じ形。
- 絞り込みは CMS の `where` ではなくアプリ側で行う既存規約に合わせる。`filterExhibitions` を再利用できるなら新規実装しない。
- URL クエリは `parseExhibitionQuery` / `buildExhibitionsHref` の形式を共有する。企画一覧ページと構内マップの間で絞り込み状態を引き継げる利点がある。
- `map_areas.color` は `sponsors.type` に倣い、定数配列から options を生成する。値はデザイントークン名そのもの。
- CMS のフィールド追加後は `payload generate:types` を実行し、`frontend/src/cms-types.ts` の同期をコミットに含める。

### design フェーズへ持ち越す Research 項目

- タイルの配信形式 (個別 PNG / PMTiles 等の単一ファイル) と、Cloudflare Workers での配信可否
- タイル事前生成の手順をどこに置くか (ビルド時 / 手動スクリプト / リポジトリへの資産コミット)
- react-leaflet の React 19 対応状況 (`react-leaflet.js.org` の CHANGELOG)
- MapLibre GL JS / Leaflet のバンドルサイズ実測
- WebGL 非対応端末へのフォールバックが要るか
- ボトムシートをドラッグ可能にするか、固定高さの 2 状態に割り切るか

## 次のステップ

- `/kiro:spec-design campus-map` で design フェーズへ進む
