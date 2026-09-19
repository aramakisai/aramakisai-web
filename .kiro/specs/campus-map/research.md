# Research & Design Decisions: campus-map

## Summary

- **Feature**: `campus-map`
- **Discovery Scope**: Extension (既存の企画一覧の資産を大きく流用する新規ページ。ただし地図ライブラリの新規導入とタイルの自前生成・自前配信という未経験の要素を含むため、該当箇所のみ full discovery 相当の調査を行った)
- **Key Findings**:
  - `react-leaflet` v5.0.0 は peerDependencies が `react: ^19.0.0` を要求する。プロジェクトの React 19 とちょうど一致し、v4 系 (React 18 要求) は使えない。
  - OpenStreetMap の Tile Usage Policy 第 4 節は、閲覧中以外のタイルの先回り取得 (bulk downloading) を無条件に禁止している。回数・枚数・取得間隔による例外条項は存在しない。したがって公式タイルサーバからの事前取得は選択肢にならず、タイルは OSM データから自前でレンダリングする。
  - 主要なホスト型タイル配信サービスのうち、事前取得と自サイトからの再配信の双方を許諾するものは存在しなかった。
  - ズーム範囲は想定最大ビューポートを余白込みで覆う z17 を下限、OSM Carto が想定する最大縮尺の z19 を上限とする。1323 枚・約 7.7MB に収まり、この規模では PMTiles のような単一アーカイブ形式が解決する問題 (大量タイルの管理、Range リクエストによる部分取得) が発生しない。

## Research Log

### 地図ライブラリの選定

- **Context**: `frontend/package.json` に地図ライブラリは存在せず、新規導入が必要。要件 2 が GeoJSON Polygon の描画とクリック取得を求める。React 19 との互換性が最大の懸念だった。
- **Sources Consulted**:
  - https://react-leaflet.js.org/docs/start-installation/
  - https://react-leaflet.js.org/docs/start-setup/
  - https://react-leaflet.js.org/docs/api-components/
  - https://github.com/PaulLeCam/react-leaflet/blob/master/CHANGELOG.md
  - https://maplibre.org/maplibre-gl-js/docs/
  - https://leafletjs.com/reference.html
  - `npm view <pkg> version dist.unpackedSize peerDependencies` によるローカル確認
- **Findings**:
  - `react-leaflet` の現行安定版は v5.0.0 (2024-12-14)。CHANGELOG に "React v19 is now required as peer dependency." と明記。`npm view` でも `peerDependencies = { leaflet: '^1.9.0', react: '^19.0.0', 'react-dom': '^19.0.0' }` を確認。
  - install ページに "React Leaflet does not replace Leaflet, it only provides bindings between React and Leaflet." とあり、Leaflet 本体の Quick Start に従ったセットアップが前提。TypeScript 利用時は Leaflet の型定義が別途必要で、react-leaflet 自身の devDependencies も `@types/leaflet ^1.9.15` を参照している。
  - setup ページのトラブルシュートに "Make sure Leaflet's CSS is loaded" と "Make sure your map container has a defined height" が挙がっている。いずれも省くと地図が正しく描画されない。
  - `<GeoJSON>` の props 表で `data` は mutable ではなく、"By default these props should be treated as immutable, only the props explicitely documented as mutable in this page will affect the Leaflet element when changed." と明記されている。`style` は mutable。
  - `leaflet` は 1.9.4、`dist.unpackedSize` は 3,739,487 バイト。`maplibre-gl` は 6.10.0、`dist.unpackedSize` は 20,570,423 バイト。unpackedSize は配布物全体でありバンドルサイズそのものではないが、桁の違いは参考になる。
  - MapLibre GL JS は公式ドキュメントに "uses WebGL to render interactive maps from vector tiles in a browser" と明記。WebGL 必須。
  - Leaflet の GridLayer において `maxNativeZoom` は "the tiles on all zoom levels higher than `maxNativeZoom` will be loaded from `maxNativeZoom` level and auto-scaled" と定義されている。`maxZoom` と同値にした場合、それより上のズーム自体が存在しないため効果を持たない。
  - Leaflet の Map State Options において `maxBounds` は "bouncing the user back if the user tries to pan outside the view" であり、`maxBoundsViscosity` の既定値 `0.0` では境界外へのドラッグ自体は可能。タイル要求を範囲内に限定するオプションは GridLayer の `bounds` ("If set, tiles will only be loaded inside the set LatLngBounds")。
- **Implications**: ラスタタイルを自前配信する構成では MapLibre のベクタタイル描画能力が活きない。WebGL 依存は来場者の端末が多様であることを考えると不利に働く。Leaflet + react-leaflet v5 を選ぶ。CSS・型定義・コンテナ高さの 3 点は設計に明記する。範囲外タイルの抑止には `maxBounds` ではなく TileLayer の `bounds` を使う。

### OpenStreetMap タイルの利用条件

- **Context**: 当日はキャンパスにアクセスが集中する。加えて後続の `pwa-offline` でオフライン対応を行う方針が決まった。当初は公式タイルサーバから会場周辺のタイルを一度だけ取得して自前配信する計画だったため、その可否を確認する必要があった。
- **Sources Consulted**: https://operations.osmfoundation.org/policies/tiles/ , https://wiki.openstreetmap.org/wiki/Standard_tile_layer , https://wiki.osmfoundation.org/wiki/Licence/Attribution_Guidelines
- **Findings**:
  - 第 4 節の見出しは "Prohibited: bulk downloading (“scraping”) and offline use"。定義は **"Bulk downloading is any pre-emptive fetching of tiles other than those a user is actively viewing."**
  - 禁止例として次が明記されている。
    - "“Pre-seeding” large areas or multiple zoom levels in advance."
    - "Building tile archives (e.g. `.zip`, `.mbtiles`) for later distribution."
    - "Automated scans across wide bounding boxes, especially at high zoom (z≥14)."
    - "Headless bots that pan/zoom the map to force rendering."
  - Quick summary の "You must not:" 筆頭が "Bulk download (“scrape”) tiles or offer prefetch features."
  - **回数・枚数・取得間隔に基づく例外条項はページ全文に存在しない。** ページ中の数値は、キャッシュの最低期間 ("cache each tile for at least 7 days")、高ズームの警告 ("especially at high zoom (z≥14)") の 2 種のみで、いずれも許容条件ではない。
  - 許可される利用は "Normal interactive viewing by a human where the client requests only the tiles needed for the current viewport (with modest, short-range look-ahead typical of browsers)" に限られる。
  - 代替の案内: "If you require offline maps, use **self-hosted** tiles or a **provider that explicitly allows offline/prefetching**." 第 8 節が "Run your own tiles — Up-to-date guidance: http://switch2osm.org/" を示す。
  - Enforcement: "Prefetch/offline patterns place disproportionate load on community-funded servers and will be blocked without notice." "Repeated violations may lead to longer-term or network-level blocks."
  - User-Agent の要求 (第 3.1 節・第 3.4 節) は識別のための義務であり、第 4 節の禁止を解除するものではない。
  - attribution は "Show OpenStreetMap licence attribution clearly on the map (typically bottom-right)." "Typically: © OpenStreetMap contributors" (リンク先 https://www.openstreetmap.org/copyright)。"Do not hide attribution beneath UI, behind toggles, or off-screen."
  - 標準タイル (OpenStreetMap Carto) のタイル画像そのもののライセンスは wiki のインフォボックスに "Tiles license: ODbL 1.0" と明記。スタイルシートは CC0 1.0。wiki ページ下部の CC BY-SA 2.0 は wiki 本文のライセンスであり、タイル画像のライセンスではない。
- **Implications**: 公式タイルサーバからの事前取得は、枚数や間隔にかかわらず禁止行為に該当する。実行時参照も SLA がないため採用できない。タイルは OSM データから自前でレンダリングする。attribution は `© OpenStreetMap contributors` の文言と copyright ページへのリンクを要件として固定する (要件 1.5)。

### ホスト型タイル配信サービスの規約

- **Context**: OSM 公式が案内する代替のうち "a provider that explicitly allows offline/prefetching" に該当するものがあれば、自前レンダリングより工数が小さい。
- **Sources Consulted**: 各社の利用規約・価格ページ (Thunderforest / Stadia Maps / MapTiler / Geoapify / Carto / Jawg / Protomaps / OpenFreeMap)、https://wiki.openstreetmap.org/wiki/Raster_tile_providers
- **Findings**:
  - **Thunderforest**: 事前取得は "Absolutely no bulk-downloading scraping, pre-downloading, pre-caching or anything similar without an appropriate plan." で、Small Business プラン ($255/月) 以上でのみ許可。ただし再配信は "Caching proxies or other redistribution methods are not permitted." とプランを問わず禁止。
  - **Stadia Maps**: bulk downloading の例外は "caching small amounts of data for offline use in a mobile application, not to exceed 100MB cached at a time per device" に限定。Web サイトからの再配信は例外の対象外。無料枠は商用利用不可。
  - **MapTiler**: "it is prohibited to batch or excessive bulk download of map tiles" (Cloud Terms 6.3)、"It is prohibited to store, save, and/or redistribute any map content from a server-side cache or temporary storage" (7.2)。双方とも明示的に禁止。
  - **Carto**: "downloading or extracting map content in bulk"、"proxying or caching the content on the server side" をいずれも禁止。端末側キャッシュも 30 日超は不可。
  - **Jawg**: 事前取得の明文規定はないが、Section 5.3(vi) がサービスに係る権利の譲渡的利用を広く禁じており再配信は不可。無料プランは非商用限定。
  - **Geoapify**: 事前取得・再配信・オフラインのいずれも規約に記述がない。記述がないことは許可を意味しない。
  - **Protomaps**: タイル配信 API ではなく、OSM 由来のベクタタイルを PMTiles アーカイブとして配布するモデル。"URLs may change and hotlinking to these downloads are discouraged. Instead, you should copy the tileset to your own Cloud Storage." と自前ホストを公式に案内。制約は ODbL / CC0 / BSD-3 の範囲のみ。ただしベクタのみでラスタ PNG は提供しない。
  - **OpenFreeMap**: 同じく自前ホスト前提の OSS スタック。ベクタのみ (ラスタパスは 403)。
- **Implications**: 「タイルを事前に取得して自サイトから配信する」という形が、ホスト型 API の規約と原理的に噛み合わない。いずれの社も自社 API への都度アクセスを前提としており、成果物の再配信を許す条項がない。Protomaps / OpenFreeMap は実質的に自前ホストであり、自前レンダリングの一形態として評価する。

### タイルの生成手段

- **Context**: OSM データから自前でタイルを生成する経路として、ラスタを焼く経路とベクタタイルをクライアントで描画する経路がある。現行の Leaflet 設計への影響が大きく異なる。
- **Sources Consulted**: http://switch2osm.org/ , https://github.com/Overv/openstreetmap-tile-server , https://docs.protomaps.com/basemaps/downloads , https://github.com/onthegomap/planetiler , Cloudflare Workers static assets のドキュメント
- **Findings**:
  - 経路 A (ラスタを焼く): switch2osm が案内する `Overv/openstreetmap-tile-server` の Docker イメージは、openstreetmap-carto のスタイルと日本語を含むフォントを同梱しており、ホスト側への追加インストールを必要としない。公式 guide に小さい抽出でも約 30GB のディスクが必要と明記されている。範囲を変える場合は PostGIS へのインポートからやり直す。
  - 経路 B (ベクタ + MapLibre): Protomaps の日次ビルドは z15 までしか収録しておらず、z17〜19 はクライアント側の overzoom で描画される。planetiler で自前ビルドする場合、都市・国単位なら数分で完了する。
  - 経路 B の配信: PMTiles は HTTP Range Requests を前提とするが、Cloudflare の静的アセット配信が Range に対応するかは公式ドキュメントに記載がない。対応しない場合、R2 と PMTiles 公式の Worker 実装を別途用意する必要がある。
  - GitHub Actions の `ubuntu-latest` ランナーは `/mnt` に数十 GB の空き容量を持ち、経路 A の 30GB を収容できる。ランナーは実行ごとに破棄される。
  - 成果物のライセンスはいずれも OSM データ由来の ODbL であり、`© OpenStreetMap contributors` の表示義務は変わらない。openstreetmap-carto のスタイルは CC0。
- **Implications**: 経路 B は Leaflet を MapLibre へ全面的に置き換えたうえで、z19 の描画に z15 のデータを引き伸ばすことになる。要件 1.9 が禁じた「タイルの引き伸ばし表示」を、データの側で行うことになり目的と矛盾する。経路 A を採る。実行場所は手元ではなく GitHub Actions とし、30GB のディスクと Docker の後始末をランナーに任せる。

### タイル枚数と容量の見積もり

- **Context**: 自前配信する以上、配信対象の範囲とズーム幅を確定する必要がある。`pwa-offline` のキャッシュ容量にも直結する。
- **Sources Consulted**: 想定最大ビューポートを覆うタイル座標範囲の算出。OSM 公式タイルのファイルサイズ実測 (`scratchpad/tiles/`)
- **Findings**:
  - 当初は PC ビューポート 1440x900 を「ちょうど覆う」範囲 (z17 で 7×5 = 35 枚 = 1792×1280px) を基準にしていたが、これでは論理幅 1792px を超える画面で地図の外周にタイルの抜けが生じる。1920x1080 は一般的なデスクトップ解像度であり、`digital-signage` が本ページを流用する場合はさらに大きくなりうる。
  - 基準を「2304×1792px を覆う」に改め、z17 で 9×7 = 63 枚とする。1920x1080 に対して左右・上下に 1 タイル分以上の余白を持つ。
  - z18 を上限にすると建物単位までしか判別できずブースを指せない。模擬店の位置を指すには z19 が要る。OSM Carto が想定する最大縮尺も z19 であり、それ以上は引き伸ばし表示になるため採用しない。
  - z16 以下まで下限を下げても周辺市街地が入るだけで会場案内としての情報は増えない。下限は z17 に決まる。
  - z17 の範囲が覆う地理範囲を z18・z19 でも同じだけ覆う必要があるため、タイル数は z18 が z17 の 4 倍、z19 が 16 倍になる。
  - ファイルサイズは OSM 公式タイルの実測平均 (z17 約 11.5KB/枚、z18 約 8.1KB/枚、z19 約 5.0KB/枚) を用いた推定。自前レンダリングでも同じ openstreetmap-carto スタイルを使うため同程度と見込むが、実際の値は生成後に確定する。

  | ズーム | 枚数 (z17 比) | 推定平均サイズ/枚 | 概算容量 |
  |---|---|---|---|
  | z17 | 63 (基準) | 約 11.5KB | 約 0.7MB |
  | z18 | 252 (4 倍) | 約 8.1KB | 約 2.0MB |
  | z19 | 1008 (16 倍) | 約 5.0KB | 約 5.0MB |
  | 合計 | 1323 | — | 約 7.7MB |

- **Implications**: ズーム範囲を z17 (下限) 〜z19 (上限) に決定する。1323 枚・約 7.7MB はリポジトリへ資産としてコミットしても無理がない規模である。生成後に実測し、推定と大きく乖離する場合は範囲を見直す。

### タイル配信形式 (個別 PNG か PMTiles か)

- **Context**: 自前配信の実現方法として、個別 PNG をそのまま置く方法と、PMTiles のような単一アーカイブ形式が候補になった。
- **Sources Consulted**:
  - https://docs.protomaps.com/pmtiles/
  - https://docs.protomaps.com/pmtiles/cloud-storage
  - https://docs.protomaps.com/deploy/cloudflare
  - https://developers.cloudflare.com/workers/platform/limits/
  - https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- **Findings**:
  - PMTiles は "a single-file archive format for pyramids of tiled data"。HTTP Range Requests で必要なタイルだけ取得する。配信には Range のサポートが必須で、別ドメイン配信なら CORS 設定も必要。
  - Cloudflare R2 について "Cloudflare R2 is known to have higher latency (500ms or higher) than other Cloud Storage products" と明記されている。
  - Cloudflare Workers の static assets はファイル数上限が Free 20,000 / Paid 100,000、個別ファイルサイズ上限が 25MiB。1323 枚は余裕に収まる。
  - static assets へのリクエストは "free and unlimited" だが、存在しないパスは asset として解決されず Worker スクリプトに回り、Workers の課金対象になる。
- **Implications**: PMTiles が解決するのは「タイルが多すぎて個別ファイルとして扱えない」問題である。本件は 1323 枚であり、その問題が存在しない。個別 PNG を `frontend/public/` に置けば OpenNext がそのまま静的アセットとして配信し、Cloudflare の CDN に乗る。`pwa-offline` から見ても、個別 PNG は Cache API の `addAll()` にそのまま渡せる。ただし範囲外のタイル要求は 404 として Worker に回るため、クライアント側で要求そのものを発生させない設定 (TileLayer の `bounds`) が前提になる。

### 既存フロントエンド資産の再利用範囲

- **Context**: 要件 3・4 が企画一覧ページと同じ絞り込みを求める。二重実装を避けたい。
- **Sources Consulted**: `frontend/src/lib/exhibitions.ts`, `frontend/src/app/exhibitions/page.tsx`, `frontend/src/components/exhibition-filters.tsx`, `frontend/src/lib/cms.ts`
- **Findings**:
  - `resolveAreaIds()` が `student_exhibitions.area_id` と `performance_slots` → `stages.area_id` の和集合を企画単位で算出しており、要件 3.3 の集約規則と完全に一致する。ただし private。
  - `filterExhibitions(items, query)` がキーワード・カテゴリ・エリアの 3 条件を扱う。`normalizeText()` は NFKC 正規化 + 小文字化で、要件 4.4 を満たす。こちらは export 済み。ただし引数の `ExhibitionQuery` は `areaIds` と `page` を必須で持つため、マップ側のクエリ型からの変換が要る。
  - `parseExhibitionQuery` は `?area=1,2` と `?area=1&area=2` の双方を受け付け、`sortAreaIds()` で**昇順にソートしてから**返す。`buildExhibitionsHref` は `area=1,2` の形式で出力し、パスに `/exhibitions` をハードコードしている。いずれも export 済み。
  - `getExhibitionListData(query)` は `student_exhibitions` を `where: { status: { equals: 'published' } }` と `sort: ['id']` 付きで取得し、結合・絞り込み・ページングを一括で行う。`PAGE_SIZE = 24` 件ごとのページングを内包しており、1 エリアに 25 件以上ある場合に全件を返せない。取得失敗も単一の例外として投げる。
  - `fetchJoinSources()` は `performance_slots` / `stages` / **`map_areas`** の 3 本を `Promise.all` で取得する。`student_exhibitions` 本体はここに含まれず、`getExhibitionListData` 側で別に取得されている。
  - `buildJoinContext()` が `areasById` / `stagesById` / `slotsByExhibitionId` を構築し、`resolveLocationForCategory()` が `areasById` を引いて所在地文字列を作る。`toCards()` は企画 1 件から選択済みカテゴリ分のカード配列を作る。`resolveAreaIds` と `resolveLocationForCategory` はいずれも `toCard` からのみ呼ばれ、`toCard` は `toCards` からのみ呼ばれる。
  - CMS 取得は全件取得 (`limit: 0`) 後のメモリ内絞り込みが既存規約。`cms.ts` の `request()` は `fetch` にキャッシュオプションを一切指定していない。Next.js 15 の既定は非キャッシュであり、ページを開くたびに CMS へ実際のリクエストが飛ぶ。
- **Implications**:
  - `filterExhibitions` / `parseExhibitionQuery` / `buildExhibitionsHref` / `normalizeText` は export 済みでそのまま再利用する。
  - 追加で export が必要なのは `buildJoinContext` / `toCards` の 2 つ。`resolveAreaIds` と `resolveLocationForCategory` は `toCards` の内部でのみ使われるため露出させない。
  - `fetchJoinSources` はそのまま使えない。`map_areas` を内包しているため、本 spec が求める「エリア取得の失敗と出展物取得の失敗を独立した結果として扱う」が成立せず、かつポリゴン描画用と所在地解決用で `map_areas` を二重に取得することになる。`map_areas` を 1 回だけ取得し、その結果をポリゴン描画と `buildJoinContext` の双方に渡す形を本 spec 側で組む。
  - `student_exhibitions` 本体の取得も本 spec 側で行う。`where: { status: { equals: 'published' } }` と `sort: ['id']` は `getExhibitionListData` と同じ条件を用いる (要件 3.6 のカード順の前提になる)。
  - `?area=` が昇順ソート済みで返るため、「先頭の値」は URL 上の出現順ではなく最小の ID になる。要件 9.5 をその意味で確定させた。

### CMS のアクセス制御とフィールド追加手順

- **Context**: 要件 3.7 (非公開の除外)、要件 6 (表示色フィールド)、要件 2.8 (不正な geometry の保存拒否) の実現方法を確認する必要があった。
- **Sources Consulted**: `cms/src/access/policy.ts`, `cms/src/collections/index.ts`, `cms/src/collections/sponsors.ts`, `cms/src/collections/map-areas.ts`, `cms/src/migrations/`, https://www.postgresql.org/docs/current/datatype-enum.html
- **Findings**:
  - `PUBLISHED_FILTER` に `map_areas` と `stages` のエントリがなく、未認証でも全件 READ 可能。`student_exhibitions` のみ `status === 'published'` で絞られる。
  - access は各コレクション定義には書かず、`collections/index.ts` の `withAccess()` が `accessFor(slug)` を機械的に付与する。
  - `select` フィールドの既存例は `sponsors.type` (required + defaultValue) と `sponsors.tier` (optional)。定数配列から `.map(({name, label}) => ({label, value: name}))` で options を生成する書き方が `student_exhibitions.categories` にある。
  - PostgreSQL の enum ラベルに課される制約は大文字小文字の区別、空白の有意性、NAMEDATALEN (63 バイト) のみで、文字種の制限はない。公式ドキュメントの例自体が `'very happy'` という空白入りのラベルを使っている。ラベルは識別子ではなく文字列リテラルとして扱われる。Payload の drizzle アダプタも select の `value` をそのまま enum ラベルに渡す。したがって `accent-alt` をそのまま DB 値として使える。
  - `map_areas.geometry` は `type: 'json'` のみで `validate` を持たない。不正な GeoJSON をそのまま保存できる。
  - `map_areas.sort` は `type: 'number'` で `required` を持たないため NULL を取りうる。
  - マイグレーションは `YYYYMMDD_HHMMSS_<説明>.ts` + 同名 `.json`。`index.ts` の配列末尾に 1 エントリ追記。enum カラム追加は `CREATE TYPE ... AS ENUM(...)` の後にカラムを追加し、`down` は逆順。
- **Implications**: 要件 3.7 は CMS 側で自動的に満たされ、フロントエンドに追加実装は不要。要件 6 は既存の select 実装とマイグレーション手順に倣えばよく、加算のみなので `cms-schema-check.yml` の破壊的変更検出には掛からない。トークン名の表記をフロントエンドと DB で揃えられるため、変換層は不要。要件 2.8 のために `geometry` に `validate` を追加する。`sort` の NULL は型に反映し、未設定のエリアを末尾に置く規則を設計に書く。

### レイアウトからヘッダー・フッターを外す方法

- **Context**: 要件 1.4 がサイト共通ヘッダー・フッターの非表示を求める。
- **Sources Consulted**: `frontend/src/app/layout.tsx`, `frontend/src/app/layout.test.tsx`, `frontend/src/app/not-found.tsx`, `frontend/src/app/` のディレクトリ構成, https://nextjs.org/docs/15/app/guides/lazy-loading
- **Findings**:
  - `RootLayout` が `<Header />` → `{children}` → `<Footer />` を無条件にレンダリングしている。
  - `layout.test.tsx` の `findFooterElement()` は `RootLayout` の返り値から `body.props.children` を辿り `child.type === Footer` を探し、見つからなければ例外を投げる。SNS リンクの表示検証がこの関数に依存している。`<Footer />` を別の layout へ移すとこのテストは必ず失敗する。
  - `not-found.tsx` は `<main>` のみを返し、Header/Footer を自前では持たない。root layout の中で描画されることに依存している。
  - `app/exhibitions/` には一覧 (`page.tsx`) と詳細 (`[id]/[category]/page.tsx`) が同居している。`announcements/` と `topics/` も同様に一覧と `[id]/` を持つ。
  - route group (`(group)`) は 1 つも存在しない。
  - `Header` は既に Client Component で `usePathname()` を使用している。`Footer` は Server Component。
  - Next.js 15 の lazy loading ガイドに "`ssr: false` option is not supported in Server Components. You will see an error if you try to use it in Server Components." と明記されている。
- **Implications**: route group でレイアウトを分割する。移動はディレクトリ単位で行い、詳細ページを取り残さない。`layout.test.tsx` の Footer 検証は `(site)/layout.test.tsx` へ移す。404 がシェルを失わないよう `(site)/not-found.tsx` を新設する。地図コンポーネントの `ssr: false` はページ (Server Component) からではなく、`'use client'` を持つラッパーから呼ぶ。

## Architecture Pattern Evaluation

### 地図描画

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Leaflet + react-leaflet v5 | ラスタタイル向けの軽量ライブラリを React ラッパー経由で使う | WebGL 不要で端末互換性が広い。peerDeps が React 19 と一致。GeoJSON レイヤーが標準機能 | Client Component 限定。DOM 依存のため `'use client'` ラッパー経由の `ssr: false` が必要 | **採用** |
| MapLibre GL JS | WebGL ベースのベクタタイル向けライブラリ | ベクタタイルのスタイリングが柔軟。滑らかな描画 | WebGL 必須。`dist.unpackedSize` が Leaflet の約 5.5 倍。入手できるベクタタイルが z15 までのため z19 は引き伸ばしになる | 却下 |
| 自前 SVG 描画 | タイルを `img` で敷き、GeoJSON を投影して SVG path に変換 | 依存ゼロ。描画を完全に制御できる | パン・ズーム・ピンチ・慣性・投影計算を自前で持つ。要件 1.6 / 1.7 / 1.8 のコストが跳ね上がる | 却下 |

### タイルの入手元

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| OSM データから自前レンダリング | switch2osm の Docker イメージで焼く | 規約上の制約がない。z19 まで実データで描ける。現行の Leaflet 設計をそのまま使える | 生成環境に約 30GB のディスクが要る。範囲変更はインポートからやり直し | **採用** (生成は GitHub Actions 上) |
| 公式タイルサーバから事前取得 | `tile.openstreetmap.org` から会場周辺を取得 | 実装が最も簡単 | Tile Usage Policy 第 4 節が名指しで禁止。例外条項なし。ブロックはネットワーク単位でありうる | 却下 |
| ホスト型プロバイダから事前取得 | Thunderforest / MapTiler 等から取得して再配信 | 生成環境が不要 | 調査した 6 社すべてが事前取得または再配信のいずれかを禁止。両方を許すものがない | 却下 |
| ベクタタイル (Protomaps / OpenFreeMap) | PMTiles を自前ホストし MapLibre で描画 | 生成が軽い。容量が小さい | 配布物が z15 まで。z19 は overzoom になり要件 1.9 の趣旨に反する。Leaflet の全面置換と Range 配信の自作が要る | 却下 |

### タイル配信

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 個別 PNG を静的アセット配信 | `frontend/public/map-tiles/{z}/{x}/{y}.png` に置く | 追加依存ゼロ。Cloudflare CDN にそのまま乗る。Cache API に直接入れられる | リポジトリに約 7.7MB のバイナリ資産が入る | **採用** |
| PMTiles + R2 + Worker | 単一アーカイブを Range リクエストで配信 | タイルが数千枚規模でも管理できる | 依存・バケット・CORS・Worker・MBTiles 変換が増える。R2 のレイテンシ 500ms 以上の警告あり | 却下 |
| S3 互換ストレージ (Hetzner 等) から配信 | 既存のオブジェクトストレージに置く | リポジトリにバイナリが入らない。更新にデプロイが不要 | 日本からの RTT が実測で約 270ms、TLS 確立まで約 540ms。Cloudflare エッジの約 30ms と比べ初期表示で不利。CORS と障害点が増える | 却下 (資産が数十 MB 規模になった時点で再検討) |

### レイアウト分割

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| route group で分割 | `(site)` と `(fullscreen)` に分け、シェルを各グループの layout に移す | 構造で表現される。`digital-signage` がそのまま乗れる | 既存ページの移動を伴う。差分が大きい。`layout.test.tsx` の書き換えが要る | **採用** |
| Header/Footer 側でパス判定 | `usePathname()` で特定パスなら `null` を返す | 差分が最小。既存ページを動かさない | シェルの有無がコンポーネント内部に埋もれる。Footer の Client 化が必要。対象ページが増えるたび条件が増える | 却下 |

## Design Decisions

### Decision: 地図ライブラリに Leaflet + react-leaflet v5 を採用する

- **Context**: 要件 1・2 が地図の表示・操作と GeoJSON Polygon の描画・クリックを求める。React 19 との互換性が前提条件。
- **Alternatives Considered**:
  1. MapLibre GL JS — WebGL ベース。ベクタタイル向け
  2. 自前 SVG 描画 — 依存ゼロだがパン・ズームを自作
- **Selected Approach**: `leaflet@1.9.4` / `react-leaflet@5.0.0` を dependencies に、`@types/leaflet` を devDependencies に追加する。地図本体を Client Component として実装し、`'use client'` を持つラッパーモジュールから `next/dynamic` の `ssr: false` で読み込む。ページ (Server Component) はそのラッパーを参照する。
- **Rationale**: react-leaflet v5 の peerDependencies が React 19 を要求しており、プロジェクトの構成とちょうど一致する。ラスタタイルを自前配信する以上 MapLibre のベクタ描画能力は活きず、WebGL 必須という制約だけが残る。来場者の端末は多様であり、WebGL 非対応や描画が重い端末を切り捨てたくない。
- **Trade-offs**: 地図部分は Server Component にできず、初期 JS が増える。ベクタタイルへ移行する場合はライブラリごと差し替えになる。
- **Follow-up**: `leaflet/dist/leaflet.css` の読み込みと地図コンテナの明示的な高さ指定を実装時に確認する。Tailwind v4 の preflight と leaflet.css の競合の有無も併せて見る。

### Decision: 地図タイルを OSM データから自前レンダリングし、静的アセットとして配信する

- **Context**: OSM Tile Usage Policy 第 4 節が閲覧中以外のタイルの先回り取得を無条件に禁止しており、公式タイルサーバからの事前取得は成立しない。ホスト型プロバイダにも事前取得と再配信の双方を許諾するものがない。後続の `pwa-offline` でオフライン対応を行う方針が確定している。
- **Alternatives Considered**:
  1. 公式タイルサーバから一度だけ取得する — 規約違反であり却下
  2. ホスト型プロバイダから取得して再配信する — いずれの社も規約で禁じており却下
  3. ベクタタイル (Protomaps / OpenFreeMap) + MapLibre — z15 までの配布物を z19 で引き伸ばすことになり却下
- **Selected Approach**: switch2osm が案内する `Overv/openstreetmap-tile-server` の Docker イメージを GitHub Actions 上で実行し、Geofabrik の群馬県 extract から会場周辺を切り出してレンダリングする。z17 (2304×1792px を覆う 9×7 = 63 枚) を下限、z19 を上限とし、合計 1323 枚を `frontend/public/map-tiles/{z}/{x}/{y}.png` に資産としてコミットする。ワークフローは `workflow_dispatch` の手動実行とし、成果物を artifact として受け取る。
- **Rationale**: 自前レンダリングは Tile Usage Policy 第 8 節が案内する正規の手段であり、規約上の制約を受けない。ラスタ PNG を直接生成できるため現行の Leaflet 設計をそのまま使える。実行を GitHub Actions に置くことで、30GB のディスクと PostGIS・Mapnik のセットアップを開発者の手元から切り離し、実行ごとに破棄させられる。会場は毎年同じであり、生成は実質一度で済む。
- **Trade-offs**: リポジトリに約 7.7MB のバイナリが入る。範囲やズーム幅を変えるにはワークフローの再実行とコミットが必要で、インポートからやり直すため 1 回あたりの所要時間が長い。ズーム 19 を超える拡大ができない。
- **Follow-up**: 生成後に実際の枚数と総容量を計測し、推定 (1323 枚・約 7.7MB) との乖離を確認する。日本語ラベルが正しく描画されることを目視で確認する。

### Decision: エリア選択と絞り込みをクライアント側の状態で保持し、URL へ反映する

- **Context**: 要件 3.10・4.9 がエリア選択と絞り込みの変更でサーバーへの再取得を発生させないことを求める。要件 9 が URL による共有と復元を求める。`cms.ts` の `request()` はキャッシュオプションを持たず、Server Component の再レンダリングは CMS への実リクエストを伴う。
- **Alternatives Considered**:
  1. `router.replace` で URL を書き換え、Server Component 側で絞り込む
  2. 初回レンダリングで全カードをクライアントへ渡し、絞り込みをクライアントで行う
- **Selected Approach**: ページ (Server Component) が全カードとエリア一覧を一度だけ取得してクライアントへ渡す。エリア選択・キーワード・カテゴリの絞り込みはクライアント側で `filterExhibitions` を用いて行い、URL への反映は History API 経由で行ってサーバーへの再取得を発生させない。初回表示時は URL のクエリを Server Component が解釈し、絞り込み済みの状態で描画する。
- **Rationale**: 案 1 は、ポリゴンをタップするたびに `student_exhibitions` / `performance_slots` / `stages` / `map_areas` の全件取得が走る。会場でポリゴンを触りながら見て回るのが本ページの主用途である以上、最も使われる操作が最も重くなる。当日の CMS (Postgres) への負荷もここに集中する。出展物の総件数は数百件規模であり、全件をクライアントへ渡すコストは初回の 1 回だけで済む。
- **Trade-offs**: 初回のペイロードが増える。CMS の更新がページに反映されるのは次の初回読み込み時になる。
- **Follow-up**: 初回ペイロードのサイズを計測する。要件 6.3 (色変更の反映) の反映タイミングが運用上許容できるかを確認する。

### Decision: ブラウザの履歴に絞り込みの変更を積む

- **Context**: 要件 9.3 がブラウザの戻る操作で直前の条件へ戻ることを求める。
- **Alternatives Considered**:
  1. `replaceState` 相当で履歴を積まない — 戻る操作がサイトからの離脱になる
  2. `pushState` 相当で履歴を積む
- **Selected Approach**: エリアの選択・解除は履歴に積む。キーワード入力は一定時間の停止を待って 1 エントリにまとめる。カテゴリの選択は履歴に積む。
- **Rationale**: スマートフォンでエリアを選んだ来場者が戻るジェスチャでサイトから出てしまうのを避ける。キーワードを 1 文字ごとに積むと戻る操作が使い物にならなくなるため、デバウンス後の確定値のみを積む。
- **Trade-offs**: 絞り込みを何度も変えた後にページを離れるには、戻るを複数回押すことになる。
- **Follow-up**: 戻る操作でクライアント側の状態が URL と同期することをテストで固定する。

### Decision: `map_areas.color` を select として追加し、未設定時は既定色で描く

- **Context**: 要件 6 が表示色の CMS 管理を求める。要件 6.2 が任意の色値の入力を禁じている。
- **Alternatives Considered**:
  1. `text` フィールドに色コードを入力させる
  2. デザイントークン名の `select`
- **Selected Approach**: `type: 'select'` で `primary` / `secondary` / `accent` / `accent-alt` / `info` / `success` / `warning` の 7 値を持つ。トークン名をそのまま DB の enum ラベルに用いる。`required` は付けず、未設定時はフロントエンドが既定色 (`secondary`) で描画する。
- **Rationale**: 色を自由入力にすると、コントラスト不足や地図タイルと衝突する配色が入りうる。PostgreSQL の enum ラベルに文字種の制限はないため、`accent-alt` をそのまま値として使え、フロントエンドのトークン名との変換層が不要になる。`required` を付けないことで既存レコードのマイグレーションに既定値の埋め込みが不要になり、破壊的変更にもならない。
- **Trade-offs**: 7 色しか使えず、エリアが 8 つ以上ある場合は色が重複する。Leaflet の GeoJSON `style` は CSS 色値を取るため Tailwind のクラス名は使えず、トークン名から色値への解決をフロントエンドに持つことになる。
- **Follow-up**: 色値は `tailwind.config.ts` から導出し、二重管理にしない。エリア数が 7 を超えた場合の運用を CMS の admin description に注記する。

### Decision: `geometry` を CMS 側で検証し、フロントエンドでも zod スキーマで再検証する

- **Context**: 要件 2.7 が不正な `geometry` を持つエリアの除外を、要件 2.8 がその保存の拒否を求める。Payload の `json` 型が生成する型は GeoJSON Polygon であることを保証しない。
- **Alternatives Considered**:
  1. フロントエンドでの除外のみ
  2. CMS 側の `validate` のみ
  3. 両方
- **Selected Approach**: `map_areas.geometry` に `validate` を追加して保存時に弾く。フロントエンド側も zod スキーマでパースし、失敗したエリアを描画対象から除外する。
- **Rationale**: 入力時に拒否すれば、不正なデータがそもそも入らない。既存レコードや管理画面を経由しない書き込みに備えてフロントエンド側の除外も残す。`zod` は `frontend/src/env.ts` で既に使われている。
- **Trade-offs**: 検証ロジックが CMS とフロントエンドの 2 箇所に存在する。
- **Follow-up**: GeoJSON 仕様は座標の第 3 要素 (高度) を許すため、スキーマを 2 要素固定にすると正当な GeoJSON を弾く。許容するかどうかを実装時に決める。

## Risks & Mitigations

- **タイル生成ワークフローが GitHub Actions のディスク容量に収まらない可能性** — 公式 guide が小さい抽出でも約 30GB と記載している。`ubuntu-latest` の `/mnt` に確保できることを最初の実行で確認し、足りない場合は不要なプリインストールソフトの削除で空きを作る。
- **route group への移動が他 spec とコンフリクトする** — 大半のページは `git mv` で移せるが、`layout.tsx` は `<Header />` / `<Footer />` の描画を `(site)/layout.tsx` へ切り出す内容変更を伴い、`layout.test.tsx` の書き換えも要る。実装順序として最初のタスクに置き、他の作業と同時進行させない。
- **タイル資産のコミットによるリポジトリ肥大** — ズーム範囲 z17〜19 で約 7.7MB を見込む。PNG は delta 圧縮が効かず、再生成のたびに同量が履歴に積まれる。範囲変更は容量を再計測してから行い、原則として再生成しない運用とする。
- **初回ペイロードの増加** — 全カードをクライアントへ渡す設計のため、出展物が増えるほど初回が重くなる。実測して許容範囲を超える場合は、カードの項目を表示に必要な最小限へ絞る。
- **エリア数が 7 を超えて色が重複する** — 選択中エリアは不透明度と枠線で区別するため、色の重複が致命的にはならない。エリア名ラベルが最終的な識別手段になる。
- **タイルの鮮度** — OSM データは日々更新され、コミットしたタイルは生成時点で固定される。建物の増改築や OSM 側の修正は反映されない。祭の準備時に現地と照合し、必要なら再生成する運用を残す。

## References

- [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) — 第 4 節の bulk downloading 禁止、attribution 要件、self-hosting の案内
- [switch2osm](http://switch2osm.org/) — 自前タイル生成の手順
- [Overv/openstreetmap-tile-server](https://github.com/Overv/openstreetmap-tile-server) — 採用する Docker イメージとディスク要件
- [OpenStreetMap Carto (Standard tile layer)](https://wiki.openstreetmap.org/wiki/Standard_tile_layer) — タイル画像のライセンスが ODbL 1.0 である根拠
- [Licence/Attribution Guidelines](https://wiki.osmfoundation.org/wiki/Licence/Attribution_Guidelines) — 帰属表示の要件
- [Next.js Lazy Loading](https://nextjs.org/docs/15/app/guides/lazy-loading) — Server Component で `ssr: false` が使えない根拠
- [react-leaflet CHANGELOG](https://github.com/PaulLeCam/react-leaflet/blob/master/CHANGELOG.md) — v5.0.0 の React 19 peer dependency 要求の根拠
- [react-leaflet Setup](https://react-leaflet.js.org/docs/start-setup/) — CSS 読み込みとコンテナ高さの要件
- [react-leaflet API Components](https://react-leaflet.js.org/docs/api-components/) — `<GeoJSON>` の `data` が immutable である根拠
- [Leaflet API Reference](https://leafletjs.com/reference.html) — GridLayer の `bounds` / `maxNativeZoom`、Map の `maxBounds` / `maxBoundsViscosity`
- [PostgreSQL Enumerated Types](https://www.postgresql.org/docs/current/datatype-enum.html) — enum ラベルに文字種制限がない根拠
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) — 静的アセットのファイル数上限
- [Cloudflare Static Assets Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) — 静的アセットが無料である一方、404 が Worker 呼び出しになる根拠
- [Protomaps Basemaps Downloads](https://docs.protomaps.com/basemaps/downloads) — ベクタタイル配布物の収録ズームと自前ホストの案内
