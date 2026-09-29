# Requirements Document

## Project Description (Input)
FAQページ (/faq) を実装する。CMS (Payload, cms/) 側に faq_items コレクションは実装済み。本番のトップページから /faq へリンクされているが現在 404 になっている。frontend/ (Next.js, OpenNext で Cloudflare Workers) に /faq ページを追加し、faq_items を REST で取得して表示する。開催前必須。

## Introduction
サイト共通ヘッダー・フッターの「ご案内」配下にある「よくある質問」(`/faq`)は、現状ページ本体が存在せず404を返している。本機能では、CMSの`faq_items`コレクション(質問・回答・表示順)に登録された質問と回答を一覧で掲載するFAQページを提供する。`/faq`は開催前フェーズでも公開するパスとして登録済みであり、開催前/開催中の両フェーズで閲覧できる必要がある。

## Boundary Context
- **In scope**: `/faq`での`faq_items`全件の表示、表示順、0件時・CMS取得失敗時の表示、ページのメタデータ・パンくずの構造化データ、sitemapへの掲載
- **Out of scope**: 質問の検索・絞り込み、カテゴリ分け(`faq_items`にカテゴリのフィールドは無い)、問い合わせフォーム、`faq_items`コレクション定義の変更、FAQPageの構造化データ、ヘッダー・フッター・開催前フェーズの公開パス一覧の変更(いずれも`/faq`を登録済み)
- **Adjacent expectations**: `faq_items`は公開状態のフィールドを持たず、未認証でも全件読める(`cms/src/access/policy.ts`の公開判定)。回答はプレーンテキスト(textarea)で保存される

## Requirements

### Requirement 1: FAQページの表示
**Objective:** As a来場者, I want荒牧祭に関するよくある質問と回答を一か所で読みたい, so that問い合わせをせずに疑問を解消できる

#### Acceptance Criteria
1. When 利用者が`/faq`にアクセスしたとき, the FAQページ shall 「よくある質問」を主見出しとして表示する
2. When 利用者が`/faq`にアクセスしたとき, the FAQページ shall CMSの`faq_items`に登録された全項目の質問と回答を1ページに掲載する
3. The FAQページ shall 各項目の回答を、対応する質問と視覚的にも支援技術上も対応づけて表示する
4. The FAQページ shall 回答をCMSに入力された改行を保ったプレーンテキストとして表示し、HTMLとして解釈しない
5. The FAQページ shall 各項目を、質問を押すと回答を開閉するアコーディオンとして表示し、開閉をキーボードで操作可能にし、開閉状態を支援技術に伝える
6. The FAQページ shall サイト共通のヘッダー・フッターを伴うルートグループ`(site)`のページとして表示する
7. The FAQページ shall 開催前フェーズ・開催中フェーズのいずれでも閲覧可能とする
8. When 利用者が`/faq`にアクセスしたとき, the FAQページ shall 全項目の回答を閉じた状態で表示する

### Requirement 2: 表示順
**Objective:** As a実行委員, I want CMSで指定した順に質問を並べたい, so that重要な質問を上に配置できる

#### Acceptance Criteria
1. The FAQページ shall 項目を`faq_items`の表示順(`sort`)の昇順で表示する
2. If 表示順が未設定の項目があるとき, the FAQページ shall その項目を表示順が設定された項目の後に表示する
3. When 実行委員がCMSで項目を追加・変更・削除したとき, the FAQページ shall 再デプロイを経ずに次回以降のリクエストでその内容を反映する

### Requirement 3: 0件時・取得失敗時の表示
**Objective:** As a来場者, I want質問が無いときやCMSに接続できないときもページが壊れずに表示されてほしい, so that状況を把握して他の導線へ移れる

#### Acceptance Criteria
1. If `faq_items`に項目が1件も無いとき, the FAQページ shall 主見出しとともに「よくある質問はありません」と表示する
2. If CMSからの`faq_items`の取得に失敗したとき, the FAQページ shall エラーページや404を返さず、0件時と同じ表示で応答する
3. The FAQページ shall 0件時・取得失敗時もHTTPステータス200で応答する

### Requirement 4: 検索エンジン向けメタデータ
**Objective:** As a実行委員, I want FAQページが他のページと同じ形式で検索エンジンやSNSに認識されてほしい, so that来場者が検索や共有からページに辿り着ける

#### Acceptance Criteria
1. The FAQページ shall 既存の一覧ページと同じ形式で、タイトル「よくある質問」とFAQページ固有の固定の説明文をページのメタデータとして出力する
2. The FAQページ shall canonical URLとOGPのURLを`/faq`とする
3. The FAQページ shall 「ご案内」配下の固定ページと同じく、トップ→よくある質問の2階層のパンくずを構造化データ(BreadcrumbList)として出力する
4. The FAQページ shall FAQPageの構造化データを出力しない

### Requirement 5: sitemapへの掲載
**Objective:** As a実行委員, I want FAQページがsitemapに載ってほしい, so that検索エンジンにページを見つけてもらえる

#### Acceptance Criteria
1. While 現在のクロール時フェーズで`/faq`が公開対象であるとき, the sitemap shall `/faq`のURLをエントリとして含める
2. The sitemap shall `/faq`のエントリの最終更新日時を、`faq_items`の各項目の更新日時のうち最新のものとする
3. If `faq_items`に項目が1件も無いとき, the sitemap shall `/faq`のエントリを最終更新日時なしで含める
4. If CMSからの`faq_items`の取得に失敗したとき, the sitemap shall `/faq`のエントリのみを欠落させ、他のエントリは通常どおり応答する
5. The sitemap shall `/faq`を`pages`コレクションの固定ページとしては扱わず、`pages`に同じslugのレコードが無くても`/faq`を掲載する
