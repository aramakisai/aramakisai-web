# Requirements Document

## Project Description (Input)
エラーページ(not-found/error)のデザイン確定と実装。WBS「エラーページのデザイン確定 (Figma)」「エラーページ実装」に対応する2タスクを1specで扱う。

対象ファイル(5つ): src/app/not-found.tsx, src/app/(site)/not-found.tsx, src/app/(site)/error.tsx, src/app/(fullscreen)/error.tsx, src/app/global-error.tsx

背景:
- full-site-design spec の design.md で「404 は現行の notFound() のまま」「CMS 障害時のエラーページとその HTTP ステータスは後続の spec で扱う」としてスコープ外にされ、現状5ファイルとも Header/Footer 無し・素の Tailwind パレットのまま放置されている
- ルート直下 not-found.tsx と (site)/not-found.tsx で到達経路により見た目が異なる点の扱いも決める必要がある

要件に含めるべき論点:
- 各エラーページに固有のページタイトルを付与する(例:「ページが見つかりません | サイトタイトル」)。現状は404・エラー時もブラウザタイトルがサイト既定のまま
- 詳細ページ(お知らせ・トピック・企画・固定ページ)はレコード不在時 generateMetadata がサイト既定値を返す(seo-metadata仕様)。notFound() 経由で not-found.tsx 側のタイトルが効くか確認する
- error.tsx / global-error.tsx は Client Component のため metadata を export できない。React 19 の <title> 要素で出す
- エラーページは noindex にする
- デザイン確定は既存の全面デザイン改修(full-site-design)のトークン・コンポーネントに揃える(Figma上で検討)

## Introduction
サイト内の5つのエラー表示 (ルート `not-found.tsx`・`(site)/not-found.tsx`・`(site)/error.tsx`・`(fullscreen)/error.tsx`・`global-error.tsx`) は、全面デザイン改修 (`full-site-design`) の対象外として現状のプレーンな Tailwind スタイル (`text-gray-600` 等の既定パレット、Header/Footer なし) のまま残っている。本 spec はこれらのビジュアルデザインを全面デザイン改修が確定したトークン・コンポーネントに合わせて確定し、実装する。

## Boundary Context

- **In scope**: 5 ファイルの見た目 (レイアウト・配色・タイポグラフィ・戻る導線等)、到達経路による見た目の差異の扱い、各ページのタイトル設定、`noindex` 設定
- **Out of scope**: エラーの発生条件そのもの (CMS 障害検知、HTTP ステータスコード制御、リトライ/フォールバック戦略)。`full-site-design` の design.md で「後続の spec で扱う」とされた「CMS 障害時のエラーページとその HTTP ステータス」のロジック部分は対象外とし、既存の発火条件 (`notFound()` 呼び出し・Error Boundary) はそのまま使う
- **Adjacent expectations**: `full-site-design` が確定した色トークン (`color/text` = `#231815`、`color/gray-*`、`color/primary` = `#ebb03c` 等)・フォント (LINE Seed JP)・spacing の命名規則に準拠する。`(fullscreen)` 配下は `campus-map` の全画面地図という文脈を壊さない (Header/Footer を持ち込まない)

## Requirements

### Requirement 1: エラー表示のビジュアルデザイン確定

**Objective:** As a サイト訪問者, I want 404 やエラー発生時にも他ページと一貫したデザインの画面を見たい, so that サイトから離脱した・壊れたと誤解せず、次の行動に迷わない

#### Acceptance Criteria
1. The エラー表示 shall 全面デザイン改修が確定した配色トークン・フォント・余白の指針に従う
2. Where ページが `(site)` 配下のレイアウトで表示される場合、the エラー表示 shall Header・Footer・背景装飾を含む通常ページと同じ外枠を用いる
3. Where ページが `(fullscreen)` 配下のレイアウトで表示される場合、the エラー表示 shall Header・Footer を持たない全画面の外枠を用いる
4. Where ページが Root Layout のみで表示される場合 (ルート `not-found.tsx` や `global-error.tsx`)、the エラー表示 shall Header・Footer に依存しない自己完結したスタイルを用いる
5. When 同じ種類のエラー (404 / 予期しない例外) が異なる到達経路で表示される場合、the エラー表示 shall 到達経路によらず同一のメッセージ・トーン・構成要素 (見出し・説明文・導線) を用いる

### Requirement 2: ページタイトルとインデックス制御

**Objective:** As a サイト訪問者・検索エンジン, I want ブラウザタブや検索結果でエラー画面であることが分かる, so that 通常ページと誤認しない・エラー画面が検索結果に残らない

#### Acceptance Criteria
1. When ルート `not-found.tsx` または `(site)/not-found.tsx` が表示される場合、the エラー表示 shall 「ページが見つかりません」の趣旨を含む固有のタイトルをブラウザタブに表示する
2. When `(site)/error.tsx` または `(fullscreen)/error.tsx` が表示される場合、the エラー表示 shall エラー発生の趣旨を含む固有のタイトルをブラウザタブに表示する
3. When `global-error.tsx` が表示される場合、the エラー表示 shall アプリケーション全体のエラーの趣旨を含む固有のタイトルをブラウザタブに表示する
4. The エラー表示 shall 検索エンジンにインデックスさせない
5. If 詳細ページ (お知らせ・トピック・企画・固定ページ) が `notFound()` を呼び出す場合、the システム shall 呼び出し元の `generateMetadata` が返すサイト既定タイトルではなく、`not-found.tsx` 側の固有タイトルをブラウザに反映する

### Requirement 3: 復帰導線の維持

**Objective:** As a サイト訪問者, I want エラー画面から迷わず復帰したい, so that サイトの利用を継続できる

#### Acceptance Criteria
1. When 404 表示 (`not-found.tsx`) が表示される場合、the エラー表示 shall トップページへ戻るリンクを提供する
2. When 例外エラー表示 (`error.tsx` / `global-error.tsx`) が表示される場合、the エラー表示 shall 再読み込みを行う手段を提供する
