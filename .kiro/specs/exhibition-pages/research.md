# Research & Design Decisions — exhibition-pages

## Summary

- **Feature**: `exhibition-pages`
- **Discovery Scope**: Extension (既存 Next.js フロントエンド + Payload CMS への機能追加)
- **Key Findings**:
  - 既存の `frontend/src/lib/cms.ts` は `limit` / `sort` / `depth` / `where` を備えており、一覧実装に必要な拡張は無い。`page` や `like` 演算子を足さずとも、全件取得 + サーバー内での絞り込みで要件を満たせる。
  - 要件 2.2 の「全角/半角を区別しない」照合は Postgres の `ILIKE` (Payload の `like` / `contains`) では実現できない。NFKC 正規化を伴う照合が必要なため、絞り込みは Next.js のサーバー側で行う。
  - 要件 2.5 のエリア判定はステージ経由 (`performance_slots` → `stages.area_id`) を含む。REST の join field 経由で辿るより、`performance_slots` と `stages` を個別取得して結合する方が単純かつ件数上限の罠が無い。
  - 本番 DB の `student_exhibitions` は 0 件 (2026-09-18 確認) のため、`links` の `json` → `array` 変更にデータ移行は不要。
  - OKLCH グラデーション・SVG ノイズ・Web Share API・Clipboard API はいずれもブラウザ側の機能で、Cloudflare Workers の Edge Runtime 制約に抵触しない。ただし `in oklch` 未対応時のフォールバックは 2 段宣言が必要で、`navigator.share` は存在判定だけでは不十分。
  - Tailwind v4 を JS config 経由で使う本リポジトリでは `--color-*` の CSS カスタムプロパティが生成されない (実測)。実行時に決まるカード配色は色値そのものを JS から渡す。

## Research Log

### Payload 3 の REST クエリ仕様

- **Context**: 一覧のキーワード検索・ファセット・ページングをどこまで CMS 側へ委譲できるかを判断するため。
- **Sources Consulted**:
  - [Payload — Queries Overview / Operators](https://github.com/payloadcms/payload/blob/main/docs/queries/overview.mdx)
  - [Payload — Pagination](https://github.com/payloadcms/payload/blob/main/docs/queries/pagination.mdx)
  - [Payload — Sort](https://github.com/payloadcms/payload/blob/main/docs/queries/sort.mdx)
  - [Payload — Joins (test/joins/int.spec.ts)](https://github.com/payloadcms/payload/blob/main/test/joins/int.spec.ts)
- **Findings**:
  - REST は `?limit=10&page=2`、`?sort=priority,-createdAt`、`?depth=N` を受け付ける。`limit=0` で全件。
  - 演算子は `equals` / `not_equals` / `greater_than(_equal)` / `less_than(_equal)` / `like` / `contains` / `in` / `not_in` / `all` / `exists` / `near` / `within` / `intersects`。`like` と `contains` はいずれも大文字小文字を区別しないが、Unicode 正規化 (全角/半角) は行わない。
  - `and` / `or` のネストとドット記法 (`author.role`) をサポートする。
  - join field は既定で取得件数に上限があり、`joins[<field>][limit]` 等で個別制御する必要がある。
- **Implications**:
  - 要件 2.2 を満たすには NFKC 正規化後の照合が要る → キーワード照合はサーバー側 (Next.js) の純関数で行う。
  - `cms.ts` に `page` / `like` を追加する必要が無い (既存 API のまま `limit: 0` + `sort` + `depth` で足りる)。
  - join field の件数上限を避けるため、出演枠とステージは個別コレクションとして取得して結合する。

### 既存フロントエンドの実装慣習

- **Context**: 新規ページを既存パターンに合わせるため。
- **Sources Consulted**: `frontend/src/lib/{cms,topics,announcements,cms-media,cms-asset-url}.ts`, `frontend/src/app/topics/**`, `frontend/e2e/**`
- **Findings**:
  - データ取得は `lib/<domain>.ts` に集約し、CMS 型 (`@/cms-types`) から表示用の型へ変換する関数を置く。ページは `app/**/page.tsx` から呼ぶだけ。
  - 一覧ページは取得失敗時に空配列へフォールバックし、詳細ページは `notFound()` を使う。
  - 画像 URL は `toAssetUrl(fileId, width)` が `"/api/media/serve/<id>/<size>"` を返す。派生サイズは `card` (960) と `hero` (1920) のみ。
  - `media` コレクションは `alt` テキストを持つが、既存の `Attachment` 型は `alt` を運んでいない。
  - E2E は `frontend/e2e/*.spec.ts` に置き、ファイル冒頭に依存コレクションをコメントで明記し、`beforeAll` で `checkCmsReachable` を呼ぶ規約。
- **Implications**:
  - 本 spec も `lib/exhibitions.ts` に取得と整形を集約し、ページは表示に徹する。
  - サムネイルは既存の `card` (960) を流用し、新しい派生サイズは追加しない。
  - `alt` は本 spec の表示モデル (`ExhibitionImage`) で独自に運ぶ。`Attachment` 型には手を入れない。

### Edge Runtime / OpenNext 制約との整合

- **Context**: カードのグラデーション・ノイズ、共有機能が Cloudflare Workers 上で動くか確認するため。
- **Sources Consulted**: `.kiro/steering/tech.md`, `frontend/next.config.ts`, `frontend/open-next.config.ts`
- **Findings**:
  - 制約は「サーバー側で Node.js 専用 API を使わない」ことに限られる。
  - グラデーション (`linear-gradient(in oklch …)`)、SVG `feTurbulence` によるノイズ、`navigator.share`、`navigator.clipboard` はすべてブラウザ側で完結する。
  - カード配色の計算は FNV-1a と mulberry32 の純粋な算術のみで、Node 固有 API を使わない。サーバーとクライアントで同じ値になる。
- **Implications**: 追加の実行環境対応は不要。共有とギャラリーのみクライアントコンポーネントにする。

### CMS スキーマ変更ゲート

- **Context**: `links` の `json` → `array` は型変更であり、`cms-schema-check.yml` が破壊的変更として検出する。
- **Sources Consulted**: `cms/scripts/check-schema-changes.ts`, `.kiro/steering/tech.md`, `CLAUDE.md`
- **Findings**:
  - 検査は base/head のコレクション定義を実際に評価して比較し、フィールド削除・型変更・必須化を検出する。
  - 承認済みの破壊的変更は PR に `breaking-change-acknowledged` ラベルを付けて検出をスキップする。
  - 本番 `student_exhibitions` は 0 件のため、失われるデータが存在しない。
- **Implications**: CMS 定義変更・マイグレーション・フロントエンド実装を 1 PR にまとめ、ラベルで通す。データ移行スクリプトは作らない。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. CMS へ絞り込みを委譲 | REST の `where` / `page` / `sort` で CMS 側が絞り込む | 転送量が最小、件数増に強い | 全角/半角の正規化ができず要件 2.2 を満たせない。ステージ経由のエリア判定 (2.5) がネストクエリで複雑化 | `cms.ts` に `page` / `like` の追加が必要 |
| B. サーバー側で全件取得して絞り込む (採用) | SSR で全件取得し、純関数で正規化・絞り込み・ページング | 要件 2.2 / 2.5 を素直に満たす。`cms.ts` 無改造。純関数なので単体テストが容易 | 企画数が数千規模になると転送量・処理時間が課題 | 学園祭の企画数 (数十〜数百) では問題にならない |
| C. クライアント側で絞り込む | 全件を初期 HTML に載せてブラウザで絞る | 操作が即応 | 初期ペイロード肥大、SEO と URL 共有の扱いが煩雑 | 要件確定時に不採用と決定済み |

## Design Decisions

### Decision: 絞り込みはサーバー側の純関数で行う

- **Context**: 要件 2.1-2.11 (キーワード・ファセット・ページング・URL 状態) と 2.2 の正規化要求。
- **Alternatives Considered**:
  1. CMS の `where` へ委譲 (上記 A)
  2. SSR で全件取得し純関数で絞り込む (上記 B)
- **Selected Approach**: B。`page.tsx` が `searchParams` を読み、`lib/exhibitions.ts` が全件取得 → `filterExhibitions` / `paginate` の純関数で結果を確定させる。
- **Rationale**: 要件を完全に満たしつつ `cms.ts` を変更しない。絞り込みロジックが純関数になり、テストが CMS に依存しない。
- **Trade-offs**: 1 リクエストあたり全件を CMS から取得する。企画数が数千に達した場合は A への移行が必要。
- **Follow-up**: 実装後、企画 300 件相当のデータで一覧の応答時間を確認する。

### Decision: 出演枠とステージは個別に取得して結合する

- **Context**: 要件 2.5 / 4.2 / 4.4 はステージ名とステージ所属エリアを必要とする。
- **Alternatives Considered**:
  1. `student_exhibitions` の join field を `depth: 2` で辿る
  2. `performance_slots` と `stages` を個別取得し、ID で結合する
- **Selected Approach**: 2。`lib/exhibitions.ts` が 4 本の GET (`student_exhibitions` / `performance_slots` / `stages` / `map_areas`) を並列実行し、メモリ上で結合する。
- **Rationale**: join field の既定件数上限や `joins[…]` パラメータの取り回しを避けられる。ステージ・出演枠・エリアはいずれも小さなコレクション。
- **Trade-offs**: リクエスト数が増える (4 本)。いずれも並列実行するため待ち時間は最長の 1 本に収まる。

### Decision: グレーは `tailwind.config.ts` の `gray` を上書きする

- **Context**: 要件 9.2。既存コードの `gray-*` クラスは 13 ファイルに散在する。
- **Alternatives Considered**:
  1. 全箇所を `stone-*` へ置換する
  2. `tailwind.config.ts` の `colors.gray` を stone 相当の値で再定義する
- **Selected Approach**: 2。ただし**実使用の 9 階調すべて**を上書きする。
- **Findings (実測)**: 既存コードが使うのは `gray-50` / `100` / `200` / `300` / `400` / `500` / `600` / `700` / `800` の 9 階調で、最多は `gray-200` の 10 箇所。`extend.colors.gray` は既定パレットとの深いマージになるため、上書きしなかった階調は寒色の既定値のまま残る。
- **Rationale**: 差分が 1 ファイルに収まり、既存コンポーネントのクラス名を触らずに済む。
- **Trade-offs**: クラス名 `gray-*` と実際の色味 (暖色) が一致しないため、設定ファイルにコメントで理由を残す。

### Decision: カード配色は企画名からの決定的計算とする

- **Context**: 要件 3.4 / 3.5 / 10.3。Figma のモックも同じ計算で配色済み。
- **Selected Approach**: FNV-1a (32bit) → mulberry32 → 色 A / A と異なる色 B / 角度、を `lib/exhibition-color.ts` の純関数として実装し、CSS は `linear-gradient(in oklch <angle>deg, A, B)` を用いる。
- **Rationale**: 乱数の種が企画名のみに依存するため、サーバーとクライアント、および Figma のモックで同じ配色になる。OKLCH 補間で要件 3.6 (中間のくすみ回避) をブラウザ側の機能だけで満たす。
- **Trade-offs**: `in oklch` に未対応のブラウザは **sRGB 補間へ退化しない**。CSS はパースできない宣言を丸ごと破棄するため、単一宣言では背景が消える。素のグラデーションを先に置き `@supports` で OKLCH 版へ差し替える 2 段宣言が必須。
- **Follow-up**: Figma の実装値と同じ配色が出ることを単体テストで固定する。

### Decision: 配色は色値そのものを JS から渡す

- **Context**: 要件 3.4 の背景色を実行時に決めるため、トークン名から CSS の色へ橋渡しする手段が要る。
- **Findings (実測)**: 本リポジトリの Tailwind v4 は `@tailwindcss/postcss` + `@config "../../tailwind.config.ts"` の互換経路で、JS config 由来の色は `.bg-primary { background-color: #ebb03c }` のようにリテラル展開されるだけで `--color-*` のカスタムプロパティを生成しない。動的なクラス名も静的検出されないため生成されない。
- **Selected Approach**: `lib/exhibition-color.ts` に `GRADIENT_PALETTE` (トークン名 → 色値) を置き、`getExhibitionGradient` が色値も返す。カードはインラインのカスタムプロパティで色値と角度を渡す。
- **Trade-offs**: `tailwind.config.ts` と色値が二重管理になる。両者の一致を単体テストで固定して検出する。

## Risks & Mitigations

- 企画数の増加で一覧の全件取得が重くなる — 応答時間を実測し、閾値を超えたら CMS 側絞り込み (案 A) へ移行する。
- `links` の型変更が `cms-schema-check` に検出される — 本番 0 件を確認済みのため、`breaking-change-acknowledged` ラベルで通す。
- 背景色の変更がサイト全体に波及する — 既存ページの本文コントラストを実測する (要件 9.3)。見出し色は装飾として対象外 (要件 9.4)。
- `sns-icon.tsx` の差し替えで既存テストが壊れる — `data-testid` を維持したまま SVG を差し替える。
- OGP 画像が `media/serve` の 302 リダイレクトである — クローラの追従を実装時に確認する (**未検証**)。
- `links` の型変更を切り戻す自動経路が無い — PreSync Job (`cms-migrate`) と `cms-ci.yml` は `payload migrate` (up) 固定。同じ migrator イメージで `migrate:down` を手動実行する手順を design.md に明記した。PreSync で旧カラムを DROP した直後から新 Deployment に入れ替わるまで、旧 Pod は `student_exhibitions` を読めない (本番 0 件のためデータ損失は無い)。
- workerd 上で `String.prototype.normalize('NFKC')` が full-ICU として動くか — 要件 2.2 の根幹。実装初手で実測する (**未検証**)。

## References

- [Payload — Queries Overview](https://github.com/payloadcms/payload/blob/main/docs/queries/overview.mdx) — 演算子一覧と `like` / `contains` の意味
- [Payload — Pagination](https://github.com/payloadcms/payload/blob/main/docs/queries/pagination.mdx) — `limit` / `page`
- [Payload — Sort](https://github.com/payloadcms/payload/blob/main/docs/queries/sort.mdx) — `sort` の記法
- [Payload — Array Field](https://payloadcms.com/docs/fields/array) — `links` の新しい形
- [Figma「ホームページ」/ 企画ページ](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=2-3) — 画面デザインの正
