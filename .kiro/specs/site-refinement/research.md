# Research & Design Decisions

## Summary
- **Feature**: `site-refinement`
- **Discovery Scope**: Extension (`full-site-design` で実装済みの画面・背景図形の差し替え)
- **Key Findings**:
  - 背景図形は既にクライアント描画 (`components/background-shapes.tsx`) で、配置は純関数 `computeBackgroundShapePlacement` に閉じている。入力を「障害物の分類」に広げ、関数本体を参照実装 `place.py` の移植に置き換えれば、計測・描画・動きの枠組みは流用できる。
  - 再計算の契機は `pathname` の変化・resize・`document.body` の ResizeObserver。検索条件は URL の searchParams で pathname を変えないが、件数変化による高さ変化を ResizeObserver が拾って全面再配置してしまう (要件 9 に反する)。
  - LINE Seed JP は Google Fonts で公開済みだが、導入済みの Next の `next/font/google` のフォント一覧には無い。`@fontsource/line-seed-jp` は unicode-range で分割済みの woff2 を自己ホストでき、ビルド時に外部取得を要しない。

## Research Log

### 既存の背景図形実装
- **Context**: 生成ルールを差し替える範囲の特定。
- **Sources Consulted**: `frontend/src/lib/background-shapes.ts`, `lib/exclude-rects.ts`, `components/background-shapes.tsx`, `lib/background-shapes-motion.ts` と各テスト。
- **Findings**:
  - 配置: FNV-1a → mulberry32、個数は高さ比例、サイズ 22〜104px、除外矩形は 1 種類 (+10px)、図形間隔は回転前の中心距離。
  - 除外矩形: 操作要素・img・直下にテキストを持つ要素を構造的に走査。文字・リンク・不透明な面の区別が無い。
  - ヘッダー内にも図形を描く (portal)。新ルールではヘッダーは除外領域。
  - 質感は CSS の radial-gradient 近似。新ルールは質感画像。
  - 動きの定数は `background-shapes-motion.ts` 冒頭に集約。階層の概念が無い。
  - フォント読み込み完了を待たずに計測している。
- **Implications**: 配置関数・障害物収集・描画の塗り・動きの定数を差し替える。ヘッダー層と `splitShapesByHeaderHeight` は削除できる。

### 書体の配信
- **Sources Consulted**: [Google Fonts: LINE Seed JP](https://fonts.google.com/specimen/LINE+Seed+JP), [@fontsource/line-seed-jp](https://www.npmjs.com/package/@fontsource/line-seed-jp), [LINE Seed JP 追加 issue](https://github.com/google/fonts/issues/7561), `node_modules/next/.../font-data.json` (該当なし)
- **Findings**: ウェイトは 100 / 400 / 700 / 800 の 4 種。SIL OFL。4 ウェイト合計 10MB 超のため unicode-range 分割が前提。
- **Implications**: `@fontsource/line-seed-jp` の 4 ウェイトを読み込む。Zen Old Mincho の `next/font` 設定は削除。

### 質感画像
- **Sources Consulted**: `aramakisai-refine-assets/tex5/` (L1〜L8, S1〜S6 PNG, 計 5MB。網目 1.1MB/枚)、`cardtex/`。
- **Findings**: 質感の色は画像に焼き込まれている (例: `L1_gradient_ochre-salmon`)。L・S の「色」は質感画像の選択で決まり、色トークンを直接使うのは ∞ だけ。
- **Implications**: 表示最大寸法の 2 倍に縮小した WebP (網目は点の潰れを避けて可逆) を `public/` に置く。描画する図形の画像だけを読み込む。

### 状態違いの画面
- **Findings**: `/exhibitions` の検索・絞り込みは `router.replace` で searchParams だけを変える。
- **Implications**: 同じ pathname・同じビューポート幅の間は初回に計算した配置を保持し、以後の DOM 変化では制約に反する図形を隠すだけにする。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations |
|--------|-------------|-----------|---------------------|
| クライアント計測 + 純関数配置 (現行を拡張) | 描画後に DOM を計測し、純関数で配置 | 既存の枠組み・テストを流用。参照実装と入出力を揃えやすい | 初回はフォント読み込み完了まで図形が出ない |
| ビルド時に配置を事前計算 | ページごとに配置を生成して配信 | 初回から表示 | CMS 由来の本文で障害物が変わる。幅ごとの配置が必要。却下 |

## Design Decisions

### Decision: 配置ロジックは place.py の移植とし、golden テストで一致を検査する
- **Alternatives Considered**: 1) 既存 TS を段階的に修正 2) place.py を仕様として移植
- **Selected Approach**: 2。`place.py` と生成ルール文書をリポジトリに置き、代表的な障害物入力 (fixture) に対する place.py の出力を golden として保存、TS 実装の出力と比較する。
- **Rationale**: ルールの緩和段・順序が多く、文章だけでは実装がずれる。参照実装との一致で機械的に検証できる (要件 11)。
- **Trade-offs**: Python と JS の三角関数の末尾桁差 → 座標は許容誤差 0.01px、個数・種類・質感は完全一致で比較。

### Decision: 障害物をブラウザの DOM から 4 分類で集める
- **Selected Approach**: 黒文字 / 重ねない要素 (文字リンク・白文字・ロゴ) / 不透明な面 / 装飾範囲 (ヒーロー・ヘッダー下端、フッター・下部タブナビ上端)。不透明な面は `data-bg-opaque` 属性・`img`・入力欄・地を持つボタンで判定する。
- **Rationale**: 計算スタイルからの自動判定はセクションの地やホバー状態を誤検出しやすい。不透明な面を持つ部品は数が限られる。

### Decision: 光彩は本文領域の黒文字に CSS で一律に付ける
- **Alternatives Considered**: 1) 図形との重なりを計算して該当要素にだけ付ける 2) 本文の黒文字すべてに付ける
- **Selected Approach**: 2。白の光彩は白地では見えないため、見た目の結果は 1 と同じで、配置との結合が無くなる。
- **Trade-offs**: 灰色のプレースホルダーの上ではわずかに見える。許容する。

### Decision: 初回配置の確定とそれ以降の間引き
- **Selected Approach**: `document.fonts.ready` の後に初回計測する。pathname とビューポート幅が同じ間は初回の配置を保持し、以後の DOM 変化 (件数変化など) では、その時点の障害物に反する図形だけを隠す (参照実装の流用モードと同じ判定)。幅が変わったときだけ計算し直す (同じ PC 帯でも 1024→1440px のように幅が変わると、保持した配置では右側に図形が無くなるため)。

## Risks & Mitigations
- フォント 4 ウェイトの転送量 — unicode-range 分割で使用字形だけ取得。Thin はヒーローの 2 文字だけなので preload しない。
- 質感画像の転送量 — 描画する図形分だけ読み込む。網目の可逆 WebP が大きい場合はサイズを表示寸法の 1.5 倍に下げる。
- 障害物の分類漏れ (不透明な面に `data-bg-opaque` を付け忘れる) — 不透明な面を持つ部品の一覧をテストで検査する。

## References
- [Google Fonts: LINE Seed JP](https://fonts.google.com/specimen/LINE+Seed+JP)
- [@fontsource/line-seed-jp](https://www.npmjs.com/package/@fontsource/line-seed-jp)
- [google/fonts issue #7561](https://github.com/google/fonts/issues/7561)

## dry run で判明した事項 (design に反映済み)
- place.py の幾何判定は 40×40 格子の標本化近似。乱数で候補を引く逐次試行のため、判定を閉形式に置き換えると golden が全体でずれる → 近似をそのまま移植する。
- fixture (`work/*/obstacles.json`) と shapes.json は平坦な形・接頭辞なしの色名・`size`/`rot` のフィールド名 → TS の型をこれに合わせる。
- jsdom に `Range.getClientRects` が無い → `vitest.setup.ts` で polyfill。
- 背景図形の質感 PNG は L 640px・S 192px で、表示最大寸法の 2 倍に足りない → 作り直す。
- 企画カードに重ねる無彩色の質感は既存素材に無い → 生成手順を design に記載。網目は固定の網点で近似する。
- 会場で使うボタンの駐車場は「1 色 + gradient」で質感が見えない → gradient を使わない割り当てに変える。
- 本番ビルドでは `console.warn` を出さないため e2e で不足数を検証できない → `data-bg-deficit` 属性を常に出す。
