# Gap Analysis: nightly-dev-integration

## 1. 現状調査

### ブランチ状態

- 作業ブランチ `nightly` は `origin/nightly` を追跡。`git log nightly..dev` は空であり、**`nightly` は `dev` の全コミットを含む**。要件 1-5 の「`dev` の最新内容を取り込む」作業は現時点で不要。
- `nightly` 単体の品質ゲートは全て通過する (`type-check` / `lint` / `format:check` OK、`vitest` 46 ファイル 212 テスト全通過)。したがって本 spec の作業は「壊れたビルドの修復」ではなく、**意味的な重複と Directus 連携の回帰を解くこと**が主眼となる。

### 既存の Directus 連携資産 (`dev` 由来、`nightly` にも存在)

| 資産 | 実装 | 状態 |
|---|---|---|
| `getHomePage()` | `src/lib/home-page.ts` | 稼働中 (`page.tsx` が使用) |
| `getFestivalMeta()` | `src/lib/festival-meta.ts` | 稼働中 (`/about` が使用) |
| `getSnsLinks()` | `src/lib/sns-links.ts` | **呼び出し元消失** (`Footer` がハードコードへ移行したため実質デッドコード) |
| `getPageBySlug()` | `src/lib/static-page.ts` | 稼働中 (`/[slug]` catch-all が使用) |
| `toAssetUrl()` | `src/lib/directus-asset-url.ts` | `page.tsx` からの参照が消えた (他ページでは使用継続) |
| `SnsIcon` | `src/components/sns-icon.tsx` | `x` / `twitter` / `instagram` / `facebook` / `youtube` / `tiktok` / `line` に対応済み |

### 関連スキーマ (`directus/schema/snapshot.yaml`)

- `page_home`: `id`, `hero_message` (text), `hero_images` (alias → `page_home_files` 経由の M2M)
- `festival_meta`: `id`, `name`, `event_days` (json), `parking_map` (uuid), `sns_links` (json), `overview` (text), `hero_image` (uuid)
- `pages`: `id`, `slug`, `title`, `content` (text), `embed_url` (string), `embed_height` (integer), `sort`

### 既存ルート

`/` `/about` `/announcements` `/announcements/[id]` `/topics` `/topics/[id]` `/[slug]` (catch-all, `pages` collection) と、`nightly` が追加した `/privacy-policy`。

---

## 2. Requirement-to-Asset Map

### R1: nightly デザイン差分の dev への反映

| 必要な技術要素 | 既存資産 | ギャップ |
|---|---|---|
| デザイン差分そのもの | `nightly` の 27 ファイル | 反映済み (作業ブランチが `nightly` のため) |
| `dev` 側 Directus 連携の非退行 | 上表の lib 群 | **Constraint**: `HeroSection` は props を全廃し `'use client'` 化。`Footer` は `async` サーバーコンポーネントから同期コンポーネントへ変更。両者とも Directus 由来データを受け取る口が塞がっている |
| `nightly` → `dev` PR | — | Missing: PR 未作成 |

**最重要の発見 (実害あり)**: `nightly` の `src/app/page.tsx` は `AboutSection` (静的な概要文・開催日程・テーマ) を描画した直後に、同じ情報を Directus から取得して描画する `FestivalOverview` (`festival_meta.event_days`) と `FestivalSummary` (`festival_meta.overview`) を条件付きで描画している。**開催日程と祭概要が静的版と Directus 版で二重表示される**。既存テストはこの二重描画を「既存の Directus コンテンツも維持する」ものとして通してしまっており、検出できていない。

### R2: 静的コンテンツの棚卸しと管理先の決定

`nightly` が導入したハードコード要素の一次棚卸し (判定は design フェーズ):

| # | 要素 | 場所 | 既存の受け皿 | ギャップ |
|---|---|---|---|---|
| 1 | ヒーロー画像 5 点 | `hero-section.tsx` `HERO_IMAGES` | `page_home.hero_images` | 受け皿あり、静的化は**回帰** |
| 2 | 概要文 (5 段落) | `about-section.tsx` | `festival_meta.overview` | 受け皿あり、静的化は**回帰**かつ二重表示の原因 |
| 3 | 開催スケジュール (DAY1/DAY2 の日付・時刻) | `about-section.tsx` | `festival_meta.event_days` | 受け皿あり、静的化は**回帰**かつ二重表示の原因 |
| 4 | 会場名「群馬大学 荒牧キャンパス」 | `about-section.tsx` | なし | **Missing** |
| 5 | キャンパスマップ埋め込み URL | `about-section.tsx` `campusMapUrl` | `pages.embed_url` はあるが About セクション用の格納先はない (`festival_meta.parking_map` は uuid のファイル参照で別物) | **Missing** |
| 6 | 今年のテーマ (ラベル / テーマ語「万彩」/ メインビジュアル / 説明文) | `about-section.tsx` | なし | **Missing** |
| 7 | 昨年度来場者数・目標来場者数 | `about-section.tsx` (概要文とテーマ説明の両方に散在) | なし | **Missing** (同じ数値が 2 箇所に重複記載されている点も要整理) |
| 8 | プライバシーポリシー本文 | `app/privacy-policy/page.tsx` | `pages` collection + `/[slug]` | 受け皿あり、静的化は**回帰** |
| 9 | ヘッダー / フッターのナビゲーション項目 | `header.tsx` / `footer.tsx` | なし | コード管理が妥当と思われる (判定は design) |
| 10 | SNS リンク 3 件 | `footer.tsx` `socialLinks` | `festival_meta.sns_links` + `getSnsLinks()` + `SnsIcon` | 受け皿あり、静的化は**回帰** |
| 11 | お問い合わせフォーム URL (Google Forms) | `footer.tsx` `contactFormUrl` | なし | **Missing** |
| 12 | コピーライト表記 | `footer.tsx` | なし | コード管理が妥当と思われる |
| 13 | 住所・メールアドレス | (`dev` 版 `footer.tsx` に存在したが `nightly` で削除) | なし | **Constraint**: 表示要否そのものが判断対象 |

### R3: ヒーロー画像の Directus 管理への復帰

| 必要な技術要素 | 既存資産 | ギャップ |
|---|---|---|
| 画像取得と並び順 | `home-page.ts` の `HERO_IMAGES_DEEP_FIELDS` (`hero_images.sort` でソート済み) | 受け皿あり |
| URL 生成 | `toAssetUrl()` | 受け皿あり |
| スライドショー UI | `hero-section.tsx` (`'use client'`, 自動送り / 前後ナビ / `motion-reduce` 対応) | **Constraint**: クライアントコンポーネントのため、サーバー側で取得した URL 配列を props で渡す形へ戻す必要がある |
| フォールバック | `page.tsx` の try/catch は `content = null` で Directus 領域のみ非表示にする方針 | **Unknown**: 画像 0 件時にセクションごと非表示にするか、静的既定画像を残すかは未決定 |

### R4: 固定ページの重複解消

- `/privacy-policy` (静的、`nightly` 追加) と `/[slug]` catch-all 経由の `pages` レコード (旧 `Footer` は `/privacy` を指していた) が併存しうる。
- **Unknown**: 本番 Directus の `pages` collection に `privacy` レコードが実在するかは未確認 (staging はアクティブ PR がない期間サスペンドされるため確認タイミングに注意)。
- **Constraint**: `pages.content` は `RichText` (サニタイズ済み) でレンダリングされる。`nightly` のプライバシーポリシーは見出し階層・リスト・区切り線を含む構造化されたレイアウトであり、`StaticPageView` に載せ替えると視覚的表現が単純化される。

### R5: ナビゲーションとサイト共通要素の整合性

| ナビ項目 | リンク先 | 実在するか |
|---|---|---|
| TOP | `/` | あり |
| 荒牧祭について | `/#about` | あり (ページ内アンカー) |
| 企画を探す | `/events` | **なし** |
| 会場案内 | `/guide` | **なし** |
| 協賛企業 | `/sponsors` | **なし** |
| お知らせ | `/news` | **なし** (実在するのは `/announcements`) |
| (サブ) 概要 / 開催スケジュール / 今年のテーマ | `/#about-overview` 他 | あり |

- **Constraint**: `/[slug]` catch-all が存在するため、これらは静的な 404 ではなく「`pages` collection にレコードがあれば 200、なければ `notFound()`」という挙動になる。つまり **`pages` にレコードを投入するだけでもリンク切れは解消しうる**。
- **Constraint**: ヘッダー・フッターの双方から `/about` へのリンクが消え、既存の `/about` ページ (`festival_meta` ベース) がナビゲーションから孤立している。廃止するのか残すのかの判断が必要。
- **Constraint**: `Header` / `Footer` はともに `'use client'` 化・同期化されており、Directus から取得した SNS リンクを表示するには、サーバーコンポーネントでの取得 + props 受け渡し、またはクライアント側フェッチのいずれかへの設計変更が必要。

### R6: 静的画像アセットの整理

- `frontend/public/images` の合計は **25MB**。内訳の主なもの: `top1.png` 7.5MB、`background1.png` 5.8MB、`top3.png` 4.1MB、`top2.png` 3.3MB、`top4.png` 2.3MB、`top0.png` 1.7MB。
- ヒーロー画像 5 点 (計 18.9MB) は R3 で Directus 管理へ移せば削除対象。`background1.png` (テーマのメインビジュアル) は R2#6 の判定に連動する。
- **Constraint / Research Needed**: `about-section.tsx` は `next/image` を使用している。一方で `dev` 側の既存コンポーネント (`hero-section.tsx`, `header.tsx`, `app/about/page.tsx`) は `/* eslint-disable @next/next/no-img-element */` を付けた素の `<img>` を使う慣習であり、`next.config.ts` に画像関連の設定はない。`@opennextjs/cloudflare` 環境での `next/image` の最適化がどう振る舞うか (Workers 上での最適化可否、`unoptimized` の要否) は design フェーズで確認が必要。
- **Unknown**: 画像サイズ上限方針 (要件 6-3) の具体値と、その強制手段 (pre-commit / CI) は未決定。

### R7: テストによる回帰防止

- テスト配置の慣習は確立済み (対象と同階層の `*.test.tsx`、46 ファイル 212 テスト)。
- **Constraint**: `nightly` の `src/app/page.test.tsx` は現在の二重表示を正常系として検証している。R1 の重複解消に伴い、このテストの期待値自体を書き換える必要がある。
- **Missing**: ナビゲーション項目が実在ルートを指すことを検証するテスト (要件 7-4) は存在しない。App Router のルート一覧とナビ定義を突き合わせる仕組みが必要。

### R8: スキーマ変更の安全性

- **Constraint**: `additive-schema-check.yml` は `sitemap-schema-review` spec により一時停止中 (`if: false`)。機械的な強制がない状態のため、additive-only は人手のレビューで担保する必要がある。
- **Constraint**: 新規フィールドを公開読み取りさせるには `directus/migrations/` の RBAC migration が必要で、適用後に Directus の再起動 (`rollout restart`) を要する (権限キャッシュが更新されないため)。
- **Constraint**: staging Directus はアクティブな PR がない期間サスペンドされるため、事前検証は `directus-schema-*` PR が open な状態で行う必要がある。
- **Adjacent**: `sitemap-schema-review` spec が既存 6 collection のフィールド削除・統合・`page_home_live` 廃止を所有している。本 spec でのフィールド追加は、そちらの再設計方針と衝突しないか確認が必要。

---

## 3. 実装アプローチの選択肢

### Option A: 最小限の回帰解消 (受け皿がある要素だけ Directus へ戻す)

既存スキーマに受け皿がある 4 要素 (ヒーロー画像 / 概要文 / 開催スケジュール / SNS リンク / プライバシーポリシー) のみを Directus 管理へ戻し、受け皿のない要素 (テーマ・マップ URL・お問い合わせ URL 等) は静的のまま残す。二重表示は、静的な `AboutSection` 側の該当ブロックを Directus 由来のデータで描画し直すことで解消する。

- **変更対象**: `hero-section.tsx` (props 復活)、`footer.tsx` (SNS を props 化)、`about-section.tsx` (概要文・日程を props 化)、`page.tsx` (二重描画の除去)、`app/privacy-policy/` (削除 or `pages` へ移行)
- **スキーマ変更**: なし
- ✅ スキーマ変更ゼロのため staging 検証・RBAC migration・additive-only の懸念が発生しない
- ✅ 既存 lib (`getHomePage` / `getSnsLinks` / `getPageBySlug`) をそのまま再利用でき、新規実装がほぼない
- ❌ テーマ・マップ URL・お問い合わせ URL 等が引き続きコード管理となり、要件 2 の「運営者が自ら編集する必要性」を満たさない可能性がある
- ❌ 「同じセクション内で一部は Directus、一部は静的」という混在状態が残り、運営者から見た編集場所が分かりにくい

### Option B: About セクション全面 CRUD 化 (スキーマを additive に拡張)

受け皿のない要素すべてに対して `page_home` または `festival_meta` へフィールドを追加し、`AboutSection` を完全に Directus 駆動にする。プライバシーポリシー・お問い合わせ URL も含め、コードに残すのはナビゲーション定義とコピーライトのみとする。

- **スキーマ変更**: `page_home` への追加 (例: `about_overview`, `theme_label`, `theme_word`, `theme_image`, `theme_description`, `venue_name`, `campus_map_url`, `contact_form_url`) + 公開読み取り RBAC migration
- ✅ 要件 2 を最も高い水準で満たす。コンテンツ更新にデプロイが不要になる
- ✅ 編集場所が Directus に一元化され、運営者への説明が単純になる
- ❌ 追加フィールド数が多く、`sitemap-schema-review` spec が進める collection 再設計と衝突するリスクがある
- ❌ `additive-schema-check.yml` が停止中のため、additive-only 違反を人手で見落とす余地がある
- ❌ テーマのメインビジュアルは Directus ファイルとなるため、`next/image` の最適化前提が崩れる (外部 URL 化への対応が必要)
- ❌ フィールド未投入時のフォールバック (要件 8-4) を全項目分設計・テストする必要があり、工数が跳ねる

### Option C: 段階導入 (推奨)

Option A を Phase 1 として先に確定させ、Option B の範囲を Phase 2 以降へ切り出す。

- **Phase 1 (回帰と不整合の解消、スキーマ変更なし)**
  1. 二重表示の解消 (`page.tsx` の構成整理)
  2. ヒーロー画像・SNS リンク・概要文・開催スケジュールの Directus 復帰
  3. プライバシーポリシーの一本化
  4. ナビゲーションのリンク切れ解消 (既存ルートへの張り替え or 一時非表示)
  5. ヒーロー静的画像の削除によるリポジトリ縮小 (-18.9MB)
- **Phase 2 (CRUD 化の拡張、スキーマ追加あり)**
  6. テーマ・会場名・マップ URL・お問い合わせ URL のフィールド設計と追加、RBAC migration、staging 検証
- **Phase 3 (整理)**
  7. 残存画像の最適化とサイズ上限方針、ナビゲーション整合性テストの追加
- ✅ Phase 1 は既存資産の再接続が中心で、スキーマ変更を伴わないため単独でマージ可能
- ✅ Phase 2 の設計時点で `sitemap-schema-review` の進捗を踏まえられ、スキーマ衝突リスクを下げられる
- ✅ 各 Phase が独立した PR となり、要件 1-4 のレビュー単位分割と整合する
- ❌ Phase 1 完了時点では一部コンテンツが静的のまま残り、暫定状態が一定期間続く
- ❌ Phase を跨ぐ計画・追跡のコストが発生する

---

## 4. 工数とリスク

| Phase / Option | Effort | Risk | 根拠 |
|---|---|---|---|
| Option A (= Phase 1) | **M** (3–7 日) | **Low** | 既存 lib の再接続が中心。`'use client'` 化されたコンポーネントへの props 受け渡し設計と、既存テストの期待値書き換えが主な作業 |
| Option B | **L** (1–2 週間) | **Medium** | 多数のフィールド追加・RBAC migration・staging 検証・全項目のフォールバック設計を伴う。`sitemap-schema-review` との調整も必要 |
| Option C 全体 | **L** (1–2 週間) | **Low〜Medium** | Phase 1 が Low、Phase 2 が Medium。段階分割により各時点のリスクは抑えられる |

---

## 5. Design フェーズへの申し送り

### 採用された方針

**Option C (段階導入)** を採用。あわせて以下が確定している。

- `nightly` が `dev` から削除した要素は、削除を採用せず保持する (リジェクト)
- 既存スキーマで受けられるコンテンツは Directus へ登録する。投入対象を一覧化した上で、管理画面の手作業または REST API で投入する (要件 9)
- 既存スキーマに受け皿のない要素 (テーマ・スローガン等) は additive なフィールド追加で対応し、Phase 2 として本 spec 内で扱う
- 二重表示は **`nightly` のレイアウトを維持し、データを Directus (`festival_meta`) から供給する**形で解消する。`page.tsx` からは `FestivalOverview` / `FestivalSummary` の直接描画を外す (コンポーネント自体は `/about` で引き続き使用)。事前告知フェーズと直前〜当日フェーズは同時に表示されないため、フェーズごとの内容は単一の経路で描画する

### 追加で確定した方針

- Directus データの供給方式は `dev` 側の仕様を採用する (サーバーコンポーネントで取得し、表示コンポーネントへ props で渡す)。`HeroSection` / `Footer` は `nightly` で `'use client'` 化・同期化されているため、データを受け取る境界の切り分けが必要になる
- 開催日程の表示形式は `MM月DD日 HH:mm〜HH:mm` とする (`nightly` の `2026.11.14 SAT` / `10:00 — 17:30` 形式は採用しない)
- 追加フィールドの配置は `dev` 側の使い分け (`page_home` = ホームページ固有、`festival_meta` = 祭全体のメタ情報) に従う
- `/about` ルートは廃止し、ホームページの `#about` へ一本化する (「削除をリジェクトして保持」方針の例外)
- プライバシーポリシーは `pages.content` の WYSIWYG へ統合し、静的な `src/app/privacy-policy/` はテストごと削除する

### Design で決めるべき主要事項

1. `'use client'` 境界の切り分け。`HeroSection` はスライドショーの状態管理、`Footer` は SNS リンク表示のためにサーバー取得データを必要とする。どこまでをサーバーコンポーネントとして残すか
2. `AboutSection` における「静的レイアウト + Directus コンテンツ」の分担境界。`festival_meta.event_days` (`label` / `open` / `close`) から `MM月DD日 HH:mm〜HH:mm` を組み立てる際の変換責務の置き場所 (lib か表示コンポーネントか)
3. Phase 2 で `page_home` へ追加するフィールドの粒度と命名 (テーマ語・スローガン・メインビジュアル・説明文をどう分割するか)
4. 未実装ルート (`/events` `/guide` `/sponsors` `/news`) の解消方針 (既存ルートへの張り替え / 一時非表示 / `pages` レコード投入)
5. `/about` **ルート**廃止に伴う影響範囲。`festival_meta` collection と `getFestivalMeta()` は存続し、ホームページの `#about` セクションのデータ源として使い続ける。決めるのは `app/about/` 削除後に `getFestivalMeta()` をどこから呼ぶか、および `FestivalOverview` / `FestivalSummary` を `AboutSection` へ取り込むか独立コンポーネントとして残すか
6. 画像サイズ上限の具体値と強制手段
7. Directus 投入作業の実施手段 (管理画面の手作業と REST API の使い分け、再現可能な形での記録方法)

### Research Needed

- `@opennextjs/cloudflare` 環境における `next/image` の最適化挙動と、Directus 配信画像 (外部 URL) を扱う際の設定要否
- 本番 Directus の `pages` collection における `privacy` レコードの実在有無、および `festival_meta.overview` / `event_days` の投入状況 (静的コンテンツと内容が一致するか)
- `sitemap-schema-review` spec が確定させる `page_home` / `festival_meta` の再設計方針 (Phase 2 のフィールド追加先に影響)
- ナビゲーション整合性テストの実現方式 (App Router のルート一覧を静的に列挙する手段)
