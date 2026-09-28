# Implementation Plan

- [x] 1. Foundation: 404/エラー共通表示コンポーネントの実装
- [x] 1.1 `ErrorPageContent` コンポーネントを実装する
  - `variant="not-found"` で "404" (`color/warning`)・見出し「ページが見つかりません」・説明文・下線テキストによるトップページへの戻り導線を描画する
  - `variant="error"` で見出し「エラーが発生しました」・説明文・再読み込みボタン (`onReset` 呼び出し) を描画する
  - 判別可能ユニオン型で `variant` ごとに必須 props (`onReset` は `variant="error"` のみ) を分岐させる
  - 単体テストで両 variant の描画内容と、`variant="error"` でボタン押下時に `onReset` が呼ばれることを検証する
  - _Requirements: 1.1, 1.5, 3.1, 3.2_

- [x] 2. Core: 404ページの実装
- [x] 2.1 (P) ルート直下の404表示を実装する
  - Header/Footer に依存しない自己完結レイアウトで `ErrorPageContent(variant="not-found")` を配置する
  - 固有タイトルと `robots: {index:false}` を返す `generateMetadata` を追加する
  - ブラウザでルート直下の404がデザイン込みで表示され、タブタイトルが固有のものになる
  - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.4_
  - _Boundary: Root not-found.tsx_

- [x] 2.2 (P) Site配下の404表示を実装する
  - Header/Footer/背景装飾込みの外枠 (Site Layout) で `ErrorPageContent(variant="not-found")` を配置する
  - 固有タイトルと `robots: {index:false}` を返す `generateMetadata` を追加する
  - Site配下で404表示時に Header・Footer・背景図形が表示され、タブタイトルが固有のものになる
  - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.4_
  - _Boundary: Site not-found.tsx_

- [x] 3. Core: エラーページの実装
- [x] 3.1 (P) Site配下のエラー表示を実装する
  - Header/Footer付き外枠で `ErrorPageContent(variant="error")` を配置し、Next.js が渡す `reset` を `onReset` として渡す
  - 固有タイトルと `noindex` の `<meta>` をレンダー内に直書きする
  - Site配下で意図的に例外を発生させるとエラー画面が表示され、再読み込みボタン押下で再レンダリングされる
  - _Requirements: 1.1, 1.2, 1.5, 2.2, 2.4, 3.2_
  - _Boundary: Site error.tsx_

- [x] 3.2 (P) Fullscreen配下のエラー表示を実装する
  - Header/Footer に依存しない外枠で `ErrorPageContent(variant="error")` を配置する
  - 固有タイトルと `noindex` の `<meta>` をレンダー内に直書きする
  - Fullscreenページで例外発生時に Header/Footer なしのエラー画面が表示される
  - _Requirements: 1.1, 1.3, 1.5, 2.2, 2.4, 3.2_
  - _Boundary: Fullscreen error.tsx_

- [x] 3.3 (P) グローバルエラー表示を実装する
  - `<html>`/`<body>` の自前構造を維持しつつ `ErrorPageContent(variant="error")` を配置する
  - 固有タイトルと `noindex` の `<meta>` をレンダー内に直書きする
  - ルートレイアウト自体が壊れた状況を再現してもエラー画面と再読み込みボタンが描画される
  - _Requirements: 1.1, 1.4, 1.5, 2.3, 2.4, 3.2_
  - _Boundary: global-error.tsx_

- [x] 4. Validation: 到達経路ごとの表示とタイトル優先の確認
- [x] 4.1 5画面のE2Eテストを追加する
  - 存在しないURLでルート404・Site404それぞれが固有タイトルで表示されることを確認する
  - 詳細ページ (お知らせ/トピック/企画/固定ページのいずれか) で存在しないIDにアクセスし、Site not-found.tsx 側のタイトルが優先されることを確認する
  - Site/Fullscreen配下で意図的に例外を発生させ、エラー画面と再読み込み導線が機能することを確認する
  - 5画面すべてで `noindex` の `<meta>` が出力されていることを確認する
  - 追加した Playwright テストが全て green になる
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.1, 3.2_
  - _Depends: 2.1, 2.2, 3.1, 3.2, 3.3_
