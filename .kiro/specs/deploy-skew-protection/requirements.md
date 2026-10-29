# Requirements Document

## Project Description (Input)
フロントエンドをデプロイすると、デプロイ前に開いていたタブが旧ビルドのチャンク (`/_next/static/chunks/*.js`・CSS) を要求して 404 になり、`ChunkLoadError` で画面遷移や表示が壊れる (dev.aramakisai.com で発生を確認)。旧ビルドを開いているタブが引き続き動くようにする。版ごとのプレビュー URL にかかっている Cloudflare Access の認証は外さない。今の開発体験を変えず、閲覧時の通信量とレスポンスタイムを増やさない。

## Introduction
公開サイトはデプロイのたびに静的アセットのファイル名が変わり、Workers は最新ビルドのアセットしか配信しない。そのため、デプロイ前にページを開いた来場者や実行委員がそのまま操作を続けると、旧ビルドのアセットを取得できずにエラーになる。本機能は、旧ビルドを開いているブラウザが必要とするアセットをデプロイ後も配信し続け、デプロイ直後でも閲覧が途切れないようにする。

## Boundary Context
- **In scope**: 本番 (aramakisai.com) と dev (dev.aramakisai.com) のデプロイ後に、旧ビルドを開いたタブが要求する静的アセット (`/_next/static/` 配下) を配信し続けること。旧タブのページ遷移で最新ビルドへ移ること。保持範囲を超えた旧ビルドからの要求の扱い。PR プレビューのビルドが本番・dev の利用者に配信されないこと。
- **Out of scope**: PR プレビュー URL 自体での旧ビルド対応、`/_next/static/` 以外の静的ファイル (`public/` 由来の画像・地図タイル等) の旧版保持、旧ビルドの画面のままページ遷移を続けること、CMS (`cms/`) のデプロイ、Service Worker・オフライン対応 (`pwa-offline`)、dev の版ごとのプレビュー URL が認証なしで開ける問題の是正 (別件)
- **Adjacent expectations**: 版ごとのプレビュー URL と dev サイトにかかる Cloudflare Access の保護は現状どおり維持する。PR の CI・PR プレビューの URL 発行・ローカル開発の手順は変えない。

## Requirements

### Requirement 1: 旧ビルドを開いたタブの継続動作
**Objective:** As a デプロイ前にページを開いていた閲覧者, I want デプロイ後も同じタブで操作を続けたい, so that エラー画面や表示崩れに遭わずに閲覧できる

#### Acceptance Criteria
1. When 新しいビルドが本番にデプロイされた後に旧ビルドを読み込んだタブが静的アセットを要求する, the 公開サイト shall 旧ビルドの静的アセットを応答する
2. When 新しいビルドが本番にデプロイされた後に旧ビルドを読み込んだタブがページ遷移する, the 公開サイト shall 最新ビルドで遷移先のページを表示する
3. When 新しいビルドが dev にデプロイされた後に旧ビルドを読み込んだタブが静的アセットを要求またはページ遷移する, the dev サイト shall 本番と同じく応答する
4. The 公開サイト shall 新規にページを開いた閲覧者には最新ビルドを応答する

### Requirement 2: 旧ビルドの保持範囲と範囲外の扱い
**Objective:** As a 長時間タブを開いたままにしている閲覧者, I want 保持範囲を超えたビルドでも操作不能にならないでほしい, so that 最新の画面に復帰できる

#### Acceptance Criteria
1. The 公開サイト shall 静的アセットを保持する旧ビルドの世代数を設定値として持つ
2. If 旧ビルドの静的アセットを取得できずに読み込みが失敗する, then the 公開サイト shall 閲覧者の操作なしに最新ビルドのページを読み込み直し、エラーを繰り返し出し続けない
3. If 読み込み直した後も静的アセットの取得に失敗する, then the 公開サイト shall 読み込み直しを繰り返さない

### Requirement 3: アクセス保護の維持
**Objective:** As a 実行委員会のサイト管理者, I want 版ごとのプレビュー URL と dev サイトの認証を外さずに旧ビルド対応を入れたい, so that 未公開の内容やテスト用ビルドが外部から見えない状態を保てる

#### Acceptance Criteria
1. The 旧ビルド対応 shall 版ごとのプレビュー URL にかかる Cloudflare Access の保護を解除しない
2. The 旧ビルド対応 shall dev サイト (dev.aramakisai.com) にかかる Cloudflare Access の保護を解除しない
3. The 旧ビルド対応 shall 旧ビルドの静的アセットを、そのビルドがデプロイされたサイトと同じアクセス保護の下でだけ配信する

### Requirement 4: PR プレビューとの分離
**Objective:** As a 実行委員会のサイト管理者, I want PR プレビューのビルドが本番や dev の閲覧者に配信されないでほしい, so that staging 用の設定や開発用 UI を含むビルドが本番に出ない

#### Acceptance Criteria
1. The 公開サイト shall 保持する旧ビルドを本番にデプロイされたビルドに限り、PR プレビューのビルドを含めない
2. The dev サイト shall 保持する旧ビルドを dev にデプロイされたビルドに限る
3. The PR プレビューの発行 shall 本番と dev の旧ビルドの保持世代数 (Requirement 2) を消費しない

### Requirement 5: 閲覧性能と開発体験の維持
**Objective:** As a 閲覧者と開発者, I want 旧ビルド対応の導入で閲覧の速さと開発の手順が変わらないでほしい, so that 導入による副作用を受けない

#### Acceptance Criteria
1. The 公開サイト shall 旧ビルド対応の導入前と同じ経路でページと静的アセットを応答し、1 回の閲覧で送受信する要求の数と量を、自動再読み込みのインラインスクリプトを除いて増やさない
2. The フロントエンド CI shall PR で実行するジョブの内容とプレビュー URL の形式を変えない
3. The ローカル開発環境 shall 起動手順と動作を変えない

### Requirement 6: デプロイ手順の自動化
**Objective:** As a フロントエンドを変更する開発者, I want 旧ビルド対応がデプロイのたびに手作業なしで更新されてほしい, so that 設定漏れで旧ビルド対応が途切れない

#### Acceptance Criteria
1. When `main` に push される, the フロントエンド CI shall 本番デプロイに保持範囲内の旧ビルドの静的アセットを含め、デプロイしたビルドを保持対象に加える
2. When `dev` に push される, the フロントエンド CI shall dev デプロイに保持範囲内の旧ビルドの静的アセットを含め、デプロイしたビルドを保持対象に加える
3. If 旧ビルドの保管先の読み書きに失敗する, then the フロントエンド CI shall デプロイを失敗させ、失敗した操作を出力する
4. If デプロイが失敗する, then the フロントエンド CI shall そのビルドを保持対象に加えない
5. The 開発者向けドキュメント shall 旧ビルド対応の仕組みと保持世代数の設定箇所を記載する
