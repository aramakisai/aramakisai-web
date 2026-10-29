# Research & Design Decisions

## Summary
- **Feature**: `corporate-booth-exhibitions`
- **Discovery Scope**: Extension (既存の企画一覧・詳細・構内マップ・sitemap への統合)
- **Key Findings**:
  - 企画一覧・構内マップ・対象外画面 (サイネージのタッチ画面・マイページ・トップの注目企画) は、すべて `ExhibitionCardSummary` / `ExhibitionCategory` と `getExhibitionCatalog` / `getCampusMapData` / `getExhibitionListData` を共有している。データ取得層で企業ブースを混ぜると対象外画面へそのまま波及する
  - ブックマーク (`lib/mypage-storage.ts`) とスタンプ (`lib/stamp-signature.ts`) は `{id, category}` だけで企画を識別し、コレクションを区別しない。協賛と学生企画は別の ID 系列なので、企業ブースをこれらに入れると識別が衝突する
  - 詳細ページのルート `/exhibitions/[id]/[category]` は id が整数でなければ 404 を返す。静的セグメント `booth` を持つ `/exhibitions/booth/[id]` は Next.js の解決規則で動的セグメントより優先され、既存の学生企画 URL と衝突しない

## Research Log

### 既存の企画一覧・詳細・構内マップの構造
- **Context**: 企業ブースを既存部品で表示するための統合点の確認
- **Sources Consulted**: `frontend/src/lib/exhibitions.ts`、`lib/exhibition-detail-page.ts`、`lib/campus-map.ts`、`components/exhibition-card.tsx`、`components/exhibition-detail-body.tsx`、`components/exhibition-filters.tsx`、`components/campus-map/*`、`app/(site)/exhibitions/**`、`app/(fullscreen)/map/page.tsx`、`app/sitemap.ts`
- **Findings**:
  - 一覧は `getExhibitionCatalog` で全カードを取得し、絞り込み・ページ送りはクライアント (`exhibition-list.tsx`) で行う。フィルタ軸はキーワード (企画名・団体名)・カテゴリ (複数)・エリア (複数、OR)
  - 並びは企画 ID 昇順 × カテゴリ定義順。`filterExhibitions` は入力順を保つ
  - カードにはカテゴリチップが無い。カテゴリ表示はファセットの選択肢 (`CATEGORY_OPTIONS`) と詳細ページのバッジ (`CATEGORY_BADGE_COLORS` / `CATEGORY_LABELS`) の 2 か所
  - カードのリンク先と詳細の共有 URL は `/exhibitions/{id}/{category}` に固定
  - 詳細本体はブックマークボタンを常に描画し、メニューは `category === 'vendor'` のときだけ描画する。スタンプ取得はページ側 (`page.tsx`) で `isStampCategory` により描画する
  - 構内マップは `getCampusMapData` の `exhibitions` を `CampusMapScreen` → `AreaExhibitionList` に渡す。`AreaExhibitionList` はサイネージのタッチマップ (`touch-map.tsx`) も共有している。マップの検索 UI (`map-search-panel` / `map-search-overlay` / `use-map-filters`) は `/map` の `CampusMapScreen` 系からのみ使われる
  - 公開フェーズ判定 (`lib/phase.ts` の `isPublicPath`) は開催前フェーズで `/exhibitions` 配下を一切公開せず、`live` で全公開する。`/exhibitions/booth/*` も追加設定なしで同じ扱いになる
- **Implications**: 企業ブースは取得層を分け、一覧ページと `/map` ページの呼び出し側でだけ学生企画のカードと結合する。カテゴリの型は既存の `ExhibitionCategory` を変えず、一覧・マップ専用の上位型を足す

### 協賛データの取得
- **Context**: 企業ブースの元データの取得方法
- **Sources Consulted**: `frontend/src/lib/sponsors.ts`、`frontend/src/cms-types.ts` (feat/sponsor-vendor-shape で再生成済み)、`cms/src/collections/sponsors.ts`
- **Findings**:
  - `getSponsors` は id・name・logo・url・tier だけを残し、`vendor` グループを落とす。キャッシュは Workers Cache API で既定 60 秒
  - `sponsors` には公開状態が無く、未認証でも全件読める
  - `vendor` グループは学生企画の出店欄と共通定義 (企画名・紹介文・画像・出店日・エリア・ブース番号・マップ表示ラベル)
- **Implications**: 既存の `getSponsors` はロゴ表示用のまま残し、企業ブース用の取得関数を別に設ける (要件 6.5)

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. `ExhibitionCategory` に `'booth'` を追加 | 既存のカテゴリ型と共有取得関数に企業ブースを混ぜる | 変更箇所が型に沿って見える | サイネージ・マイページ・注目企画・GA に波及し、ブックマーク/スタンプの ID 衝突が起きる | 要件 6 に反する |
| B. 一覧・マップ専用の上位型を追加し、呼び出し側で結合 | `ListingCategory = ExhibitionCategory \| 'booth'` と `ListingCard` を新設し、一覧ページと `/map` でだけ結合する | 対象外画面の型・データが不変。部品は上位型を受け付けるよう広げるだけ | 一覧系の部品の props 型を広げる変更が要る | 採用 |

## Design Decisions

### Decision: 詳細ページの URL
- **Context**: 協賛と学生企画の ID 系列が別で、同じ番号が両方に存在しうる (要件 3.1, 3.10)
- **Alternatives Considered**:
  1. `/exhibitions/{sponsorId}/booth` — 既存ルートの category に `booth` を足す。id の名前空間が学生企画と同じ位置にあり、`/exhibitions/3/booth` と `/exhibitions/3/vendor` が別レコードを指して紛らわしい
  2. `/exhibitions/booth/{sponsorId}` — 静的セグメントで名前空間を分ける
- **Selected Approach**: 2。`app/(site)/exhibitions/booth/[id]/page.tsx` を新設する
- **Rationale**: 静的セグメントは動的セグメント `[id]` より優先して解決され、学生企画の URL (`id` は整数) と構文上重ならない
- **Trade-offs**: 詳細ページのルートが 2 本になる
- **Follow-up**: `/exhibitions/booth/{id}` と `/exhibitions/{id}/{category}` が両立することをルーティングのテストで確認する

### Decision: 企業ブースの並び
- **Context**: 要件 2.8, 4.4 (ユーザー承認済み: 学生企画すべての後ろに協賛の並び順で並べる)
- **Selected Approach**: 一覧ページと `/map` で `[...学生企画のカード, ...企業ブースのカード]` の順に結合し、企業ブースは `sponsors` の `_order` 順で取得する。`filterExhibitions` は入力順を保つので絞り込み後も同じ順になる

### Decision: 掲載のタイミング
- **Context**: 要件 1.1, 1.3 (ユーザー承認済み: 企画名が入った時点で掲載。公開状態の欄は追加しない)
- **Selected Approach**: 取得時に `vendor.name` が空白のみ・未設定のレコードを除く

## Risks & Mitigations
- 一覧系部品の props 型を広げることで、サイネージのタッチマップ (`AreaExhibitionList` を共有) の型が変わる — 上位型は既存型の上位集合なので、既存の呼び出しはそのまま型が通る。タッチマップのテストを回帰確認に使う
- 協賛の取得失敗で一覧・マップ全体が古いキャッシュのまま止まる — 学生企画の取得失敗と同じ扱い (例外で再検証を失敗させ、古いページを保つ) に揃える
- 協賛社の掲載内容確認前に企画名を入れると即公開される — 運用で「確認後に企画名を入れる」とする (ユーザー承認済み)

## References
- [Next.js: Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes) — 静的セグメントと動的セグメントの解決順
- `.kiro/specs/campus-map/design.md`、`.kiro/specs/exhibition-pages/design.md`、`.kiro/specs/exhibition-detail-extension/design.md` — 既存の一覧・詳細・マップの設計 (ADR として参照)
