# Research & Design Decisions: festival-phase-gate

## Summary

- **Feature**: `festival-phase-gate`
- **Discovery Scope**: Extension (既存 Next.js アプリへの新規ミドルウェア層の追加)
- **Key Findings**:
  - **PR プレビュー URL は Cloudflare Access で保護されていない。** 既存の Access Application はすべてホスト名の完全一致指定であり、バージョンハッシュ付きの別ホスト名には及ばない。R7-5 の「アクセス制御されたプレビュー環境」に PR プレビューは該当しない
  - 保護が確認できる配信先は `dev.aramakisai.com` (`deploy-dev` job、`dev` ブランチ push で発火) とローカル開発環境のみ。開発用オーバーライドの有効範囲はこの 2 つに限定する
  - `dev` ビルドの `NEXT_PUBLIC_*` は Infisical ではなくワークフロー YAML のリテラルで注入されている。開発用フラグをここに置けば、フラグが `true` になる箇所がリポジトリ内の 1 行に限定され、ワークフロー構造テストで機械的に検証できる
  - 全ページが既に毎リクエスト動的描画されるため、middleware と Cookie 読取の追加でレンダリング戦略が劣化しない
  - `src/lib/app-routes.ts` に `listAppRoutes` / `routeExists` が既にあり、ナビ定義とルートの突き合わせテストで使われている。公開対象一覧の網羅性検証に再利用できる

## Research Log

### Cloudflare Access が PR プレビュー URL を保護するか

- **Context**: R7-5 が「アクセス制御されたプレビュー環境」でのみ開発用機能を有効にすると定めており、gap-analysis 1.10 が PR プレビュー URL の保護状況を未確認として残していた。保護されていなければ、プレビュービルドで開発用 UI を有効にすると未公開ページが公開される
- **Sources Consulted**:
  - `aramakisai-infra/terraform/access.tf:45-76` (Access Application 3 件の定義)
  - `frontend/wrangler.toml:10,16` (`workers_dev = false` / `preview_urls = true`)
  - `.github/workflows/frontend-ci.yml:136,232,283` (プレビュー URL の組み立て、各 deploy job の発火条件)
  - [Preview URLs — Cloudflare Workers docs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
  - [Cloudflare Access for Workers — Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
  - [Secure all your internal vibe-coded applications — Cloudflare Blog](https://blog.cloudflare.com/workers-protected-by-access/)
  - [Application paths — Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- **Findings**:
  - 既存の Access Application は 3 件とも `domain` にホスト名を完全一致の文字列で指定している。ワイルドカードの記述は無い
    - `aramakisai-web.aramakisai.workers.dev` (`access.tf:48`)
    - `dev.aramakisai.com` (`access.tf:59`)
    - `aramakisai-web-dev.aramakisai.workers.dev` (`access.tf:70`)
  - PR プレビュー URL は `https://<バージョン ID の先頭 8 文字>-aramakisai-web.aramakisai.workers.dev` (`frontend-ci.yml:136`)。これは上記いずれとも異なる DNS ラベルを持つ**別ホスト名**である
  - Cloudflare のドキュメントは、ホスト名ベースの Access について "Hostname-based Access protects only that exact URL" と明記している。ホスト名指定が接頭辞違いの別ホスト名へ波及するという記述はどのページにも存在しない
  - Access の application paths のワイルドカード仕様も階層ベースの厳密マッチであり (`*.example.com` は `alpha.example.com` にマッチするが `example.com` にはマッチしない)、暗黙の波及は無い
  - Cloudflare は 2026 年 8 月に Worker 単位の Access を追加しており、`destinations` に `preview_worker` / `worker` / `all_preview_workers` / `all_workers` を指定する方式で Preview URL を保護できる。Terraform provider の `cloudflare_zero_trust_access_application` にも `destinations` / `worker_id` としてスキーマが入っている。**現行の `access.tf` はこの方式を使っていない**
  - `workers_dev = false` かつ `preview_urls = true` の組み合わせにより、本番 worker の `aramakisai-web.aramakisai.workers.dev` は配信されず、バージョン別プレビュー URL のみが配信される。つまり `access.tf:45-54` が保護している対象は現状配信されていないホスト名である
  - e2e は CF Access のサービストークンヘッダを付けてプレビュー URL を叩いている (`frontend/playwright.config.ts:7-12`) が、プレビュー URL が Access 配下に無い以上このヘッダは素通りする。保護されている証拠にはならない
- **Implications**:
  - **PR プレビューでは開発用オーバーライドを有効にしてはならない**。有効にすると、認証なしで到達できる URL から未公開ページを閲覧できる状態になる
  - 開発用機能を有効にしてよい配信先は、Access 保護が確認できる `dev.aramakisai.com` (および同一 worker の `aramakisai-web-dev.aramakisai.workers.dev`) とローカル開発環境の 2 つに限られる
  - PR プレビューで開催中フェーズを確認したい場合は `aramakisai-infra` 側に `preview_worker` destination の Access Application を追加する必要があるが、これは別リポジトリの変更であり本 spec の境界外とする

### 配信先ごとの環境変数注入経路

- **Context**: R7-2/R7-4 が本番での開発用機能の無効化を求めている。gap-analysis 1.6 は注入経路が 3 系統に分かれ「有効化は 2 箇所、無効保証は 1 箇所」という非対称を指摘していた
- **Sources Consulted**: `.github/workflows/frontend-ci.yml:122,272-278,322`
- **Findings**:

  | 配信先 | ビルド時 env の注入元 | Access 保護 | 発火条件 |
  |---|---|---|---|
  | PR プレビュー | Infisical `--env=staging` | **なし** | `pull_request` |
  | `dev.aramakisai.com` | **ワークフロー YAML のリテラル `env:` ブロック** | あり | `push` → `dev` |
  | 本番 | Infisical `--env=prod` | なし (公開サイト) | `push` → `main` |

  - `deploy-dev` job の Build ステップは Infisical を通さず、`NEXT_PUBLIC_CMS_URL` / `NEXT_PUBLIC_SITE_URL` をワークフロー内のリテラルとして渡している (`frontend-ci.yml:272-275`)。Infisical はこの job では `wrangler deploy` の認証にのみ使われる
- **Implications**:
  - 開発用フラグを `deploy-dev` job のリテラル `env:` ブロックに置けば、**フラグが `true` になる箇所はリポジトリ内の 1 行だけ**になる。Infisical には一切登録しない
  - この配置により、gap-analysis が指摘した非対称が解消する。有効化も無効保証も同一の YAML ファイル上で完結し、`*.workflow.test.ts` の既存パターン (steering `structure.md` の「CI ロジックはワークフロー YAML に直接書かずテストで検証する」) で機械検証できる
  - Infisical にフラグを置かないことで、誰かが `prod` 環境に誤って変数を追加してしまう経路自体が存在しなくなる

### middleware の OpenNext 上での動作

- **Context**: gap-analysis 1.8 が `NextResponse.rewrite` 経由の 404 を未検証として残していた
- **Sources Consulted**:
  - `node_modules/@opennextjs/cloudflare/dist/cli/build/utils/middleware.js` (実装)
  - `node_modules/@opennextjs/cloudflare/dist/api/overrides/asset-resolver/index.d.ts`
  - インストール済みバージョン: `@opennextjs/cloudflare` 1.20.1 / `next` 15.5.19
  - [Discussion #52233 — vercel/next.js](https://github.com/vercel/next.js/discussions/52233)
- **Findings**:
  - OpenNext は edge middleware と node middleware の双方を検出するビルド経路を持つ (`useNodeMiddleware`)。Next.js の middleware はサポート対象
  - `NextResponse.rewrite(new URL('/404', request.url))` により URL を保持したまま `not-found.tsx` を描画する手法が報告されているが、**存在しないパスへ rewrite する形は不具合報告が複数ある** (rewrite が適用されない、`NextResponse.error()` が 404 になる等)
  - 一方、**実在するルートへ rewrite し、そのルートが `notFound()` を呼ぶ**形は Next.js の標準的な挙動に乗る。`notFound()` は常にステータス 404 を返し、最寄りの `not-found.tsx` を描画する
  - `asset-resolver` の仕様上、`run_worker_first` が未指定 (現状) のとき静的アセットは Next のルーティングを迂回する。`run_worker_first` は `boolean | string[]` を取るため、パスパターン単位で worker 経由にすることも可能
- **Implications**:
  - ゲートの 404 応答は「実在する専用ルートへ rewrite し、そのルートが `notFound()` を呼ぶ」方式を採る。存在しないパスへの rewrite に依存しない
  - 既存の `not-found.tsx` がそのまま描画されるため、ゲートによる 404 と本来存在しないページの 404 が**応答として区別できない**。どのパスがゲート対象かを外部から推測できない副次効果がある
  - 静的アセットのゲートは `run_worker_first` にパスパターンを列挙すれば技術的には可能だが、requirements で Out of scope と定めたため採らない

### 公開対象一覧の表現方法

- **Context**: R2-3 が公開対象を単一定義で保持することを、R2-6 が動的パスの値単位判定を求めている。`/access` と `/privacy` は `[slug]` ルートで解決されるため (gap-analysis 1.3)、ルートパターン単位の定義では `pages` コレクションの全 slug が公開されてしまう
- **Sources Consulted**: `frontend/src/lib/app-routes.ts`、`frontend/src/components/header.tsx:19-32`、`frontend/src/components/footer.tsx:7-11`、`frontend/src/app/(site)/[slug]/page.tsx:20-26`
- **Findings**:
  - `app-routes.ts` は `listAppRoutes` (app ディレクトリを走査して全ルートを列挙) と `routeExists` を提供し、`header.test.tsx` / `footer.test.tsx` がナビの `href` が実在するルートを指すことの検証に使っている。`node:fs` を使うためテスト専用でランタイムには載らない
  - ナビ定義は `navigationItems` (`header.tsx:19`) と `footerNavigation` (`footer.tsx:7`) の 2 箇所に分かれている。`full-site-design` R15 がこの一元管理を所有している
  - `header.tsx:17-18` のコメントが、未実装ページをナビから手作業でコメントアウトして回避している現状を示す
- **Implications**:
  - 公開対象は**パス文字列の静的な列挙**として独立に持つ。ナビ定義から導出しない。ナビ定義は `full-site-design` が作り替える対象であり、そこに公開範囲の判定を従属させると所有権が交差する
  - `[slug]` 配下は slug の実値を列挙する。`/access` と `/privacy` を個別に書く
  - `listAppRoutes` を使った構造テストで「app ディレクトリの全ルートが公開対象一覧に載っているか、載っていないなら意図的な非公開か」を宣言的に検証する。新規ルートの追加を検知できる

### sitemap の生成方式

- **Context**: R9 が sitemap をスコープに含め、R9-6 が動的パスの収録方針を design 送りにしていた
- **Sources Consulted**: `frontend/src/lib/announcements.ts:22-31`、`frontend/src/env.ts:7`、`frontend/src/app/` のルート一覧
- **Findings**:
  - `src/app/sitemap.ts` は App Router の標準機能で、`MetadataRoute.Sitemap` を返す。`env.NEXT_PUBLIC_SITE_URL` を基点に URL を組み立てられる
  - `getAnnouncements()` が公開済みのお知らせを全件返す既存関数として存在する。sitemap の動的 URL 列挙にそのまま使える
  - 静的な `public/sitemap.xml` ではフェーズ連動も動的ルートの反映もできない
- **Implications**:
  - `src/app/sitemap.ts` を採用する。フェーズと公開対象一覧を読んで収録対象を絞る
  - 開催前フェーズでは公開対象の固定パス + お知らせ詳細のみを収録する。お知らせ詳細は既存関数の再利用で済み、追加コストが小さい
  - 開催中フェーズの企画詳細等の収録は、対象ページが `full-site-design` で実装されてから判断する。本 spec では固定パスとお知らせ詳細に留める

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. middleware 集約 | `middleware.ts` でフェーズ判定と公開対象照合を行い、非公開なら rewrite | 全ルートに一律で効く。R2-4 の default deny が構造的に保証される。Cookie 読取と同じ場所で完結 | このリポジトリで middleware の前例が無い。404 の描画に rewrite 先の設計が要る | **採用** |
| B. ページ側でゲート | 各ページの先頭で `notFound()` を呼ぶ | 既存の `notFound()` 作法にそのまま乗る。新しい層を増やさない | **default deny が成立しない**。新規ページはガードを書き忘れると公開される | 不採用 |
| C. ハイブリッド | middleware で判定、ヘッダで下流へ受け渡し | 判定結果を下流で再利用できる | フェーズがビルド時定数になったため受け渡しの必要性が消えた | 不採用 |

Option C の前提だった「CMS 往復の重複を避けるためヘッダで受け渡す」という利点は、フェーズをソースコード定数にした決定により消滅した。定数は任意のモジュールから直接 import できるため、下流への受け渡し機構そのものが不要になる。

## Design Decisions

### Decision: 開発用オーバーライドの有効範囲をローカルと dev 環境に限定する

- **Context**: R7-5 が開発用機能を「アクセス制限された環境」に限定することを求めているが、PR プレビュー URL は Access 保護されていないことが判明した
- **Alternatives Considered**:
  1. PR プレビューでも有効にする — 認証なしの URL から未公開ページが閲覧可能になる。R7-5 違反
  2. `aramakisai-infra` に `preview_worker` destination の Access Application を追加してから有効にする — 別リポジトリの Terraform 変更が前提条件になり、本 spec が他リポジトリの作業に依存する
  3. ローカル開発環境と `dev.aramakisai.com` に限定する
- **Selected Approach**: 選択肢 3。開発用フラグは `deploy-dev` job のリテラル `env:` ブロックにのみ置き、Infisical には登録しない。ローカル開発は `NODE_ENV === 'development'` で判定し、環境変数を要さない
- **Rationale**: 保護が実地に確認できる配信先にのみ限定する。PR の base ブランチが `dev` である運用上、マージ後すぐ `dev.aramakisai.com` へ自動デプロイされるため、レビューの導線は実質的に失われない。むしろ Access 認証を経た環境でレビューする形になり、実行委員と共有する際の前提とも合う
- **Trade-offs**: PR プレビュー URL 上で開催中フェーズを確認できない。確認はローカルまたは `dev` マージ後になる。一方で、フラグが `true` になる箇所がリポジトリ内の 1 行に限定され、無効化の保証が機械検証可能になる
- **Follow-up**: PR プレビューでの確認が必要になった場合は、`aramakisai-infra` へ `destinations = [{ type = "preview_worker", worker_id = ... }]` の Access Application を追加した上で、本 spec の Revalidation Triggers に従って再検討する

### Decision: 開発用フラグを `src/env.ts` ではなく直接の `process.env` 参照で読む

- **Context**: R7-4 が本番ビルドの成果物に開発用 UI のコードを含めないことを求めている。steering `structure.md` は「環境変数は `process.env` を直接参照せず `src/env.ts` の `env` オブジェクト経由」と定めている
- **Alternatives Considered**:
  1. `env.ts` 経由で参照する — steering に準拠するが、`@t3-oss/env-nextjs` の proxy 越しのアクセスはランタイムの参照であり静的解析できない。バンドラが分岐を除去できず、コードが成果物に残る
  2. `process.env.NEXT_PUBLIC_*` を直接参照する — Next.js がビルド時にリテラルへインライン展開するため定数畳み込みが効き、分岐ごと除去される
- **Selected Approach**: 選択肢 2。ただし参照箇所を専用モジュール 1 つに閉じ込め、steering から逸脱する理由をコード上のコメントで明示する
- **Rationale**: R7-4 は明示的な要件であり、「コードは残るが無効」では満たさない。steering の規約は型安全性とランタイム検証が目的だが、この変数は真偽値の有無だけを見るフラグであり zod 検証の利得が小さい。一方で静的解析可能性は要件の充足に直結する
- **Trade-offs**: steering の規約から 1 箇所だけ逸脱する。逸脱を 1 モジュールに閉じ込め、理由をコメントで残すことで影響を局所化する
- **Follow-up**: 本番相当の設定でビルドした成果物を走査し、開発用 UI 固有の文字列が含まれないことをテストで検証する (R7-6)

### Decision: 非公開ページの 404 を実在ルートへの rewrite で返す

- **Context**: middleware は React を描画できない。R2-2 が 404 ステータスと内容の非露出を求めている
- **Alternatives Considered**:
  1. `new NextResponse(null, { status: 404 })` で素の 404 を返す — 確実だが本文が空になる。ゲート対象のパスと本来存在しないパスで応答が異なり、どのパスがゲートされているか推測できてしまう
  2. 存在しないパスへ rewrite する — Next.js の不具合報告が複数あり挙動が不安定
  3. `notFound()` を呼ぶだけの専用ルートへ rewrite する
- **Selected Approach**: 選択肢 3
- **Rationale**: `notFound()` は必ず 404 を返し、既存の `not-found.tsx` を描画する。Next.js の標準挙動のみに依存し、不具合報告のある経路を避けられる。ゲートによる 404 と本来の 404 が応答として区別できないため、ゲート対象の推測を防げる
- **Trade-offs**: 専用ルートが 1 つ増える。そのルート自体は直接アクセスされても 404 を返すだけで害は無い
- **Follow-up**: OpenNext 上で rewrite 経由の `notFound()` がステータス 404 を返すことを e2e で確認する

### Decision: 公開対象一覧をナビ定義から独立させる

- **Context**: R2-3 が公開対象の単一定義を求める一方、`full-site-design` R15 がナビ項目定義の一元管理を所有している
- **Alternatives Considered**:
  1. ナビ定義から公開対象を導出する — 定義が 1 箇所で済むが、`full-site-design` が作り替える構造に公開範囲の判定が従属する
  2. 独立した静的なパス列挙として持つ
- **Selected Approach**: 選択肢 2
- **Rationale**: 公開範囲はセキュリティ境界であり、ナビの見た目の都合で変わってはならない。ナビに載らないが公開すべきページ (`/privacy` 等) と、ナビに載せたいが未完成のページは別概念である。両者を同一定義にすると、`full-site-design` のナビ改修が公開範囲を意図せず変える経路ができる
- **Trade-offs**: ナビ定義と公開対象一覧の 2 箇所を更新する場面が生じる。整合は構造テストで担保する
- **Follow-up**: ナビ項目の `href` がすべて公開対象一覧に載っていることをテストで検証する (開催前フェーズで死んだリンクを出さないため)

## Risks & Mitigations

- **middleware の前例がリポジトリに無い** — OpenNext 1.20.1 がサポートしていることはビルド経路の実装で確認済み。e2e で実機の挙動を検証する
- **本番ビルドからの開発用コード除去がバンドラの最適化に依存する** — 成果物走査テストで実測する。テストが落ちたら除去方法を見直す
- **`preview_urls = true` のまま PR プレビューが無防備である** — 本 spec は開発用機能をプレビューで有効にしないことで影響を回避する。プレビュー URL そのものの保護は `aramakisai-infra` 側の判断として申し送る
- **公開対象一覧とナビ定義の乖離** — 構造テストで双方向に検証する
- **静的アセットがゲートを迂回する** — requirements で Out of scope と確定済み。`run_worker_first` にパスパターンを指定する余地は残っている

## References

- [Preview URLs — Cloudflare Workers docs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/) — Preview URL のホスト名形式と `preview_urls` の既定挙動
- [Cloudflare Access for Workers — Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) — `destinations` による Worker 単位の保護、ホスト名ベース Access が exact URL のみを保護する旨
- [workers.dev — Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) — `workers_dev = false` と `preview_urls` の関係
- [Application paths — Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) — Access のドメインマッチング仕様
- [Discussion #52233 — vercel/next.js](https://github.com/vercel/next.js/discussions/52233) — middleware から 404 を返す手法と既知の不具合
