# Requirements Document

## Project Description (Input)

荒牧祭公式サイト (Next.js App Router, `frontend/`) の title / metadata / SEO 周りの整備。Payload CMS (`cms/`) 側への SEO 専用フィールド追加も範囲に含む。

### 現状 (調査済み)

- `frontend/src/app/layout.tsx:64-89` の root `generateMetadata` は `metadataBase` / `title.default` / `title.template` / `description`(固定文字列 `'荒牧祭公式サイト'`) / `icons.icon` のみ。`openGraph` `twitter` `robots` `alternates.canonical` `keywords` `manifest` は全て未設定。
- title は CMS の `festival_meta.name` グローバルから取得。取得失敗時は `'荒牧祭'` にフォールバック。dev 環境では `【開発環境】 ` を前置。
- 実ページ10件中、`generateMetadata` を持つのは動的詳細4件のみ:
  - `(site)/announcements/[id]/page.tsx:25-31` — title のみ (CMS `announcement.title`)
  - `(site)/topics/[id]/page.tsx:24-30` — title のみ
  - `(site)/[slug]/page.tsx:12-18` — title のみ (CMS `pages` コレクション)
  - `(site)/exhibitions/[id]/[category]/page.tsx:40-71` — 唯一の本格実装。title / description / openGraph / twitter(`summary_large_image`) を持つ。og:image は CMS サムネイルを `toAssetUrl(id, 960)` で変換した URL。サムネイル未設定時は `undefined`(フォールバック無し)。
- metadata 無し: トップ `(site)/page.tsx`、一覧3種 (`announcements`, `exhibitions`, `topics`)、`(fullscreen)/map/page.tsx`、not-found。全て root の default title + 固定 description を継承。
- OGP 画像は静的ファイル・動的生成とも一切無し。`opengraph-image.*` / `twitter-image.*` 不在、`next/og` の `ImageResponse` 使用ゼロ。`public/images/favicon.png` のみ。
- `src/app/sitemap.ts` は `src/lib/phase.ts:29-41` の `PRE_EVENT_PUBLIC_PATHS` (11パス) + CMS のお知らせ詳細のみ列挙。企画詳細・トピック詳細・`/map` は未収録。`lastModified` / `changeFrequency` / `priority` 未設定。CMS 取得失敗時は静的パスのみで応答。
- `robots.ts` も `public/robots.txt` も不在。manifest も不在。
- JSON-LD (構造化データ) は一切無し。`ld+json` / `schema.org` の grep ヒットゼロ。
- CMS 側に SEO 専用フィールドは存在しない。`cms/src/collections/*.ts` と `cms/src/globals/*.ts` を `seo` / `meta_description` / `og_image` で grep してヒットゼロ。現状 description に使えるのは既存本文フィールド (`exhibitions.description` 等) のみ。
- `NEXT_PUBLIC_SITE_URL` の実使用は3箇所のみ: `layout.tsx:79` (metadataBase)、`sitemap.ts:7`、`exhibitions/[id]/[category]/page.tsx:119` (Web Share の共有 URL)。
- 各詳細ページは `generateMetadata` と page 本体で同じ CMS 取得関数を二重に呼ぶ構造 (Next.js の request memoization 前提)。`src/lib/cms.ts` には `revalidate` / `cache` / `next:` の指定が無く、fetch キャッシュは Next のデフォルト依存。

### 今回のスコープ (確定済み)

1. root layout に `openGraph` / `twitter` / `robots` / `alternates.canonical` を追加
2. トップ・一覧3種・マップページに個別の title + description を付与
3. `robots.ts` を新設 (sitemap 参照の宣言を含む)
4. sitemap を企画詳細・トピック詳細まで拡充、`lastModified` を設定
5. JSON-LD 構造化データを実装 (Event / Organization / BreadcrumbList)
6. Payload CMS の各コレクション・グローバルに SEO フィールド (meta description / OG 画像) を追加し、FE から参照する
7. リポジトリ同梱の静的な既定 OGP 画像を、CMS に OG 画像が無いときの共有画像として用いる

### スコープ外

- 既定 OGP 画像ファイルそのもののデザイン・制作 (WBS の別タスクで行う)。
- PWA manifest の追加。

### 制約

- CMS のコレクション/グローバル定義変更はマイグレーション生成 (`pnpm migrate:create`) と型再生成 (`pnpm generate:types`) を伴い、本番 DB に影響する。`cms-schema-check.yml` による破壊的変更検出の確認が必要。
- 新規フィールド追加は既存データに対して optional にする必要がある。

## Introduction

本 spec は、荒牧祭公式サイトのメタデータと SEO 基盤を整備する。現行サイトはページ固有の `<title>` と `description` をほとんど持たず、OGP・Twitter Card・`robots.txt`・構造化データのいずれも欠いている。この状態では、SNS で URL を共有しても内容の分かるカードが表示されず、検索エンジンにも祭典としての情報 (開催日・会場・主催) が伝わらない。

整備の対象は 3 層に分かれる。第一にフロントエンドの静的なメタデータ (root layout の既定値、各ページの `title` / `description`、`robots.ts`、sitemap)。第二に検索エンジン向けの機械可読な情報 (JSON-LD の Event / Organization / BreadcrumbList)。第三にコンテンツ編集者がメタデータを自分で制御するための CMS 側フィールド (meta description / OG 画像 / 会場住所) である。

本 spec の要件を定める上で、起票時の調査を超えて 2 つの事実が判明しており、これらは要件に織り込む。

1 つ目は **公開フェーズゲートとの相互作用**である。`frontend/src/lib/phase.ts` の `BUILD_PHASE` は現在 `'pre_event'` であり、`isPublicPath()` に合致しないパスは `frontend/src/middleware.ts` が `/gated` (または `/gated-fullscreen`) へ rewrite して 404 を返す。企画詳細・トピック詳細・`/map` は開催前フェーズでは到達不能である。したがって「sitemap を企画詳細・トピック詳細まで拡充する」という当初スコープをそのまま実装すると、404 を返す URL を検索エンジンへ申告することになる。sitemap と `robots.ts` は実効フェーズの公開範囲に従う必要がある。

2 つ目は **CMS に既存の未使用フィールドがある**ことである。`cms/src/globals/festival-meta.ts` は `site_title` フィールド (admin description: 「HTMLのtitleタグ用」) を既に持つが、`frontend/src/lib/festival-meta.ts:6-18` の `getFestivalMeta()` はこれを読み出しておらず、`layout.tsx` は `name` (祭名) をサイトタイトルに流用している。新規フィールドを追加する前に、この既存フィールドを正しく使うことが先である。

## Boundary Context

- **In scope**: root layout の既定メタデータ (`openGraph` / `twitter` / `robots` / `alternates.canonical`)、メタデータ未設定ページ (トップ・お知らせ一覧・企画一覧・トピック一覧・構内マップ) への `title` / `description` 付与、`robots.ts` の新設、`sitemap.ts` のフェーズ準拠と `lastModified` 対応、JSON-LD (Event / Organization / BreadcrumbList) の実装、`festival_meta.site_title` の利用開始、CMS への SEO フィールド (meta description / OG 画像 / 会場住所) 追加とマイグレーション、静的な既定 OGP 画像への参照、お知らせ・トピック詳細取得への公開済み条件の適用
- **Out of scope**: PWA manifest、既定 OGP 画像ファイルのデザイン・制作、公開フェーズの定義と切替機構そのもの (公開判定は参照するだけで変更しない)、各ページの本文・レイアウト・ビジュアルデザイン、CMS 取得結果の再検証 (キャッシュ) 方針の変更、Google Search Console / Bing Webmaster Tools への登録作業とサイト所有権確認タグの値の投入、多言語対応 (`hreflang`)、アナリティクス計測の変更
- **Adjacent expectations**: ページの公開可否は `frontend/src/lib/phase.ts` の `isPublicPath()` および `BUILD_PHASE` を唯一の判定源とする。本 spec はこの関数を変更せず参照のみ行う。CMS のコレクション/グローバル定義変更は `docs/cms-operations.md` の手順および `cms-schema-check.yml` のゲートに従う。画像 URL の生成は `frontend/src/lib/cms-asset-url.ts` の `toAssetUrl()` を用い、CMS 側の派生サイズ定義 (`cms/src/collections/media.ts` の `IMAGE_SIZES`) と整合させる。

## Requirements

### Requirement 1: サイト全体の既定メタデータ

**Objective:** As a SNS で荒牧祭の URL を共有する来場者, I want どのページを共有しても祭の名称と概要が分かるカードが表示されること, so that 共有先の相手がリンクを開く前に内容を判断できる

#### Acceptance Criteria

1. The root layout shall `openGraph` に `siteName` / `locale` (`ja_JP`) / `type` (`website`) / `url` / `title` / `description` / `images` を設定する
2. The root layout shall `twitter` に `card` (`summary_large_image`) / `title` / `description` / `images` を設定する
3. The root layout shall `robots` に検索エンジンのインデックスとリンク追跡の可否を明示する
4. The root layout shall サイトタイトルの取得元として `festival_meta.site_title` を用いる
5. If `festival_meta.site_title` が未設定である, then the root layout shall `festival_meta.name` (祭名) をサイトタイトルとして用いる
6. If `festival_meta.name` も取得できない, then the root layout shall `'荒牧祭'` をサイトタイトルとして用いる
7. The root layout shall 既定の `description` を `festival_meta` の概要情報から導出し、CMS 側に該当する値が無い場合に限り固定文字列へ退避する
8. The root layout shall `title.template` による `%s | <サイトタイトル>` の合成を維持する
9. While `NODE_ENV` が `development` である, the root layout shall サイトタイトルへの `【開発環境】` 前置を維持する
10. The frontend shall 各ページの `alternates.canonical` に、クエリパラメータを含まない正規 URL を設定する
11. The frontend shall メタデータ中の絶対 URL を `NEXT_PUBLIC_SITE_URL` から導出し、ハードコードされたホスト名を持たない

### Requirement 2: ページ固有の title と description

**Objective:** As a 検索結果から流入する利用者, I want 検索結果に表示されるページ名と説明文がページごとに異なること, so that 目的のページを検索結果の一覧から選び分けられる

#### Acceptance Criteria

1. The トップページ shall 自身の `title` と `description` を持つ
2. The お知らせ一覧ページ shall 自身の `title` と `description` を持つ
3. The 企画一覧ページ shall 自身の `title` と `description` を持つ
4. The トピック一覧ページ shall 自身の `title` と `description` を持つ
5. The 構内マップページ shall 自身の `title` と `description` を持つ
6. The お知らせ詳細ページ shall `title` に加えて `description` と `openGraph` を持つ
7. The トピック詳細ページ shall `title` に加えて `description` と `openGraph` を持つ
8. The 固定ページ (`pages` コレクション) shall `title` に加えて `description` と `openGraph` を持つ
9. Where 一覧ページがクエリパラメータ (ページ番号・絞り込み条件) を受け取る, the 一覧ページ shall `alternates.canonical` にクエリパラメータを含まない URL を設定する
10. If CMS から本文を取得できない, then the 詳細ページ shall 既定の `description` へ退避し、メタデータの生成で例外を送出しない
11. The 各ページ shall `description` の長さを検索結果で切り詰められにくい範囲に収める

### Requirement 3: クロール制御 (robots)

**Objective:** As a サイト運営者, I want 検索エンジンにクロールしてよい範囲と sitemap の所在を明示すること, so that 未公開のページが検索結果に現れず、公開済みのページは確実に発見される

#### Acceptance Criteria

1. The frontend shall `robots.ts` によって `/robots.txt` を配信する
2. The robots 応答 shall `sitemap` ディレクティブで sitemap の絶対 URL を宣言する
3. While `BUILD_PHASE` が `pre_event` である, the robots 応答 shall `isPublicPath()` が公開と判定しないパスをクロール対象から除外する
4. The robots 応答 shall ゲート時の rewrite 先 (`/gated`, `/gated-fullscreen`) をクロール対象から除外する
5. The robots 応答 shall 公開フェーズの判定に `frontend/src/lib/phase.ts` の既存 API を用い、公開パスの一覧を独自に再定義しない
6. Where 公開フェーズが `live` である, the robots 応答 shall サイト全体をクロール可能として宣言する

### Requirement 4: sitemap の拡充

**Objective:** As a 検索エンジンのクローラ, I want 公開中のページとその最終更新日時を一覧で取得できること, so that 更新されたページを優先して再クロールできる

#### Acceptance Criteria

1. The sitemap shall 実効フェーズにおいて `isPublicPath()` が公開と判定するページのみを列挙する
2. The sitemap shall 列挙する各エントリに `lastModified` を設定する
3. The sitemap shall お知らせ詳細の `lastModified` を当該レコードの更新日時から導出する
4. Where 公開フェーズが企画詳細を公開する, the sitemap shall 企画詳細の URL を列挙する
5. Where 公開フェーズがトピック詳細を公開する, the sitemap shall トピック詳細の URL を列挙する
6. Where 公開フェーズが構内マップを公開する, the sitemap shall 構内マップの URL を列挙する
7. The sitemap shall 未公開 (`published_at` 未設定) のレコードに対応する URL を列挙しない
8. If CMS からの取得に失敗する, then the sitemap shall HTTP 500 を返さず、取得できた範囲で応答する
9. The sitemap shall 固定ページ (`pages` コレクション) について、`PRE_EVENT_PUBLIC_PATHS` に列挙された slug のみを対象とし、コレクション全件を展開しない

### Requirement 5: 構造化データ (JSON-LD)

**Objective:** As a 検索エンジン経由で祭の開催情報を探す利用者, I want 検索結果に開催日・会場・主催者が構造化されて表示されること, so that サイトを開かずに開催の概要を把握できる

#### Acceptance Criteria

1. The トップページ shall schema.org の `Event` 型の JSON-LD を出力する
2. The `Event` JSON-LD shall 開催日程を `festival_meta.event_days` から導出し、`startDate` と `endDate` に設定する
3. The `Event` JSON-LD shall 会場を `festival_meta.venue_name` と `festival_meta.venue_address` から導出して `location` に設定する
4. The `Event` JSON-LD shall 祭の名称・説明・代表画像・公式サイト URL を設定する
5. The frontend shall schema.org の `Organization` 型の JSON-LD で荒牧祭実行委員会を記述する
6. Where `festival_meta.sns_links` に値がある, the `Organization` JSON-LD shall それらを `sameAs` に列挙する
7. The 詳細ページ (お知らせ・トピック・企画・固定ページ) shall schema.org の `BreadcrumbList` 型の JSON-LD でトップページからの階層を出力する
8. If JSON-LD の生成に必要な CMS の値が取得できない, then the frontend shall 当該プロパティを省略し、JSON-LD 全体の出力を中止しない
9. The JSON-LD shall 構造化データテストツールで検証したときに、対象の型に対する必須プロパティの欠落による重大なエラーを生じない
10. The JSON-LD shall CMS から取得した文字列を埋め込む際に、スクリプト要素を閉じる文字列の混入を無害化する

### Requirement 6: CMS の SEO フィールド

**Objective:** As a 実行委員会のコンテンツ編集者, I want 各ページの説明文と共有画像を CMS から設定できること, so that 開発者の手を借りずに SNS での見え方を調整できる

#### Acceptance Criteria

1. The CMS shall `festival_meta` にサイト既定の meta description を保持するフィールドを持つ
2. The CMS shall `festival_meta` にサイト既定の OG 画像を保持する `media` への upload フィールドを持つ
3. The CMS shall `announcements` / `topics` / `pages` の各コレクションにページ固有の meta description を保持するフィールドを持つ
4. The CMS shall `announcements` / `pages` の各コレクションにページ固有の OG 画像を保持する upload フィールドを持つ
5. The 新規に追加するフィールド shall 全て optional であり、既存レコードに対する必須化を行わない
6. The CMS shall 追加するフィールドに日本語の `label` と、編集者向けの用途説明を付す
7. The CMS shall コレクション/グローバル定義の変更に対応する差分マイグレーションを持ち、`cms/src/migrations/index.ts` に登録する
8. The CMS shall 定義変更後に `pnpm generate:types` を実行し、`frontend/src/cms-types.ts` を含む生成物を同期した状態で commit する
9. The frontend shall ページ固有の meta description が設定されている場合にそれを優先して用いる
10. If ページ固有の meta description が未設定である, then the frontend shall 本文またはサイト既定値から `description` を導出する
11. The frontend shall OG 画像の URL を `toAssetUrl()` によって生成し、CMS の配信エンドポイントを指す絶対 URL とする
12. The 本 spec の変更 shall `cms-schema-check.yml` が破壊的変更として検出しない範囲に収まる
13. The CMS shall `festival_meta` に構造化データ用の会場住所を保持する optional なテキストフィールドを持つ (値はコードに埋め込まず、CMS へのデータ入力で投入する)

### Requirement 7: 既定 OGP 画像

**Objective:** As a SNS で個別ページを共有する来場者, I want 専用画像を持たないページでも荒牧祭と分かる画像が表示されること, so that 共有カードが画像欠けにならず内容が伝わる

#### Acceptance Criteria

1. The frontend shall リポジトリに同梱した静的な既定 OGP 画像を参照し、その URL を `NEXT_PUBLIC_SITE_URL` 基準の絶対 URL として出力する
2. The frontend shall 既定 OGP 画像を OGP の推奨寸法 (1200×630) として `openGraph.images` に幅・高さを宣言する
3. The frontend shall OG 画像を ページ個別の画像 → `festival_meta.og_image` → 静的既定画像 の順に採用する
4. If ページ個別の画像と `festival_meta.og_image` がいずれも設定されていない, then the frontend shall 静的既定画像を `openGraph.images` と `twitter.images` に用いる
5. If 静的既定画像ファイルがリポジトリに未配置である, then the frontend shall ビルドとページ描画を失敗させない
6. The 開発チーム shall PR プレビュー URL 上で各ページの `og:image` / `twitter:image` が期待する URL を指すことを確認する

### Requirement 8: CMS 障害時の縮退とメタデータの検証

**Objective:** As a サイト運営者, I want CMS が応答しない間もページが妥当なメタデータを返すこと, so that 障害時に検索結果や共有カードが壊れた状態で固定されない

#### Acceptance Criteria

1. If CMS からの取得に失敗する, then the frontend shall メタデータ生成で例外を送出せず、既定値でページを描画する
2. The frontend shall メタデータ取得の失敗を本文の描画失敗と切り離して扱い、片方の失敗が他方を巻き込まない
3. The frontend shall メタデータ生成のためだけに CMS への追加の往復を増やさず、ページ本体と同じ取得関数を用いる
4. The 開発チーム shall メタデータを持つ各ページに対し、期待する `title` / `description` / `openGraph` が生成されることを検証するテストを持つ
5. The 開発チーム shall `robots.ts` と `sitemap.ts` について、公開フェーズごとの出力内容を検証するテストを持つ
6. The 開発チーム shall CMS 取得失敗時にメタデータが既定値へ退避することを検証するテストを持つ
7. The frontend shall 本 spec の変更後も `pnpm type-check` / `pnpm lint` / `pnpm test` / `pnpm build` を通過する
8. If お知らせ・トピックの詳細取得の対象レコードが未公開 (`published_at` が未設定または未来日時) である, then the frontend shall 当該レコードを取得できなかったものとして扱い、詳細ページは not found を返し、メタデータは既定値で生成する
9. The お知らせ・トピックの詳細取得 shall 一覧取得と同じ公開済み条件を用い、公開済み判定を別途再定義しない
