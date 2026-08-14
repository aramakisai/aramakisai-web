# Research & Design Decisions: nightly-dev-integration

## Summary

- **Feature**: `nightly-dev-integration`
- **Discovery Scope**: Extension (既存システムへの統合。light discovery を実施)
- **Key Findings**:
  - 本番 Directus のスキーマは Git の `snapshot.yaml` より古い。`festival_meta.home_active_variant` (`"pre_event"`)、`page_home.hero_image` (単数)、`admission_fee` / `payment_note` / `parking_capacity` が本番に残存しており、`sitemap-schema-review` spec の変更が未適用である
  - 本番 Directus には既に主要コンテンツが投入済み。`event_days` (`11/14(土)` `10:00`–`17:30` 他)、`sns_links` (Instagram / X / YouTube)、`pages` の `privacy` / `contact` / `access` レコードが存在する。`nightly` の静的値の多くは既存データと重複している
  - `page_home.hero_images` は公開ロールから読み取れず `FORBIDDEN` を返す。ヒーロー画像の Directus 復帰には RBAC migration が必要
  - `@opennextjs/cloudflare` では Next.js の Image Optimization API がそのままでは動作せず、`images.unoptimized` または Cloudflare Images バインディングが必要。`nightly` が `about-section.tsx` で導入した `next/image` は本プロジェクトの既存慣習 (素の `<img>`) から外れている

## Research Log

### 本番 Directus のコンテンツ投入状況

- **Context**: 要件 9 (Directus へのコンテンツ投入) の対象を確定するため、どのコンテンツが既に存在するかを確認する必要があった
- **Sources Consulted**: `https://api.aramakisai.com/items/festival_meta`, `/items/pages`, `/items/page_home` (公開ロールでの GET)
- **Findings**:
  - `festival_meta`: `name` = 「第73回 荒牧祭公式ホームページ」、`event_days` = `[{label: "11/14(土)", open: "10:00", close: "17:30"}, {label: "11/15(日)", open: "10:00", close: "16:30"}]`、`sns_links` = Instagram / X / YouTube の 3 件、`overview` = 投入済み (WordPress 由来のクラス属性を含む HTML)、`hero_image` = null
  - `festival_meta` に `home_active_variant: "pre_event"`、`admission_fee` / `payment_note` / `parking_capacity` (いずれも null) が残存
  - `page_home`: `hero_image` (uuid, 単数) と `embed_url` が存在、`hero_message` は null。`hero_images` は `FORBIDDEN`
  - `pages`: `privacy` / `contact` / `access` の 3 レコード。`privacy` の `content` は投入済みだが、章立てが `nightly` の静的実装と異なる
- **Implications**:
  - `event_days` と `sns_links` は投入不要。フロントエンドから参照し直すだけで復帰できる
  - `overview` と `pages.privacy.content` は内容が `nightly` の静的実装と異なるため、どちらを正とするかの判断と更新作業が必要
  - `hero_images` は RBAC 対応 + 画像投入の両方が必要
  - 本 spec は `sitemap-schema-review` の `snapshot.yaml` が本番へ適用されることを前提とする。適用前に本 spec のフロントエンドをデプロイすると、削除済みフィールドを参照して失敗する可能性がある

### `festival_meta.home_active_variant` の位置づけ

- **Context**: 本番に存在するが Git の `snapshot.yaml` にもフロントエンドにも見当たらないフィールドがあり、「pre と直前〜当日の 2 フェーズ」という運用概念との関係を確認する必要があった
- **Sources Consulted**: `.kiro/specs/sitemap-schema-review/design.md`, `directus/schema/snapshot.yaml`, `frontend/src/lib/`
- **Findings**:
  - `home_active_variant` は `page_home` / `page_home_live` の 2 バリアント運用を切り替えるフラグであり、`sitemap-schema-review` spec が `page_home_live` 廃止とあわせて除去済み
  - `dev` / `nightly` の `snapshot.yaml` とフロントエンドには既に存在しない
- **Implications**: 2 フェーズ切替は廃止済みの概念であり、本 spec では単一の `page_home` を前提とする。本番に残る `home_active_variant` は `sitemap-schema-review` の適用時に消える

### `@opennextjs/cloudflare` における `next/image`

- **Context**: `nightly` の `about-section.tsx` が `next/image` を使用しており、既存の素の `<img>` 慣習と衝突していた
- **Sources Consulted**: Cloudflare Workers / OpenNext の公式および解説記事 (References 参照)
- **Findings**:
  - Next.js の Image Optimization API は Vercel のインフラ前提であり、Cloudflare Workers 上ではそのまま動作しない。`images.unoptimized: true` の指定か、Cloudflare Images バインディングの利用が必要
  - Images バインディングを使う場合、変換結果がキャッシュされずリクエストごとに課金対象の変換が走るという報告がある
  - `frontend/next.config.ts` には画像関連の設定が一切ない
- **Implications**: `next/image` は採用せず、既存慣習どおり素の `<img>` を使う。最適化は Directus の Asset Transformations (`?format=webp&width=`) をクエリパラメータで付与する方式に寄せる (`sitemap-schema-review` が `toAssetUrl` への付与方針を持つ)

### ナビゲーション整合性の検証手段

- **Context**: 要件 7-4 でナビゲーション項目が実在ルートを指すことをテストする必要がある
- **Sources Consulted**: `frontend/vitest.config.ts`, 既存の `*.workflow.test.ts` (Node の `fs` を使って YAML を検証している前例)
- **Findings**: 本リポジトリには既に「ファイルシステムを走査して構成を検証するテスト」の前例がある (`frontend-ci.workflow.test.ts` 等)
- **Implications**: `src/app` 配下の `page.tsx` を列挙してルート一覧を組み立て、ナビゲーション定義の `href` と突き合わせるテストを同じ流儀で書ける。外部ライブラリの追加は不要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| サーバー取得 + props (採用) | `page.tsx` / `layout.tsx` で Directus を読み、表示コンポーネントへ props で渡す | `dev` の既存実装と同一。SSR 時点でデータが確定し、追加のクライアント JS が不要 | `'use client'` 化されたコンポーネントの境界を引き直す必要がある | 要件の「dev 側の仕様を採用」に一致 |
| クライアント側フェッチ | `useEffect` で Directus を叩く | サーバー / クライアントの境界を触らずに済む | 初回描画が空になる、`NEXT_PUBLIC_` 経由で公開 API を直接叩く、テストが複雑化 | 既存 lib (`readSingleton` 等) を活かせない |
| 静的生成時に埋め込み | ビルド時に取得して定数化 | 実行時コスト最小 | コンテンツ更新にデプロイが必要となり、本 spec の目的に反する | 不採用 |

## Design Decisions

### Decision: `'use client'` 境界の引き直し

- **Context**: `nightly` は `HeroSection` / `Header` / `Footer` を `'use client'` 化し、`Footer` は `async` サーバーコンポーネントから同期関数へ変更した。この状態では Directus データを受け取れない
- **Alternatives Considered**:
  1. 全体をクライアントコンポーネントのまま、クライアント側フェッチで補う
  2. 状態を持つコンポーネントだけをクライアントに残し、データ取得はサーバー側で行う
- **Selected Approach**: 2 を採用。`HeroSection` はスライドショーの状態管理のため `'use client'` を維持しつつ props で画像 URL 配列を受け取る。`Header` は `usePathname` とメニュー開閉状態を持つためクライアントのまま、ナビゲーション定義はコード管理なので Directus データを必要としない。`Footer` は内部状態を持たないため `async` サーバーコンポーネントへ戻す。`AboutSection` も状態を持たないためサーバーコンポーネントとし、props で祭情報を受け取る
- **Rationale**: `dev` の実装形と一致し、既存 lib をそのまま再利用できる。クライアントへ送る JS も最小化される
- **Trade-offs**: `Footer` の `'use client'` を外す際、`HoverLine` など純粋な表示ヘルパーがクライアント境界に依存していないことの確認が必要
- **Follow-up**: `layout.tsx` から `Footer` を `await` する形に戻し、既存の `footer.test.tsx` の描画方法を非同期対応へ更新する

### Decision: 開催日程の表示形式とデータ形式

- **Context**: 要件 1-5 で `MM月DD日 HH:mm〜HH:mm` 形式が指定された。本番の `event_days[].label` は `11/14(土)` 形式で投入済み
- **Alternatives Considered**:
  1. `label` の文字列を表示側でパースして `MM月DD日` へ変換する
  2. `event_days` に ISO 日付フィールドを追加し、表示側でフォーマットする
  3. 投入データの `label` を `11月14日` へ更新し、表示側は `{label} {open}〜{close}` を組み立てるだけにする
- **Selected Approach**: 3 を採用
- **Rationale**: `label` は運営者が Directus 上で自由に編集する値であり、表示形式を運営者が制御できる状態が望ましい。パース処理を持たないため `11/14(土)` のような表記ゆれで壊れない。スキーマ変更も不要
- **Trade-offs**: 表示形式がデータ側の記述に依存するため、`label` の書き方に関する運用上の約束が必要になる
- **Follow-up**: 要件 9 の投入一覧に `event_days[].label` の更新を含める

### Decision: プライバシーポリシーの本文をどちらから取るか

- **Context**: `pages.privacy.content` は投入済みだが、`nightly` の静的実装とは章立て・記載内容が異なる (`nightly` 版は Cookie / アクセス解析への言及を含み、章立てが 1〜N で整理されている)
- **Alternatives Considered**:
  1. 既存の `pages.privacy.content` をそのまま使い、`nightly` の静的実装は破棄する
  2. `nightly` の本文で `pages.privacy.content` を上書きする
- **Selected Approach**: 2 を採用。`nightly` の本文を WYSIWYG へ移し替えて `pages.privacy.content` を更新する
- **Rationale**: 「削除されたものはリジェクトして保持」という方針に沿い、`nightly` で書き起こされた内容を失わない。既存 content は WordPress 由来のクラス属性を含んでおり、そのままでは `RichText` のサニタイズ後に意図した見た目にならない可能性がある
- **Trade-offs**: 静的実装が持っていた区切り線・セクション余白などのレイアウト表現は、WYSIWYG + `RichText` の表現力の範囲に収まる形へ簡略化される
- **Follow-up**: `RichText` のサニタイズ許可タグで `h2` / `ul` / `li` / `p` / `strong` が通ることを確認する

### Decision: 未実装ルートの扱い

- **Context**: `nightly` のナビゲーションが `/events` `/guide` `/sponsors` `/news` を指しているが、いずれも実装されていない
- **Alternatives Considered**:
  1. `pages` collection にレコードを投入し `/[slug]` で受ける
  2. 既存ルートへ張り替える
  3. ナビゲーション項目を一時的に非表示にする
- **Selected Approach**: `/news` は既存の `/announcements` へ張り替える。`/events` `/guide` `/sponsors` は一時非表示とする
- **Rationale**: `sitemap-schema-review` spec が会場マップ (`/map`)・タイムテーブル (`/timetable`)・出展一覧 (`/exhibitions`)・FAQ (`/faq`) の新設を後続 spec へ切り出す方針を確定させている。本 spec で暫定 URL を作ると、後続 spec で URL の付け替えが発生する
- **Trade-offs**: 公開時点でナビゲーションの項目数が `nightly` のデザイン意図より少なくなる
- **Follow-up**: 後続 spec でページが実装された時点でナビゲーション項目を戻す

### Decision: 追加フィールドの配置先

- **Context**: テーマ・会場名・キャンパスマップ URL・お問い合わせフォーム URL に受け皿がない
- **Alternatives Considered**:
  1. すべて `page_home` へ追加する
  2. 祭全体のメタ情報は `festival_meta`、ホームページ固有の表示要素は `page_home` へ振り分ける
- **Selected Approach**: 2 を採用。テーマ (`theme_word` / `theme_image` / `theme_description`)、`venue_name`、`campus_map_url`、`contact_form_url` はいずれも祭全体に属する情報のため `festival_meta` へ追加する。`page_home` への追加は行わない
- **Rationale**: `dev` 側の既存の使い分け (`page_home` = ホームページ固有の見出し・画像、`festival_meta` = 祭そのもののメタ情報) に従う。`contact_form_url` はフッター経由で全ページから参照されるため、ホームページ固有ではない
- **Trade-offs**: `festival_meta` のフィールド数が増える。`sitemap-schema-review` が同 collection の整理を進めているため、実装順序の調整が必要
- **Follow-up**: `sitemap-schema-review` の `snapshot.yaml` 変更が本番へ適用された後に本 spec の追加分を重ねる

## Risks & Mitigations

- **本番スキーマと Git の乖離** — `sitemap-schema-review` の `snapshot.yaml` が本番未適用のまま本 spec のフロントエンドをデプロイすると、`hero_images` (M2M) 参照が失敗する。Phase 1 のデプロイ前に本番へのスキーマ適用状況を確認し、未適用なら適用を先行させる
- **`hero_images` の公開読み取り権限がない** — 現状 `FORBIDDEN` を返す。RBAC migration を Phase 1 のスコープに含め、適用後に Directus の再起動を行う (権限キャッシュが更新されないため)
- **画像を Directus へ移すことによる初回表示の劣化** — 静的アセット配信から Directus 経由へ変わるため、Asset Transformations で `format=webp` と `width` を付与し、転送量を抑える
- **既存テストの前提崩れ** — `page.test.tsx` は現在の二重表示を正常系として検証している。期待値の書き換えを実装タスクに明示的に含める
- **`sitemap-schema-review` との境界衝突** — `festival-overview.tsx` / `festival-summary.tsx` は同 spec が追従修正を所有している。本 spec ではこれらのファイルを削除せず、呼び出し元を外すところまでに留める

## References

- [Next.js · Cloudflare Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) — Workers 上での Next.js デプロイと画像最適化の前提
- [Cloudflare · OpenNext](https://opennext.js.org/cloudflare) — `@opennextjs/cloudflare` アダプタの公式ドキュメント
- [Cloudflare images binding takes so much of CPU time · opennextjs-cloudflare#1125](https://github.com/opennextjs/opennextjs-cloudflare/issues/1125) — Images バインディング利用時の変換課金・キャッシュに関する報告
- [Next.js images are broken in the Cloudflare Workers · payloadcms/payload#15502](https://github.com/payloadcms/payload/issues/15502) — Workers 上で `next/image` が動作しない事例
- `.kiro/specs/sitemap-schema-review/design.md` — 既存 collection の削除・統合方針、`page_home_live` 廃止、`toAssetUrl` への webp 付与方針
