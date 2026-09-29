# Research & Design Decisions

## Summary
- **Feature**: `error-pages`
- **Discovery Scope**: Extension (既存の `(site)`/`(fullscreen)` レイアウト・`page-metadata.ts` を拡張)
- **Key Findings**:
  - `BackgroundShapes` は props なしのクライアントコンポーネントで、`usePathname()` と DOM 実測により自身で配置を決める。`(site)/layout.tsx` を経由するページには自動的に付与されるため、`(site)/not-found.tsx` と `(site)/error.tsx` 側で明示的に組み込む必要はない
  - 既存の `generateMetadata` (例: `announcements/[id]/page.tsx`) はレコード未検出時 `title: announcement?.title ?? site.siteTitle` でサイト既定タイトルにフォールバックしており、これが要件 2.5 の課題の実体。`buildPageMetadata` 自体は変更せず、`not-found.tsx` 側に独自の `generateMetadata` を定義することで対処する
  - `error.tsx` / `global-error.tsx` は Client Component のため `generateMetadata` を使えない。React 19 の `<title>` / `<meta name="robots">` をレンダー内に直書きする
  - プロジェクト内に `robots: { index: false }` を使った前例はない (既存はすべて `index: true` またはメタデータ継承)。本 spec が最初の noindex 適用箇所になる

## Research Log

### BackgroundShapes の付与条件
- **Context**: 404/エラー画面の外枠 (Header・Footer・背景装飾の有無) を判断するため、`(site)/layout.tsx` の構成を確認した
- **Sources Consulted**: `frontend/src/app/(site)/layout.tsx`、`frontend/src/components/background-shapes.tsx`
- **Findings**:
  - `(site)/layout.tsx` は `<Header>` → `<BackgroundShapes>` → `<main>{children}</main>` → `<Footer>` の順で子を並べる
  - `BackgroundShapes` は `usePathname()` でシードを取り、`PAGE_CONTAINER_ID` 配下の DOM を実測して障害物を避けた配置を自前で計算する。呼び出し側からの props 注入は不要
  - `(fullscreen)/layout.tsx` は `<div>{children}</div>` のみで Header・Footer・BackgroundShapes を持たない
- **Implications**: `(site)/not-found.tsx` と `(site)/error.tsx` は `(site)/layout.tsx` に置くだけで Header・Footer・背景装飾が自動的に付く。ルート直下の `not-found.tsx`・`(fullscreen)/error.tsx`・`global-error.tsx` はこれらの layout を経由しないため、意図的に外枠なしのデザインを別途用意する

### generateMetadata のサイト既定値フォールバック
- **Context**: 要件 2.5 (`notFound()` 経由で `not-found.tsx` 側の固有タイトルが優先されること) の実装可否を確認するため、既存の `generateMetadata` 実装と `buildPageMetadata` の契約を調べた
- **Sources Consulted**: `frontend/src/lib/page-metadata.ts`、`frontend/src/app/(site)/announcements/[id]/page.tsx`
- **Findings**:
  - `buildPageMetadata` は `title: string | null` を受け取り、`null` の場合のみ `title.default`/`template` と `robots: {index:true}` を設定する。子ページの `title` が文字列のときは `robots` を返さず継承に任せる契約になっている
  - 既存の詳細ページの `generateMetadata` はレコードが見つからない場合 `site.siteTitle` (サイト既定タイトル文字列) をフォールバックとして使っている。これは `notFound()` を呼ぶ前に評価される値であり、`not-found.tsx` 自身の `generateMetadata`/`metadata` とは独立している
  - Next.js App Router の仕様上、`notFound()` が呼ばれたセグメントは該当階層の `not-found.tsx` にレンダリングを委譲するが、`generateMetadata` の解決順序はフレームワーク側の実装に依存する。本 spec の範囲では「`not-found.tsx` 側に `generateMetadata`/`metadata` を明示的に定義する」ところまでを設計対象とし、実際にブラウザタイトルへ反映されるかは実装時の動作確認 (タスク側の検証項目) に委ねる
- **Implications**: `buildPageMetadata` のシグネチャ変更は不要。`not-found.tsx` 2 ファイルに `generateMetadata` を新設し、`robots: {index:false}` を追加で上書きする

### noindex の設定方法
- **Context**: 要件 2.4 (エラー表示は noindex) を Server Component / Client Component の両方で満たす方法を確認した
- **Sources Consulted**: `frontend/src/lib/page-metadata.ts`、`frontend/src/lib/page-metadata.test.ts`、`frontend/src/app/robots.ts`
- **Findings**:
  - `not-found.tsx` (Server Component) は `generateMetadata` の返り値に `robots: {index:false, follow:false}` を追加できる
  - `error.tsx`/`global-error.tsx` (Client Component) は Metadata API を使えないため `<meta name="robots" content="noindex" />` を JSX に直書きする (React 19 がドキュメント head へ自動的にホイストする)
  - `robots.ts` (robots.txt 生成) はフェーズ別の allow/disallow を静的ルートで管理しており、404/エラーという動的発火の状態には対応しない。meta タグでの noindex 指定で十分であり、`robots.ts` 側の変更は不要
- **Implications**: 5 ファイルとも noindex は meta レベルで完結させ、`robots.ts` は変更しない (Out of Boundary)

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 共有コンテンツコンポーネント抽出 | `error-page-content.tsx` を新設し、5 ファイルから見出し・説明文・導線の表示ロジックを共有 | 5 ファイル間の見た目重複 (色・余白・構成) を1箇所に集約でき、full-site-design のトークン変更にも追随しやすい | Server/Client 両方から呼ばれるため、コンポーネント自体は副作用を持たない純粋な表示コンポーネントに限定する必要がある | 採用。Client Component 専用の `<title>`/`<meta>` はコンポーネント内には含めず、各ページ側で個別に置く |
| 5 ファイルへ個別実装 | 共通化せずファイルごとに JSX を書く | シンプル、依存が増えない | Figma で確定した見た目 (トークン・余白) の変更時に 5 箇所を個別修正する必要があり、ドリフトしやすい | 不採用 |

## Design Decisions

### Decision: エラー表示の中身を共有コンポーネントに抽出する
- **Context**: 404 用 2 ファイル・エラー用 3 ファイルは、それぞれ見出し・説明文・導線という同じ構成要素を持ち、Figma でも同一のビジュアルパターンとして確定している
- **Alternatives Considered**:
  1. 5 ファイルにそれぞれ JSX を直接書く
  2. 見出し・説明文・導線を受け取る共有コンポーネントを新設し、5 ファイルはそれぞれの外枠 (Header/Footer 有無) とメタデータ設定のみを担当する
- **Selected Approach**: 2 を採用。`frontend/src/components/error-page-content.tsx` に `variant: 'not-found' | 'error'` を受け取る単一コンポーネントを置き、404 用/エラー用の見出し・説明文・導線 (トップページへ戻るリンク / 再読み込みボタン) を出し分ける
- **Rationale**: Figma 側でも 404・エラーそれぞれ 1 種類のビジュアルパターンを到達経路 (Header+Footer 付き / 自己完結) に当てはめているため、コード側も同じ粒度で共通化するのが自然。要件 1.5 (到達経路によらず同一の構成要素) を型レベルで担保できる
- **Trade-offs**: コンポーネントの再利用性と引き換えに、5 ファイル個別の柔軟なカスタマイズはできなくなるが、要件上そのような差別化は求められていない
- **Follow-up**: `error.tsx`/`global-error.tsx` (再読み込みボタン) は `onClick={reset}` を props 経由で渡す。`reset` は Next.js が渡す関数のため、コンポーネント自体を `'use client'` にする必要があるかは実装時に確認する

### Decision: `reset` ボタンの再利用性のため `error-page-content.tsx` を Client Component にする
- **Context**: `error.tsx`/`global-error.tsx` はボタンに `onClick` ハンドラを渡す必要があり、Server Component からは渡せない
- **Alternatives Considered**:
  1. `error-page-content.tsx` を Server Component のままにし、404 用と Error 用で別コンポーネントに分割する
  2. `error-page-content.tsx` 自体を `'use client'` にし、404/Error 共通で使う
- **Selected Approach**: 2。`error-page-content.tsx` の先頭に `'use client'` を付ける
- **Rationale**: `not-found.tsx` (Server Component) から Client Component を呼び出すことは Next.js の制約上問題ない (逆方向は不可)。共通化のメリットを優先する
- **Trade-offs**: 404 表示もクライアントバンドルに含まれるようになるが、コンポーネント自体は軽量で影響は小さい

## Risks & Mitigations
- `notFound()` 経由で `not-found.tsx` の `generateMetadata` が実際にブラウザタイトルへ反映されるかは Next.js のバージョン挙動に依存する — 実装後にブラウザで実機確認する (タスクの検証項目に含める)
- `global-error.tsx` は `import './globals.css'` を自前で行っており、Tailwind のユーティリティクラスやフォントが正しく効くかはルートレイアウトの壊れ方次第 — 最小限のインラインに近い構成で壊れにくくする

## References
- `frontend/src/app/(site)/layout.tsx` — Header/BackgroundShapes/Footer の構成順
- `frontend/src/components/background-shapes.tsx` — 配置ロジックが props 不要である根拠
- `frontend/src/lib/page-metadata.ts` — `buildPageMetadata` の契約
- `.kiro/specs/full-site-design/design.md` — 色・フォント・spacing トークンの出典
