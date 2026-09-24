# Research & Design Decisions

## Summary
- **Feature**: `seo-metadata`
- **Discovery Scope**: Extension (既存 App Router / Payload への拡張)
- **Key Findings**:
  - `frontend/src/middleware.ts` の matcher は拡張子付きパス (`.*\.[^/]+$`) を除外する。`public/images/` 配下の静的既定 OG 画像、`robots.txt` / `sitemap.xml` はフェーズゲートの rewrite を受けない。
  - `/sponsors/ad` `/sponsors/local` は `PRE_EVENT_PUBLIC_PATHS` (`frontend/src/lib/phase.ts:39-40`) にあるが、対応するルート (`src/app/**/sponsors`) が存在せず 404 を返す。現行 sitemap はこの 404 URL を申告している。
  - `/map` は `map_areas` / `student_exhibitions` (公開済み) / `stages` / `performance_slots` から構成される (`frontend/src/lib/campus-map.ts:145-180`)。いずれも Payload の自動 `updatedAt` を持つため、`lastModified` はこれらの最大値で導出でき CMS へのフィールド追加は要らない。
  - `/access` `/privacy` `/contact` `/guidelines` `/info-desk` `/waste` `/faq` は全て `(site)/[slug]/page.tsx` で解決される固定ページ。`pages` レコードが無ければ 404。

## Research Log

### Next.js metadata のマージ規則
- **Context**: 要件 1.1 / 2.6-2.8 / 7.3。
- **Sources Consulted**: [Next.js generateMetadata — Merging](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#merging)、[opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- **Findings**:
  - `openGraph` / `twitter` などのネストしたオブジェクトは子セグメントで**丸ごと上書き**される (浅いマージ)。子で `openGraph.title` だけ指定すると root の `siteName` / `locale` / `images` は消える。
  - ファイル規約の `opengraph-image.*` は metadata オブジェクトの `openGraph.images` より優先される。CMS 画像を優先する要件 7.3 と衝突する。
  - `alternates.canonical` を root で指定すると全ページに継承され、全ページが `/` を正規 URL と宣言してしまう。
- **Implications**: `openGraph` / `twitter` は共通ビルダー経由で各ページが完全な形で生成する。既定 OG 画像はファイル規約を使わず `public/images/og-default.png` を明示 URL で参照する。canonical は root に置かずページごとに設定する。

### 公開フェーズとクロール制御
- **Context**: 要件 3 / 4。
- **Findings**:
  - `isPublicPath(pathname, phase)` (`frontend/src/lib/phase.ts:52-58`) は `live` で常に真、`pre_event` では完全一致一覧 + 前方一致一覧。
  - robots/sitemap の実効フェーズは Cookie オーバーライドではなく `BUILD_PHASE` (クローラは Cookie を持たない)。`resolvePhase(undefined)` で同じ値が得られる。
  - robots.txt の `Allow` は最長一致で `Disallow` より優先され、`$` 終端は Google / Bing が解釈する。
- **Implications**: `pre_event` では `Disallow: /` + 公開パスの `Allow` (完全一致は `$` 付き、前方一致はそのまま) + 描画に必要な静的資産 (`/_next/`, `/images/`) の `Allow` で表現する。公開パス一覧は `phase.ts` の export をそのまま読む。

### 構造化データ
- **Context**: 要件 5。
- **Sources Consulted**: [Google Search Central — Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event)、[Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)、[Next.js JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld)
- **Findings**:
  - Google の Event リッチリザルトは `name` / `startDate` / `location` を必須とし、`location` が `Place` の場合 `address` を必須とする。`festival_meta` には `venue_name` のみで住所フィールドが無い。
  - 複数日程は `event_days` 配列 (`start_at` / `end_at`)。`startDate` = 最初の `start_at`、`endDate` = 最後の `end_at` で 1 イベントとして表現できる。
  - Next.js 公式ガイドは `<script type="application/ld+json">` に `JSON.stringify(...).replace(/</g, '\\u003c')` を推奨。
- **Implications**: `festival_meta` に任意の `venue_address` を追加する (要件 6.13)。値は CMS で入力する。未設定時は `address` を省略し、リッチリザルト不適格を許容する。

### CMS スキーマ変更の検出範囲
- **Context**: 要件 6.5 / 6.12。
- **Findings**: `cms/scripts/collection-shape.ts` の `detectBreakingChanges` が検出するのは `entity_removed` / `field_removed` / `type_changed` と必須化。任意フィールドの追加は検出対象外。
- **Implications**: 追加フィールドは全て `required` を付けない。`breaking-change-acknowledged` ラベルは不要。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| `next/og` による動的生成 | ページタイトル入り画像を Route Handler で描画 | ページごとに内容の分かる画像 | Workers 上の動作実績が不安定、日本語フォント供給・バンドルサイズの問題を抱える | 不採用 (ブログ記事型のサイトではなく、ページ別画像の必要性が低い) |
| ファイル規約 `app/opengraph-image.png` | Next の自動注入 | 宣言的 | metadata の `openGraph.images` より優先され CMS 画像優先 (7.3) を満たせない | 不採用 |
| `public/images/og-default.png` を Builder が明示参照 | 静的ファイル + 最終フォールバック | 実行時処理なし、CMS 画像との優先制御が generateMetadata 側で完結 | ファイル未配置の間は画像 404 | **採用** |

## Design Decisions

### Decision: 既定 OG 画像は同梱の静的ファイル
- **Context**: 要件 7。
- **Selected Approach**: ページ個別 (`og_image` / コンテンツ画像) → `festival_meta.og_image` → `/images/og-default.png` の順。静的ファイルの実在は検査せず、未配置でもビルド・描画は通る。
- **Rationale**: 共有カードの画像欠け防止は既定画像 1 枚で足りる。CMS の `festival_meta.og_image` で運用中の差し替えもできる。

### Decision: 共通メタデータビルダーで openGraph/twitter を毎回完全生成
- **Context**: Next の浅いマージにより子セグメントが root の `openGraph` を消す。
- **Selected Approach**: `buildPageMetadata()` がページ固有の値とサイト既定値を合成し、`title` / `description` / `alternates` / `openGraph` / `twitter` を一括で返す。
- **Rationale**: 各ページで siteName / locale / 画像フォールバックの書き忘れを構造的に防ぐ。

### Decision: sitemap は「候補ルート × 公開判定 × 実在確認」で列挙
- **Context**: 要件 4.1 / 4.9、`/sponsors/*` が 404 である事実。
- **Selected Approach**: 候補 = `PRE_EVENT_PUBLIC_PATHS` ∪ `{/exhibitions, /topics, /map}` ∪ CMS 詳細。`isPublicPath(path, BUILD_PHASE)` で絞り、1 セグメントの固定ページ候補は `pages` に slug が実在するものだけ残す。ルートの無い `/sponsors/*` は候補から外す。
- **Trade-offs**: `/sponsors/*` のルートが実装されたら候補への追加が必要。

## Risks & Mitigations
- OG 画像に WebP (CMS 派生サイズ) を使うことによる一部 SNS の非対応 — 既存の企画詳細 (`toAssetUrl(id, 960)`) と同じ挙動のため本 spec では変えない。問題が出た場合は CMS 側で JPEG 派生を追加する別作業。
- 詳細取得関数が公開日時を見ない (`getAnnouncementById` / `getTopicById` は `findById` のみ) — 未公開レコードのタイトルがメタデータに出る可能性。本 spec はメタデータ生成を既存取得関数に委ねるため挙動を変えず、sitemap だけを公開済みに絞る。下書き/公開フェーズ化は別の変更で扱う。

## References
- [Next.js: generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) — マージ規則、`alternates`
- [Next.js: opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) — ファイル規約の優先順位
- [Next.js: JSON-LD](https://nextjs.org/docs/app/guides/json-ld) — `<` エスケープ
- [Google: Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event) — 必須プロパティ
- [Google: Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
