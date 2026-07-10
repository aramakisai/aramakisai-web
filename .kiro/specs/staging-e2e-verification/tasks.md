# Implementation Plan

- [x] 1. Foundation: E2E テスト基盤とプレビュー到達待ちユーティリティ
- [x] 1.1 Playwright セットアップと base URL 駆動の実行基盤を構築する
  - `frontend/` に Playwright（`@playwright/test`）を導入し、`baseURL` を実行時の環境変数から取得する設定にする
  - `pnpm test` (vitest) とは独立した専用スクリプトを `frontend/package.json` に追加する
  - ローカルで `http://localhost:3000` を対象にスクリプトを実行するとブラウザテストが起動し pass/fail が報告される（ブラウザバイナリ未導入時はサイレント無視でなく明確なエラーで失敗する）ことを確認する
  - テスト対象コードパス（`frontend/src`）の Edge Runtime 制約とテストランナー自体の Node 実行環境が混同されないよう設定コメントで明記する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.2 (P) プレビュー到達待ちユーティリティ（wait-for-preview）を実装する
  - プレビュー URL・Service Token ヘッダ・最大試行回数/全体タイムアウトを入力とし、「到達可能」「タイムアウトで未到達」「Cloudflare Access 拒否」の3状態を区別して返す/終了コードを分ける処理を実装する
  - bounded retry（上限付き再試行）で一時的な伝播遅延を吸収し、無期限リトライは行わない
  - Access 拒否ステータスを検出した場合は残り試行回数を消費せず即座に打ち切る
  - モックレスポンス（200 / 403 相当 / タイムアウト）を用いた単体テストで3分岐それぞれが正しいステータス・メッセージで終了することを確認する
  - _Requirements: 2.2, 2.4, 2.6, 2.7, 7.3, 7.4, 8.5_
  - _Boundary: Wait-for-Preview Script_

- [ ] 2. Core: 画面遷移カバレッジと Directus 連携テストの拡張パターン
- [x] 2.1 トップページの到達性・エラー検出テストを実装する
  - `frontend/src/app/page.tsx` に対応するルートが staging プレビュー URL 上で正常にロードされ主要 DOM 要素が描画されることを検証するテストを作成する
  - クライアント側の未処理例外やハイドレーション失敗が発生した場合、対象ルートとエラー詳細付きで失敗が報告されることを確認する
  - このテストをローカル実行するとトップページ到達性の pass/fail が得られる状態にする
  - _Requirements: 3.1, 3.4_

- [x] 2.2 画面追加・Directus 連携テストの拡張規約を確立する
  - 新規画面追加時は「1画面1ファイル」でテストディレクトリにファイルを追加するだけで済み、CI のトリガー/実行ロジック変更が不要な構造であることをテスト構成で裏付ける
  - Directus 連携データを検証するテストのひな形（依存 collection をテスト内に明記する規約、フェッチしたデータが画面に反映されていることの確認方法）を用意する
  - Directus 連携テストは読み取り専用のみとし、書き込み操作を行わないことをひな形レベルで徹底する
  - staging Directus が到達不能/エラーを返した場合、フロントエンドのレンダリング不具合とは別種の「環境/依存関係起因の失敗」として報告されるようひな形にエラー分類ロジックを組み込む
  - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2_
  - _Depends: 2.1_

- [ ] 3. Integration: CI ワークフロー連結と失敗時診断情報
- [x] 3.1 `deploy-preview` に E2E job を連結し Cloudflare Access バイパス付きで実行する
  - `deploy-preview` job の完了時に発行されるプレビュー URL を後続 job が受け取れるようにする
  - 新規 E2E job を `deploy-preview` の成功後にのみ実行し、URL 取得後にプレビュー到達待ち→E2E テスト実行の順で走らせる
  - fork PR で `deploy-preview` がスキップされる場合、新規 E2E job も secrets を要求せず自動的にスキップされる（Access 拒否の誤検出や secret 露出が起きない）ことを確認する
  - 既存の Infisical 認証パターンを再利用し、Cloudflare Access Service Token の client id/secret を CI にのみ注入し、リポジトリに平文で残さないようにする
  - E2E job が新しいプレビューデプロイを再トリガーせず、既に発行済みの URL のみを消費することを確認する
  - _Requirements: 2.1, 2.3, 2.5, 2.6, 8.3, 8.4_
  - _Boundary: CI Workflow Integration_
  - _Depends: 1.1, 1.2, 2.1, 2.2_

- [x] 3.2 失敗時の診断アーティファクトと job サマリを整備する
  - E2E テストが失敗した際にスクリーンショット/トレースを CI アーティファクトとして保存する
  - job のサマリに失敗テスト名・対象プレビュー URL・診断アーティファクトへの参照が含まれるようにする
  - 一時的失敗によるリトライが発生した場合、最終的にどの試行で成功/失敗したかが記録に残ることを確認する
  - _Requirements: 6.1, 6.2, 6.3_
  - _Boundary: CI Workflow Integration_
  - _Depends: 3.1_

- [x] 3.3 required status check の path-filter 回避用ミラー job を追加する
  - `frontend/**` を変更しない PR 向けの既存ミラーワークフローに、E2E job と同名の常時成功ジョブを追加する
  - ジョブ名が本体ワークフロー側と完全に一致していることを確認する
  - _Requirements: 5.3_
  - _Boundary: CI Workflow Integration_
  - _Depends: 3.1_

- [x]* 3.4 CI ワークフロー構造の回帰テストを追加する
  - 既存のワークフロー構造テストに、E2E job の存在・依存関係（`deploy-preview` 後続であること）・ミラー job とのジョブ名一致を検証するケースを追加する
  - 上記アサーションが CI 上で自動検証される状態にする
  - _Requirements: 2.1, 5.3_
  - _Depends: 3.1, 3.3_

- [ ] 4. Validation: マージ前ゲート化と実環境での動作確認
- [ ] 4.1 E2E 結果を `main` の必須ステータスチェックに組み込む
  - `main` branch protection の必須ステータスチェック一覧に、既存3件を維持したまま E2E job の名称を追加する
  - 追加後に設定を再取得し、必須チェックが4件揃っていることを確認する
  - E2E job が失敗または pending のままの PR が `main` にマージできない状態になっていることを確認する
  - _Requirements: 5.1, 5.2, 5.4_
  - _Boundary: Branch Protection Config_
  - _Depends: 3.1, 3.3_

- [ ] 4.2 実際の PR で一連の流れをエンドツーエンドに確認する
  - 実 PR を作成し、`deploy-preview` 完了後に E2E job が連結して起動し、Cloudflare Access Service Token ヘッダで人間向けログインを経由せずプレビューに到達することを確認する
  - プレビュー伝播中の一時的な未到達がタイムアウト診断（テスト失敗と区別可能なメッセージ）として扱われることを確認する
  - fork PR では E2E job が secrets 要求なくスキップされ、そのことだけを理由に必須チェックがマージを永久ブロックしないことを確認する
  - Service Token が無効な値の場合に「Cloudflare Access によるブロック」と「アプリケーション側の失敗」が診断メッセージ上で区別されることを確認する
  - PR の必須ステータスチェックに `main` branch protection で設定した E2E チェック名が実際に表示されることを確認する
  - _Requirements: 2.2, 2.4, 2.6, 2.7, 5.2, 5.3, 8.4, 8.5_
  - _Depends: 4.1_

## 対象外・別リポジトリへ委譲した要件

- Requirement 8.1（`aramakisai-infra` での Cloudflare Access Service Token リソース定義）と 8.2（対応する Access Policy 追加）は、design.md の Boundary Commitments により本 spec の Out of Boundary（`aramakisai-infra` リポジトリの Terraform 実装、別 PR）として明示的に除外されている。本 spec のタスクはこれらが Infisical `staging` 環境の secret として供給されることを前提とし（3.1, 4.2）、Terraform リソース自体の実装タスクは含めない。
