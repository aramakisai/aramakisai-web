# 調査・設計判断ログ

## Summary
- **Feature**: `faq-page`
- **Discovery Scope**: Extension(既存の`(site)`ルートグループ・CMSクライアント・sitemap・背景図形への追加)
- **Key Findings**:
  - `(site)/layout.tsx:16`が`cookies()`を読むため、配下のページはすべてリクエスト時描画になる。CMSの更新は再デプロイなしで反映される(要件2.3)。一覧ページの取得失敗は`try/catch`で空配列に潰して200で応答する慣習がある(`topics/page.tsx:24-29`、`announcements/page.tsx:44-49`)
  - アコーディオンはネイティブの`<details>/<summary>`で要件1.5(キーボード操作・開閉状態の伝達)を満たせる。サイト内に`<details>`の既存利用は無い
  - 背景図形は現行コードで「同じ幅での高さ変化」でも全図形を配置し直す(`components/background-shapes.tsx:549-556`)。確定仕様(配置を固定し、違反した図形だけ隠す、伸びた範囲だけ足す)に合わせるため、共通コンポーネントの変更が要る

## Research Log

### 現行コードの統合点
- **Context**: `/faq`を既存の慣習に合わせて追加するための接点の特定
- **Sources Consulted**: 現行コード
- **Findings**:
  - 共通レイアウト: `frontend/src/app/(site)/layout.tsx:11-45`。Header・BackgroundShapes・main・Footerを持つ。`cookies()`(16行)で全ページが動的描画になる
  - SectionHeading: `frontend/src/components/section-heading.tsx:15-27`。文字サイズ・行高はタグ選択子の基底スタイル(`app/globals.css:183-197`)に委ね、`py-0 mb-6`だけを持つ。お知らせ一覧は`level="h1"`に`mb-0! text-center`を足して使う(`announcements/page.tsx:59`)
  - 見出しの基底スタイル: `app/globals.css:144-167`でZen Old Mincho・`text-primary`、`h1`は44px(183-186行)、`h2`は32px/125%(189-192行)
  - Material Symbols: `components/icons.tsx:11-37`の`renderIcon`が`material-symbols-sharp`クラスの`span`を`aria-hidden="true"`で描く。`expand_more`は`ExpandMoreIcon`(59行)として既存。フォントは`app/layout.tsx:27-51`で`icon_names`を列挙して読み込み、`expand_more`は登録済み
  - CMSクライアント: `frontend/src/lib/cms.ts:101-129`の`cms.findMany`。失敗は`CmsResult`の`ok: false`で返り、例外は投げない(80-95行)
  - 取得関数の慣習: `lib/topics.ts:18-27`は`!result.ok`で例外を投げ、ページ側が`catch`して空配列にする
  - 固定ページ: `lib/static-page.ts:15-36`(`getPageBySlug`)、47-63行(`getPageSlugsUpdatedAt`、sitemap用)
  - sitemap: `app/sitemap.ts:18-24`の`OWN_HANDLING_ROUTES`に無いコード定義ルートは`pages`の固定ページ候補として扱われる(117-126行)。`/faq`は`phase.ts:38`の`PRE_EVENT_PUBLIC_PATHS`にあるため、現状は`pages`に`faq`が無いと掲載されない。`sitemap.test.ts:114-120,148`はこの前提で書かれている
  - 構造化データ: `lib/structured-data.ts:65-79`の`buildBreadcrumbJsonLd`。固定ページは`[slug]/page.tsx:48-58`で「トップ→ページ名」の2階層を出す
  - メタデータ: `lib/route-metadata.ts:1-39`の`ROUTE_METADATA`と`lib/page-metadata.ts`の`buildPageMetadata`を一覧ページが使う(`topics/page.tsx:9-21`)
  - 公開パス: `lib/phase.ts:29-41`に`/faq`登録済み。ナビゲーションも`lib/navigation.ts:65`に登録済み
- **Implications**: 新規ファイルはページ・取得関数・一覧部品に限り、既存部品を組み合わせる

### アコーディオンの方式
- **Context**: 要件1.5(キーボード操作・開閉状態の伝達)、初期状態は全閉(要件1.8)
- **Sources Consulted**: HTML Living Standard(details要素)、現行コード
- **Findings**:
  - `<summary>`はフォーカス可能で、Enter/Spaceで開閉できる。支援技術には展開状態(expanded/collapsed)が標準で伝わる
  - 閉じた`<details>`の中身は描画されず、`getBoundingClientRect`が0になる。`lib/exclude-rects.ts:79`の幅・高さ0の除外でそのまま背景図形の除外対象から外れる
  - JSを要さないため、ページをServer Componentのまま保てる
  - 開閉のアニメーションは`::details-content`疑似要素と`interpolate-size: allow-keywords`で付けられる。Tailwind 4.3.2(`frontend/node_modules/tailwindcss`)は`details-content:`バリアントを持つ。未対応ブラウザでは即時に開閉するだけで、機能は損なわない
- **Implications**: `<details>/<summary>`を採る。`name`属性は付けず、複数を同時に開ける

### モーション切替
- **Findings**:
  - `app/globals.css:77-84`が`motion-reduce:`バリアントを再定義し、OSの`prefers-reduced-motion`とフッターの切替(`<html data-motion="reduce">`)の両方で発火する
  - `lib/use-motion-preference.ts:126-138`はJSで動くモーション向け。CSSのtransitionは`motion-reduce:transition-none`で止める慣習(`components/header.tsx:245,280`、`motion-toggle.tsx:20`)
  - 既存のUI遷移は`duration-200 ease-out`(`header.tsx:245,280`)。FaqItem(`631:576`)に`get_motion_context`で取れるモーション定義は無い
- **Implications**: アイコンの回転と回答の展開はCSSのtransitionで付け、`motion-reduce:`で無効化する。JSのフックは使わない

### 背景図形の現行実装と改定ルールの差
- **Sources Consulted**: `components/background-shapes.tsx`、`lib/background-shapes.ts`、`lib/exclude-rects.ts`、`aramakisai-refine-assets/bgshape-rules.md`(第4版)
- **Findings**:
  - 種は`pathname`のFNV-1a→mulberry32(`lib/background-shapes.ts:84-102,239`)。ルールの「決定的乱数」(bgshape-rules.md 18行)に対応する
  - 現行は階層(L/∞/S)を持たず、一辺22〜104pxの7種を1本の列から置く(63-79行、146-229行)。個数は`round(ページ高/110 × 密度)`、下限4(243-246行)。ルールの個数の式・∞の組・質感の割当・Lの25%重なり・可視率は未実装
  - 文字との重なり: 現行は全図形について、操作要素・img・直下に文字を持つ要素の外接矩形+10pxを除外する(`exclude-rects.ts:37-61`、`background-shapes.ts:248-250,262-265`)。ルールより厳しい(Lも文字に重ならない)ため、白い光彩の付与は現行では発生しない
  - `aria-hidden="true"`の部分木は除外候補から外れる(`exclude-rects.ts:41`)。Material Symbolsのアイコンは`aria-hidden`付き(`icons.tsx:19`)のため単独では除外されず、親が操作要素(`a`,`button`等)であるときだけ親の矩形で除外される
  - 再計測: `background-shapes.tsx:549-556`は`resize`と`ResizeObserver(document.body)`のどちらでも`measure()`し直し、配置を最初から計算し直す。幅の変化と高さの変化を区別しない
  - 入場アニメーションは`useShapeMotion`(190-398行)の`useEffect`が`shapes`配列の参照変化で張り直され、全図形が入場をやり直す(390行の依存配列)
- **Implications**: 高さ変化の扱いだけを変える。配置ロジックそのもの(ルールの移植)は対象外

### 高さ変化時に配置し直すことの影響範囲(現行)
- 同じ`pathname`・同じ幅でページ高が変わる契機:
  - 企画一覧の絞り込み(`components/exhibition-filters.tsx:41,58,71`の`router.replace`はクエリだけを変え、`pathname`は変わらない)
  - 寸法を予約しない画像の遅延読込(`rich-text-image-viewer.tsx:111`、`topics/[id]/page.tsx:85`等の`<img>`)
  - Webフォントの差し替え(`app/layout.tsx:16-21`のZen Old Minchoは`display: 'swap'`)
  - 本specで加えるFAQの開閉
- 幅の変化: ウィンドウの`resize`・端末の回転。`LG_BREAKPOINT_PX`をまたぐと密度も変わる(`background-shapes.ts:241-242`)
- `pathname`の変化: `useEffect`の依存(562行)で全計算し直し

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations |
|--------|-------------|-----------|---------------------|
| `<details>/<summary>` | ネイティブの開閉 | キーボード・状態伝達が標準。JS不要でServer Componentのまま | 展開アニメーションは新しいCSSに依存(未対応では即時開閉) |
| `button`+`aria-expanded`+`useState` | Client Componentで開閉を管理 | 全ブラウザで高さのtransitionを制御できる | 状態管理・ARIA結線・テストを自前で持つ。要求に対して過剰 |

## Design Decisions

### Decision: アコーディオンはネイティブの`<details>/<summary>`
- **Context**: 要件1.5、1.8
- **Alternatives Considered**: 上表の2案
- **Selected Approach**: 各項目を`<details>`とし、質問を`<summary>`に置く。`name`属性は付けない(複数を同時に開ける)。`open`属性を付けずに描画して初期状態を全閉にする
- **Rationale**: 要件をブラウザ標準で満たし、コード量が最小
- **Trade-offs**: 展開のtransitionは`::details-content`と`interpolate-size`の対応ブラウザに限られる

### Decision: 背景図形は同じ幅の高さ変化で配置し直さない
- **Context**: 同じURLの状態違いでは配置を流用し、制約に反する図形だけを落とす(bgshape-rules.md 25行)。開閉で全図形が配置し直され入場をやり直すのは不自然
- **Alternatives Considered**:
  1. 現行どおり配置し直す
  2. 初期の配置を基準に固定し、違反した図形だけ隠す。伸びた範囲には図形を足す
- **Selected Approach**: 2。伸びた範囲への追加は、初期配置の直後から乱数列の続きで固定高さの帯ごとに置く。帯の中身は除外領域を使わずに決め、状態ごとの違反判定で表示・非表示を切り替える
- **Rationale**: 帯の中身が開閉状態に依存しないため、同じ状態に戻れば同じ図形が同じ位置に出る。伸びたときも既に出ている図形は動かない
- **Trade-offs**: 文字の多い範囲では追加図形の多くが非表示になる。遅延読込の画像・フォント差し替えで高さが変わるページでも基準が初回計測のまま残る(Risks参照)

### Decision: サイト共通の書体・見出し色・白い光彩はFAQ単独で導入しない
- **Context**: Figma(`633:35`ほか)はLINE Seed JP・見出し`#231815`・白い光彩を使う。現行コードはLINE Seed JPを読み込まず(`app/layout.tsx:16-21`はZen Old Minchoのみ。`next/font/google`の一覧にも無い)、見出しは`text-primary`(`globals.css:158-167`)
- **Selected Approach**: 大きさ・行高・字間・色・余白・太さはFigmaの値を使う。書体の読み込みと光彩の仕組みはサイト共通の基盤であり、FAQページだけに入れない
- **Rationale**: FAQだけが別書体になると他ページとの一貫性が崩れる。光彩は、現行の配置器が文字に図形を重ねないため発生しない
- **Follow-up**: サイト共通の書体移行が入った時点でFAQも追随する

## Risks & Mitigations
- 基準配置が初回計測で固定されるため、寸法を予約しない画像の読込やフォント差し替えで高さが変わるページでは、図形が隠れる・追加帯に寄るなど、従来より偏る — 違反した図形は必ず隠れるので制約は守られる。偏りが目立つページが出たら、基準計測を`document.fonts.ready`後に遅らせる等を別途検討する
- 企画一覧の絞り込みでも基準が固定される — ルール(同じURLの状態違いは配置を流用)に沿う変化であり意図どおり
- Payloadの`sort`昇順での`null`の並び — Postgresの昇順は既定で`NULLS LAST`。`faq_items`の`sort`はnull許容(`cms-types.ts:451`)。実装時にローカルCMSで未設定の項目が末尾に来ることを確かめる

## References
- `aramakisai-refine-assets/bgshape-rules.md` — 背景図形の生成ルール第4版
- Figma `0kWDqHsLr6xE8b4FFgR1Zx` — `633:35`・`634:165`・`635:305`・`635:394`・`631:576`
