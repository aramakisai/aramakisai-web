# Gap Analysis: festival-phase-gate

requirements.md の各要件に対して、既存コードベースに何があり何が無いかを整理する。実装方針は確定させず、選択肢とトレードオフを提示する。

## 分析サマリ

- フェーズ切替に転用できる既存資産はほぼ無い。`middleware.ts` / `sitemap.ts` / `robots.txt` はいずれも存在せず、フェーズ判定・公開範囲制御・Cookie 読取のすべてを新規に作る必要がある。
- 一方で阻害要因も少ない。`next.config.ts` は空で、`dynamic` / `revalidate` / `generateStaticParams` / `unstable_cache` の指定がコードベース全体でゼロ。`src/lib/cms.ts:82` の `fetch` もキャッシュ指定なしのため、**全ページが既に毎リクエスト動的レンダリングされている**。middleware と Cookie 読取を足しても、新たにレンダリング戦略が悪化する余地がない。
- 逆に、その「キャッシュ機構が無い」事実が R9-6 (CMS 到達不可時に直近値で継続) の直接の障害になる。直近値を保持する層そのものが存在しない。
- robots は Next.js 側にも Cloudflare 側にも**一切存在しない** (詳細は後述)。「Cloudflare のスコープ」という整理は現状の実態を指してはいない。
- 静的アセットは既定で middleware を通らない。`frontend/wrangler.toml:16-17` の `[assets]` に `run_worker_first` 指定が無いため、`public/map-tiles/**` 等はゲートの対象外として公開され続ける。

## 1. 現状調査

### 1.1 ルーティング資産

`frontend/src/app/` の全 `page.tsx` (route group は URL に現れない):

| ルート | ファイル | 種別 |
|---|---|---|
| `/` | `src/app/(site)/page.tsx` | 固定 |
| `/announcements` | `src/app/(site)/announcements/page.tsx` | 固定 |
| `/announcements/[id]` | `src/app/(site)/announcements/[id]/page.tsx` | 動的 |
| `/topics` | `src/app/(site)/topics/page.tsx` | 固定 |
| `/topics/[id]` | `src/app/(site)/topics/[id]/page.tsx` | 動的 |
| `/exhibitions` | `src/app/(site)/exhibitions/page.tsx` | 固定 |
| `/exhibitions/[id]/[category]` | `src/app/(site)/exhibitions/[id]/[category]/page.tsx` | 動的 |
| `/[slug]` | `src/app/(site)/[slug]/page.tsx` | 動的 (`pages` コレクションの slug) |
| `/map` | `src/app/(fullscreen)/map/page.tsx` | 固定 |

`(site)` と `(fullscreen)` の 2 つのレイアウトがあり、前者のみ `Header` / `Footer` を持つ (`src/app/(site)/layout.tsx:11,13`)。

### 1.2 現行ナビゲーションの導線 (allowlist 候補の根拠)

- ヘッダー (`src/components/header.tsx:19-32`): `/`、`/#about` (同一ページ内アンカー、子項目も同様)、`/announcements`、`/access`
- ヘッダーのロゴリンク (`src/components/header.tsx:76`): `/`
- フッター (`src/components/footer.tsx:7-11`): `/`、`/#about`、`/announcements`
- フッターのサポート欄 (`src/components/footer.tsx:87`): `/privacy`、および `festival_meta.contact_form_url` の外部リンク (`src/components/footer.tsx:75`)
- トップページ本体 (`src/app/(site)/page.tsx:46`) → `AnnouncementsList` が `/announcements/[id]` と `/announcements` へリンク (`src/components/announcements-list.tsx:45,53,65`)
- トップページ本体 (`src/app/(site)/page.tsx:57`) → `TopicsList` → `TopicCard` が `/topics/[id]` へリンク (`src/components/topic-card.tsx:35,39,47`)

**ナビゲーションから到達できないルート**: `/exhibitions`、`/exhibitions/[id]/[category]`、`/map`、`/topics` (一覧)。

なお `src/components/header.tsx:17-18` に「企画一覧・会場案内・協賛企業は対応ページが未実装のため一時的に非表示。ページ実装後は navigationItems へ戻す」というコメントがある。これは本 spec が機構として解決しようとしている問題を、現在ナビ定義の手作業コメントアウトで回避している状態を示す。

### 1.3 `/access` と `/privacy` の解決経路 (重要な制約)

両者は専用ファイルを持たず、`src/app/(site)/[slug]/page.tsx` の動的ルートが `pages` コレクションの slug で解決する。したがって**ルートパターン単位の allowlist では `pages` コレクションの全 slug が一括で公開されてしまう**。R2-5 (動的パスへの適用) を満たすには、許可を slug の実値で列挙する必要がある。

### 1.4 存在しないもの (Missing)

- `frontend/middleware.ts` / `frontend/src/middleware.ts` — 無し
- `src/app/sitemap.ts` / `public/sitemap.xml` — 無し
- `src/app/robots.ts` / `public/robots.txt` — 無し
- `cookies()` / `draftMode()` / `localStorage` / `sessionStorage` の利用箇所 — `src/` 全体でゼロ
- フェーズ・variant に類する CMS フィールド — `cms/src/globals/festival-meta.ts:7-97` のフィールド一覧に該当なし
- `page_home_live` 相当のグローバル — `cms/src/globals/index.ts:15` の登録は `FestivalMeta` と `PageHome` の 2 つのみ

### 1.5 レンダリングとキャッシュの現状

- `frontend/next.config.ts:7` — `const nextConfig: NextConfig = {}` (設定ゼロ)
- `frontend/open-next.config.ts:3` — `defineCloudflareConfig()` を引数なしで呼ぶのみ。incremental cache のバックエンド (R2/KV) は未設定
- `src/` 全体で `export const dynamic` / `export const revalidate` / `generateStaticParams` / `unstable_cache` / `next: { revalidate }` / `cache:` の指定がゼロ
- `src/lib/cms.ts:82` — `fetch(...)` にキャッシュ指定なし

→ Next.js 15 の既定でキャッシュされず、データを取得する全ページが毎リクエスト動的に描画される。**middleware と Cookie 読取を追加してもレンダリング戦略上の劣化は発生しない**。これは R4/R5 の Cookie 方式にとって有利な前提。

同時に、**直近取得値を保持する層が存在しない**ため R9-6 は新規実装を要する。

`festival_meta` は 1 リクエスト中に複数回取得されている (`src/app/layout.tsx:18` の `generateMetadata`、`src/lib/home-page.ts:15`、`src/lib/festival-meta.ts:6,19`)。middleware でフェーズを引くとさらに 1 回増える。重複排除の要否は設計判断。

### 1.6 環境変数と本番除外の既存パターン

- `src/env.ts:4-16` — `@t3-oss/env-nextjs` + zod。`client` ブロックのみで `server` ブロックは無い。登録済みは `NEXT_PUBLIC_CMS_URL` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_GA_MEASUREMENT_ID` の 3 つ
- `src/app/layout.tsx:53` — `process.env.NODE_ENV === 'production' && gaMeasurementId` で GA タグを本番限定にする既存パターンあり
- ただし **`NODE_ENV` は preview / dev / prod のいずれのデプロイでも `production`** になる。`NODE_ENV` 単独では本番と検証環境を区別できないため、R7 には専用の環境変数が必要

ビルド時の env 注入経路が 3 系統に分かれている点が制約:

| デプロイ | 注入元 | 根拠 |
|---|---|---|
| PR プレビュー | Infisical `--env=staging` | `.github/workflows/frontend-ci.yml:123` |
| dev (dev.aramakisai.com) | ワークフロー内にベタ書き | `.github/workflows/frontend-ci.yml:273-275` |
| 本番 | Infisical `--env=prod` | `.github/workflows/frontend-ci.yml:323` |

→ 検証環境だけでフラグを有効にするには Infisical `staging` とワークフローのベタ書き env の **2 箇所**を触り、かつ Infisical `prod` に存在しないことを保証する必要がある。

### 1.7 404 の既存パターン

- `src/app/not-found.tsx` (ルート、ヘッダー/フッター無し) と `src/app/(site)/not-found.tsx` (サイトレイアウト内) の 2 つが存在。内容は同一
- `notFound()` は既に 6 箇所で使用 (`src/app/(site)/[slug]/page.tsx:25`、`src/app/(site)/announcements/[id]/page.tsx:17,23`、`src/app/(site)/topics/[id]/page.tsx:17,23`、`src/app/(site)/exhibitions/[id]/[category]/page.tsx:116`)

→ コンテンツ不在時に 404 を返す作法は確立済み。ゲートもこれに合わせられる。ただし middleware は React を描画できないため、スタイル付き 404 を返すには工夫が要る (後述)。

### 1.8 OpenNext / Cloudflare の制約

- `@opennextjs/cloudflare` 1.20.1。middleware 専用のビルド経路を持つ (`node_modules/@opennextjs/cloudflare/dist/cli/build/utils/middleware.d.ts` の `useNodeMiddleware`)。Next.js の middleware はサポートされている
- **静的アセットは既定で middleware を通らない**。`asset-resolver` の説明によれば `run_worker_first` が `false` のときアセットは Next のルーティングを迂回して直接配信される (`node_modules/@opennextjs/cloudflare/dist/api/overrides/asset-resolver/index.d.ts:4-6`)。`frontend/wrangler.toml:16-17` の `[assets]` に `run_worker_first` の指定は無い
  → 開催前フェーズでも `public/map-tiles/**`、`public/images/**` は取得可能なまま。ページ本体を 404 にしてもアセットは隠れない (Constraint)
- Edge Runtime 制約により Node.js 専用 API は使用不可。`src/lib/app-routes.ts:1` は `node:fs` を import しているが、利用箇所はテストのみ (`src/components/header.test.tsx:10`、`src/components/footer.test.tsx:11`) でランタイムには載らない

### 1.9 CMS 側の変更コスト

- `festival_meta` は `cms/src/globals/festival-meta.ts` の単一ファイル。グローバルの読取は公開、更新は実行委員のみに結線済み (`cms/src/globals/index.ts:8-12`)
- フィールド追加は `cms/scripts/check-schema-changes.ts` の破壊的変更検出に**引っかからない**。`cms/scripts/collection-shape.test.ts:29-38`「フィールド追加は破壊的とみなさない」で明示的に担保されている
- 検出対象には globals も含まれる (`cms/scripts/check-schema-changes.ts:19,36` が `../src/globals/index.js` を読む)
- 手順は `pnpm migrate:create` → `cms/src/migrations/index.ts` へ登録 → `pnpm generate:types` (`frontend/src/cms-types.ts` も同時更新)

→ **任意フィールド 1 つの追加であれば CMS 側の変更コストは低い** (S)。

### 1.10 検証環境のアクセス制御 (R7-5 の前提)

`aramakisai-infra` の Terraform が Cloudflare Access で保護しているホスト:

- `dev.aramakisai.com` (`terraform/access.tf:56-65`)
- `aramakisai-web.aramakisai.workers.dev` (`terraform/access.tf:45-54`)
- `aramakisai-web-dev.aramakisai.workers.dev` (`terraform/access.tf:67-76`)

本番 `aramakisai.com` は Access 非保護 (公開サイトなので当然)。

**未確認点**: PR プレビュー URL は `https://<バージョンIDの先頭8文字>-aramakisai-web.aramakisai.workers.dev` という**バージョンごとに異なるホスト名** (`.github/workflows/frontend-ci.yml:136`)。Access アプリの `domain` は完全一致の文字列で指定されており、ワイルドカードの記述は無い。一方で e2e は CF Access のサービストークンヘッダを付けてプレビュー URL を叩いている (`frontend/playwright.config.ts:7-12`、`terraform/access.tf:114`) ため、実運用上は保護されていると見られる。**R7-5 はこの点の確認結果に依存する** (Research Needed)。

## 2. robots の管理場所 (実地確認結果)

**結論: robots は Next.js 側にも Cloudflare 側にも存在しない。現状どこも管理していない。**

- `frontend/` に `src/app/robots.ts`、`public/robots.txt` のいずれも無し
- `frontend/wrangler.toml` に robots に関する記述なし
- `aramakisai-infra` リポジトリ全体 (`*.tf` / `*.yaml` / `*.yml` / `*.md` / `*.txt`) を `robots` で検索してヒットゼロ

ただし Cloudflare 側に配信能力自体はある。`cloudflare_ruleset` が既に 2 件使われており (`terraform/cloudflare_cms_media_redirects.tf:50`、`terraform/cloudflare_media_cache.tf:15`)、Transform Rules / Redirect Rules で robots.txt をエッジから返すことは技術的に可能。

**整理**:
- 「Cloudflare のスコープ」は*現状の実態*ではなく、*そうすることもできる*という選択肢。どちらに置くかは未決の設計判断
- Cloudflare 側に置く場合、robots.txt の内容をフェーズに連動させるには Terraform の apply が必要になり、R1-3 (再デプロイを伴わずに反映) と両立しない
- Next.js 側 (`src/app/robots.ts`) に置けば CMS のフェーズ値を読んで動的に出し分けられる
- そもそも R8-3 (非公開ページがインデックスされない応答) は、決定 1 の「非公開時は 404」によって robots.txt 無しでも満たされる。404 はインデックス対象にならない

→ **robots.txt はフェーズゲートの必須要素ではない**。サイト全体の robots ポリシー (sitemap の場所の告知等) として欲しいかどうかは別問題であり、本 spec のスコープに含めるかは設計判断。

## 3. Requirement-to-Asset Map

タグ: **Missing** (存在しない / 新規実装) / **Unknown** (要調査) / **Constraint** (既存構造による制約)

| 要件 | 既存資産 | ギャップ |
|---|---|---|
| R1-1,2 フェーズ定義・CMS 単一設定 | `cms/src/globals/festival-meta.ts` | **Missing**: フィールド追加。ただし追加は非破壊で低コスト |
| R1-3 再デプロイなしで反映 | 全ページが毎リクエスト動的 (1.5) | 追加コストなしで満たせる |
| R1-7 反映の最大所要時間 | キャッシュ無しのため実質即時 | キャッシュを導入するなら時間の定義が必要 |
| R2-1,2 許可ページのみ提供 | 無し | **Missing**: ゲート機構そのもの |
| R2-3 一覧を単一定義で保持 | `header.tsx:19` / `footer.tsx:7` にナビ定義が分散 | **Constraint**: `full-site-design` R15 がナビ定義の一元管理を所有。allowlist をそこから導出するか独立させるかは要調整 |
| R2-4 新規ページは既定で非公開 | 無し | **Missing**: allowlist 方式なら自然に満たせる |
| R2-5 動的パスへの適用 | `(site)/[slug]/page.tsx` が `pages` の全 slug を解決 (1.3) | **Constraint**: ルートパターン単位では不可。slug の実値で列挙が必要 |
| R2-7 allowlist の確定 | 1.2 の導線一覧 | 決定 2 により `/topics/[id]` は除外。確定は design |
| R3-1,2 トップの出し分け | `page_home` グローバル単体 | **Missing**: 開催中向けトップの内容の持ち方が未定。Figma デザインは `full-site-design` が所有 |
| R3-3 同時切替 | 単一フラグなら自然に満たせる | — |
| R3-4 未実装時は既存トップ | `(site)/page.tsx` | 既存をそのまま使えばよい |
| R4-1〜5 オーバーライド | `cookies()` 利用箇所ゼロ | **Missing** |
| R5-1〜4 永続性・全ページ適用 | 無し | **Missing**: Cookie なら仕様上自然に満たせる |
| R6-1〜5 開発用 UI | 無し | **Missing**: 新規コンポーネント |
| R7-1〜4 本番非露出 | `layout.tsx:53` の NODE_ENV 分岐 | **Constraint**: `NODE_ENV` は全デプロイで `production`。専用の env 変数が必要 (1.6) |
| R7-5 アクセス制限環境限定 | `terraform/access.tf` | **Unknown**: プレビュー URL が Access 配下かの確認が必要 (1.10) |
| R7-6 自動テストで検証 | `vitest` + Playwright (`e2e/`) | 既存基盤で対応可 |
| R8-1,4 sitemap | 無し | **Missing**: 決定 3 により新規構築がスコープ入り |
| R8-2 OGP メタ情報 | `layout.tsx:15-39` の `generateMetadata` | 404 を返せば自動的に満たされる |
| R8-3 インデックス防止 | 無し | 404 で満たされる。robots.txt は必須でない (2.) |
| R9-1,2 未設定・不正値 | `cms.ts:15-22` の `CmsResult` 型 | **Missing**: 判定ロジック。型の下地はある |
| R9-3,4 到達不可時 | `(site)/page.tsx:12-16`、`footer.tsx:27-38` の try/catch で部分縮退する既存作法 | 作法は踏襲可能 |
| R9-6 直近値で継続 | **キャッシュ層が存在しない** (1.5) | **Missing**: 最大のギャップ。`full-site-design` R16 が再検証方針を所有しており境界調整が必要 |

## 4. 実装方針の選択肢

### 4.1 ゲートの設置場所

#### Option A: middleware に集約

`frontend/middleware.ts` を新設し、`matcher` で対象パスを絞った上でフェーズ判定と allowlist 照合を行う。

- ✅ 全ルートに一律で効く。ページの実装を 1 つも触らずに済む。R2-4 (default deny) が構造的に保証される
- ✅ Cookie 読取 (R4/R5) と同じ場所で完結する
- ✅ 全ページが既に動的なので、レンダリング戦略上の副作用がない (1.5)
- ❌ middleware は React を描画できない。スタイル付き 404 を返すには `NextResponse.rewrite` で `notFound()` を呼ぶルートへ流すか、素の 404 レスポンスを返すかを選ぶ必要がある
- ❌ middleware 内でフェーズを引くと全リクエストに CMS 往復が 1 回増える
- ❌ 静的アセットは通らない (1.8)

#### Option B: レイアウト / ページ側でゲートする

`(site)/layout.tsx` と `(fullscreen)/layout.tsx` でフェーズを判定し、非許可パスなら `notFound()` を呼ぶ。

- ✅ `notFound()` の既存作法 (1.7) にそのまま乗る。スタイル付き 404 がそのまま出る
- ✅ middleware という新しい層を増やさない
- ❌ レイアウトは `pathname` を直接受け取れない。判定材料の受け渡しに工夫が要る
- ❌ 新規ルートが別のレイアウト配下に作られると漏れる。R2-4 の default deny が構造的に保証されない
- ❌ Cookie オーバーライドを全ページに効かせる導線を別途用意する必要がある

#### Option C: middleware でゲート + ページ側で 404 描画 (ハイブリッド)

middleware は判定と `NextResponse.rewrite` のみを担い、描画は既存の `not-found.tsx` に委ねる。

- ✅ A の網羅性と B の描画品質を両立
- ✅ フェーズ判定結果をリクエストヘッダで下流へ渡せば、トップの出し分け (R3) とヘッダーのナビ出し分けにも同じ値を再利用でき、CMS 往復の重複を避けられる
- ❌ rewrite 先の設計とヘッダー受け渡しの規約を決める必要があり、planning のコストが最も高い

### 4.2 開発用オーバーライドの保持先

- **Cookie**: middleware から読める。ブラウザ再起動をまたいで残る (R5-2)。サイト全体に一括適用 (R5-1)。本命
- **クエリパラメータ**: そのページ限り。R5-1/R5-2 を満たさない。ただし Cookie を**設定する**入口としては有用
- **localStorage**: サーバ側から読めず、middleware でもレイアウトでも判定に使えない。R5 を満たせない

→ Cookie 一択に近い。クエリパラメータを Cookie 設定のトリガーとして併用するかは設計判断。

### 4.3 sitemap の生成方式 (決定 3)

- **`src/app/sitemap.ts`**: Next.js App Router の標準機能。`env.NEXT_PUBLIC_SITE_URL` (`src/env.ts:7`) を基点に組み立てられる。フェーズと allowlist を読んで出力対象を絞れば R8-1/R8-4 を満たす。動的ルートの URL 列挙には CMS からの一覧取得が要る
- **静的な `public/sitemap.xml`**: フェーズ連動も動的ルートの反映もできない。要件を満たさない

→ 実質 `sitemap.ts` 一択。論点は「動的ルート (`/announcements/[id]` 等) の URL を CMS から列挙するか、固定ルートのみにするか」。

### 4.4 開発用 UI の本番除外 (R7)

- `src/env.ts` の `client` ブロックに `NEXT_PUBLIC_*` の真偽フラグを追加し、`env` 経由で参照する (steering の `structure.md`「`process.env` を直接参照せず `src/env.ts` 経由」に従う)
- ビルド時にインライン展開されるため、未設定の本番ビルドでは分岐が定数 false となり、UI コンポーネントは tree-shaking の対象になりうる。ただし R7-4 (成果物にコードを含まない) を**保証**するには、ビルド成果物を走査する検証が要る
- 1.6 のとおり env の注入経路が 3 系統に分かれているため、有効化は 2 箇所への追加、無効の保証は Infisical `prod` 側の不在確認になる

## 5. 工数とリスク

| 区分 | 工数 | リスク | 根拠 |
|---|---|---|---|
| CMS フェーズフィールド追加 | S | Low | 任意フィールド 1 つ。非破壊と機械的に担保済み (1.9) |
| ゲート機構 (middleware + allowlist) | M | Medium | middleware はこのリポジトリで前例なし。ただし OpenNext のサポートは確認済み (1.8)。allowlist と `[slug]` の兼ね合い (1.3) が設計の勘所 |
| Cookie オーバーライド + 開発用 UI | S〜M | Low | 標準機能の範囲。R7-4 の保証方法だけ検討が要る |
| sitemap 新規構築 | S〜M | Low | 標準機能。動的ルートを含めるなら CMS 一覧取得の分だけ増える |
| R9-6 のキャッシュ機構 | M | **High** | 依存先が無い。`full-site-design` R16 と所有権が重なる。当日の可用性に直結する |
| **全体** | **M〜L** | **Medium** | 個々は標準機能の範囲。R9-6 と境界調整が不確実性の主因 |

## 6. requirements.md に反映が必要な差分

今回の決定により、以下が現行の requirements.md と食い違う。

1. **R8 の前提**: 「404 かリダイレクトか」は 404 に確定。R8-2/R8-3 は 404 によって自動的に満たされるため、受け入れ基準の書き方を見直せる
2. **R2-7 の allowlist**: `/topics/[id]` を除外することが確定。同時に、トップページからトピックスへの導線 (`src/components/topic-card.tsx:35`) との整合をどう取るかが新たな要件になる。以下のいずれかを選ぶ必要がある
   - 開催前トップではトピックス節自体を描画しない
   - 節は出すがカードをリンクにしない
   - `/topics/[id]` を allowlist に戻す (決定と矛盾するため不採用)
3. **sitemap のスコープ**: 現行の Boundary Context は「sitemap/robots の新規構築そのもの」を Out of scope としているが、決定 3 により sitemap は In scope へ移る。R8-1 の `Where sitemap を提供する` という条件付きも不要になる
4. **robots のスコープ**: 現状どこにも存在しない (2.)。404 で R8-3 が満たされるため、robots.txt を本 spec で作るかは改めて判断が要る。Out of scope のままとするなら、その根拠を「Cloudflare が持つから」ではなく「404 で要件が満たされるから」に書き換えるのが実態に合う
5. **トップページのデザイン**: 開催前・開催中それぞれのトップページの Figma デザインは `full-site-design` spec が所有する。本 spec はフェーズによる出し分けの機構のみを持ち、デザインの内容には踏み込まない (依存関係として記録)

## 7. design フェーズへの申し送り

### 決めるべきこと

1. **ゲートの設置場所** — 4.1 の A / B / C。404 の描画品質と default deny の保証をどう両立させるか
2. **allowlist の表現** — パスの静的な列挙か、`full-site-design` R15 のナビ定義からの導出か。`(site)/[slug]` の slug 実値をどう扱うか (1.3)
3. **開催前トップのトピックス節の扱い** — 6.2 の選択
4. **フェーズ値の取得回数** — middleware で引いた値を下流へ渡すか、各所で個別に引くか (1.5 のとおり `festival_meta` は既に 1 リクエストで複数回取得されている)
5. **R9-6 のキャッシュ** — 保持期間と保持場所。`full-site-design` R16 (再検証方針) との所有権の切り分け
6. **開発用フラグの env 変数名と注入先** — Infisical `staging` とワークフローのベタ書き env の 2 箇所 (1.6)
7. **sitemap に動的ルートを含めるか** (4.3)

### Research Needed

- **PR プレビュー URL が Cloudflare Access 配下にあるか** (1.10)。R7-5 の成否を左右する。保護されていない場合、プレビュービルドで開発用 UI を有効にすると公開されることになる
- **middleware で静的アセットを保護する必要があるか**。必要なら `wrangler.toml` の `[assets]` に `run_worker_first` を設定する判断が要る (1.8)。`public/map-tiles/**` は数万ファイル規模のため、全件を worker 経由にすると配信コストへの影響がある
- **`NextResponse.rewrite` による 404 が OpenNext 上で期待どおりステータス 404 を返すか**の実機確認

### 他 spec との依存関係

- `full-site-design` (phase: design-generated, 未承認) の R15 (ナビ項目定義の一元管理) と R16 (CMS 取得失敗時の振る舞いとキャッシュ方針) が、本 spec の R2-3 / R9-6 と領域が重なる。design の Boundary Commitments で所有権を明記する必要がある
- 開催前・開催中それぞれのトップページの Figma デザインは `full-site-design` が所有する
- `page-home-friendly-editing` (phase: completed) が設計した `home_active_variant` / `page_home_live` は現存しない。同 spec の設計を参照する際は、実装が残っていない前提で読む
