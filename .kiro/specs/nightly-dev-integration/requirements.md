# Requirements Document

## Project Description (Input)
nightlyで変更された部分をdevに反映させていきたい
nightlyは叩き台なのでCRUDで制御できる部分も静的ファイルなのでそこら辺も整理したい

## Introduction

`nightly` ブランチには、公式サイトのデザインを大幅に刷新した叩き台が存在する (`dev` との差分は 27 ファイル、+2237/-242)。追加されたヘッダーのドロップダウンナビゲーション、ヒーロースライドショー、`AboutSection`、プライバシーポリシーページ、フッター刷新は、いずれも Directus を参照せずコンポーネント内へ直接値を書き込んだ実装になっている。その結果、`dev` 側で既に Directus 管理下にあった要素 (ヒーロー画像・SNS リンク・固定ページ本文) が静的値へ差し戻される回帰が発生している。

本 spec は、`nightly` のデザイン成果を `dev` へ取り込みつつ、サイト上の各コンテンツを「Directus で運営者が CRUD 管理するもの」と「コードに残すもの」に整理し直すことを目的とする。学生主体の運営体制でコード変更なしにコンテンツを更新できる状態を維持することが、この整理の価値である。

## Boundary Context

- **In scope**: `nightly` 差分の `dev` への反映、静的ハードコード要素の棚卸しと管理先の判定、既存 Directus collection/フィールドを用いた CRUD 化、それに伴う additive なスキーマ追加、静的画像アセットの整理、対応するテストの追加・更新
- **Out of scope**:
  - 新設ページ (会場マップ・タイムテーブル・出展一覧・FAQ) の実装とそのためのスキーマ設計 — `sitemap-schema-review` spec が後続 spec への切り出しを明示している領域。本 spec ではナビゲーションのリンク切れ解消までを扱い、新規ページ本体は実装しない
  - `additive-schema-check.yml` の一時停止解除 — `sitemap-schema-review` spec の所有物
  - デザイン自体の再設計 (`nightly` のビジュアル方針そのものへの変更提案)
- **確定済みの方針** (gap-analysis.md の提言を採用):
  - `nightly` が `dev` から削除した要素は、削除を採用せず保持する (リジェクト)
  - 既存スキーマで受けられるコンテンツは Directus へ登録し、投入対象を一覧化した上で管理画面の手作業または REST API で投入する
  - 既存スキーマに受け皿のない要素 (テーマ・スローガン等) は additive なフィールド追加で対応し、本 spec 内で扱う
  - `AboutSection` (静的) と `FestivalOverview` / `FestivalSummary` (Directus 駆動) の二重表示は、`nightly` のレイアウトを維持しつつデータを Directus から供給する形で解消する。事前告知フェーズと直前〜当日フェーズは同時に表示されないため、フェーズごとの内容は単一の経路で描画する
  - Directus データの供給方式は `dev` 側の仕様を採用する (サーバーコンポーネントで取得し、表示コンポーネントへ props で渡す)
  - 追加フィールドの配置は `dev` 側の既存の使い分け (`page_home` = ホームページ固有、`festival_meta` = 祭全体のメタ情報) に従う
  - `/about` ルートは廃止し、ホームページの `#about` セクションへ一本化する
  - プライバシーポリシーは Directus 側の WYSIWYG (`pages.content`) へ統合し、静的ルートは廃止する
  - 実装は gap-analysis.md の Option C (段階導入) に従う
- **ブランチ運用**: 作業ブランチは `nightly`、マージ先は `dev` とする。`nightly` を破棄して差分を別ブランチへ移植するのではなく、`nightly` 上で整理を進め、`nightly` → `dev` の PR として反映する。`dev` への直接コミットは行わない。
- **Adjacent expectations**:
  - `sitemap-schema-review` spec の Data Models 判定結果 (既存 collection の統廃合方針、`page_home_live` 廃止) を入力として参照する
  - Directus スキーマ変更は additive-only ルールと staging 事前検証の運用に従う
  - `home-page-expansion` / `page-home-friendly-editing` の両 spec が扱う `page_home` / `festival_meta` の編集体験に影響する場合、該当 spec の Revalidation Triggers を確認する

## Requirements

### Requirement 1: nightly デザイン差分の dev への反映

**Objective:** As a 開発者, I want `nightly` のデザイン刷新を `dev` へ取り込みたい, so that 公開サイトの見た目を新デザインへ更新できる

#### Acceptance Criteria

1. The 統合作業 shall `nightly` に含まれる全変更 (`Header` / `Footer` / `HeroSection` / `AboutSection` / プライバシーポリシーページ / `globals.css` / レイアウトおよび折り返し調整) の反映要否を要素単位で判定し、判定結果を記録する
2. When 反映が完了した, the 公式サイト shall `dev` 側の既存 Directus 連携機能 (お知らせ・トピックス・祭概要・添付ファイル・SNS リンク・`pages` collection 経由の固定ページ) を退行させずに動作させる
3. If `nightly` が `dev` 側の要素 (フッターの住所・連絡先、`HeroSection` の props、`getSnsLinks()` の呼び出し等) を削除している, then the 統合作業 shall その削除を採用せず、`nightly` のデザインに沿った形で当該要素を復活させる。ただし `/about` ルートおよびそのナビゲーションは廃止方針が確定しているため、この復活の対象外とする
4. When 同一情報が静的実装と Directus 駆動実装の両方で描画されている, the 統合作業 shall `nightly` のレイアウトを維持したままデータ供給元を Directus に一本化し、`page.tsx` からの重複描画を取り除く
5. When 開催日程を表示する, the 公式サイト shall `festival_meta.event_days` の値を `MM月DD日 HH:mm〜HH:mm` の形式で描画する
6. The 統合作業 shall 作業を `nightly` ブランチ上で行い、`nightly` → `dev` の PR として反映する
7. While `nightly` が `dev` より遅れている, the 統合作業 shall `dev` の最新内容を `nightly` に取り込んでから作業を進める
8. When CI が実行された, the CI shall `type-check` / `lint` / `format:check` / `test` / `build` を全て成功させる

### Requirement 2: 静的コンテンツの棚卸しと管理先の決定

**Objective:** As a 実行委員会の運営者, I want サイト上の文言・画像がどこで管理されるかを明確にしたい, so that コード変更なしにコンテンツを更新できる

#### Acceptance Criteria

1. The 統合作業 shall `nightly` が導入したハードコード要素 (ヒーロー画像 5 点、About セクションの概要文・開催スケジュール・今年のテーマ、キャンパスマップの埋め込み URL、プライバシーポリシー本文、ヘッダー/フッターのナビゲーション項目、SNS リンク、お問い合わせフォーム URL、フッターの住所・連絡先) を漏れなく一覧化する
2. When 各要素を分類する, the 統合作業 shall 「既存スキーマで受けられるもの = Directus へ登録」「受け皿がないもの = additive なフィールド追加の上で Directus 管理」「ナビゲーション定義・コピーライト等の構造的要素 = コードに残す」という方針に沿って振り分ける
3. Where 既存の collection / フィールドで表現できる要素がある, the 統合作業 shall 新規スキーマを追加せず既存のものを利用する
4. If Directus 管理が必要でありながら既存スキーマで表現できない, then the 統合作業 shall additive-only ルールに従うフィールド追加として設計する
5. The 統合作業 shall 「コードに残す」と判定した要素について、その理由を残す

### Requirement 3: ヒーロー画像の Directus 管理への復帰

**Objective:** As a 実行委員会の運営者, I want トップページのヒーロー画像を Directus から差し替えたい, so that 写真の入れ替えにデプロイを必要としない

#### Acceptance Criteria

1. While Directus からヒーロー画像が取得できる, the 公式サイト shall 静的ファイルではなく取得した画像をスライドショーに表示する
2. When 画像が複数取得された, the 公式サイト shall Directus 上の並び順に従って表示する
3. If Directus からの取得に失敗した、または画像が 0 件だった, then the 公式サイト shall ページ全体をエラーにせず、定義済みのフォールバック表示を行う
4. The 公式サイト shall 画像の取得元にかかわらず、自動送り・前後ナビゲーション・`prefers-reduced-motion` への対応を維持する

### Requirement 4: 固定ページの重複解消

**Objective:** As a 開発者, I want 同一内容の固定ページが複数の経路で提供される状態を解消したい, so that 運営者が更新すべき場所を一意に特定できる

#### Acceptance Criteria

1. The 公式サイト shall 同一内容の固定ページを、静的ルートと `pages` collection 経由の動的ルートの両方で提供しない
2. When プライバシーポリシーを表示する, the 公式サイト shall `pages` collection の WYSIWYG (`content`) を出所とし、`/[slug]` 経由の単一ルートで提供する
3. The 統合作業 shall `nightly` が追加した静的ルート (`src/app/privacy-policy/`) を対応するテストとともに削除する
4. When フッターからプライバシーポリシーへ遷移する, the 公式サイト shall 統一後のルートへリンクする
5. Where `nightly` の静的実装が持つ構造 (見出し階層・箇条書き・段落) がある, the 統合作業 shall その内容を WYSIWYG で表現できる形へ移し替え、内容を欠落させない
6. The 統合作業 shall `/about` ルートを廃止し、ホームページの `#about` セクションへ一本化する

### Requirement 5: ナビゲーションとサイト共通要素の整合性

**Objective:** As a 来場者, I want ヘッダー・フッターのリンクから正しくページへ遷移したい, so that 目的の情報にたどり着ける

#### Acceptance Criteria

1. The 公式サイト shall ヘッダー / フッターのナビゲーションから、存在しないルート (404 となるリンク) を提供しない
2. If `nightly` のナビゲーションが未実装ルート (`/events` / `/guide` / `/sponsors` / `/news`) を指している, then the 統合作業 shall 既存ルートへの張り替え・当該項目の一時非表示のいずれかで 404 を解消する
3. When SNS リンクを表示する, the 公式サイト shall `festival_meta.sns_links` の値を参照し、コード内の固定値を使用しない
4. If SNS リンクの取得に失敗した, then the 公式サイト shall 該当領域を非表示にし、フッター全体の表示を維持する
5. Where お問い合わせ先・連絡先を Directus 管理とすると判定した, the 公式サイト shall その値を参照して表示する

### Requirement 6: 静的画像アセットの整理

**Objective:** As a 開発者, I want リポジトリと配信ペイロードに不要な巨大画像を残したくない, so that クローン時間と初回表示速度を悪化させない

#### Acceptance Criteria

1. When ヒーロー画像を Directus 管理へ移す, the 統合作業 shall 対応する `frontend/public/images/top/` 配下の静的ファイルを削除する
2. Where コードに残すと判定した画像 (ロゴ等) がある, the 統合作業 shall 配信サイズを削減した形式で保持する
3. The 統合作業 shall リポジトリに追跡される単一画像ファイルのサイズ上限方針を定め、それを超えるファイルを追加しない
4. The 公式サイト shall Cloudflare Workers / Edge Runtime の制約に反しない方式で画像を配信する

### Requirement 7: テストによる回帰防止

**Objective:** As a 開発者, I want 静的から Directus 管理への切り替えが壊れていないことを自動で確認したい, so that デザイン刷新後も安心して変更を重ねられる

#### Acceptance Criteria

1. When コンポーネントを追加・変更した, the 統合作業 shall 同一階層に `*.test.tsx` を追加または更新する
2. The テスト shall Directus からの取得成功時と失敗時の双方について、表示内容とフォールバック挙動を検証する
3. If 静的から Directus 管理への切り替えにより既存テストのモック前提が変わる, then the 統合作業 shall 該当テストを新しい前提へ更新する
4. The テスト shall ヘッダー / フッターのナビゲーション項目が実在するルートを指していることを検証する

### Requirement 8: スキーマ変更の安全性

**Objective:** As a 開発者, I want コンテンツの CRUD 化に伴うスキーマ変更を安全に反映したい, so that 本番 Directus のデータを破壊しない

#### Acceptance Criteria

1. Where Directus スキーマの変更が必要, the 統合作業 shall additive-only ルールに従い、collection / フィールドの削除・型変更・`is_nullable: true→false` を行わない
2. When `snapshot.yaml` を変更した, the 統合作業 shall staging 環境で事前検証してから main へ反映する
3. If 追加したフィールドに公開読み取り権限が必要, then the 統合作業 shall `directus/migrations/` の RBAC migration として定義し、適用後の Directus 再起動を手順に含める
4. When フロントエンドが新しいフィールドを参照する, the 公式サイト shall そのフィールドが未投入 (null / 空) の状態でもエラーにならず表示を継続する

### Requirement 9: Directus へのコンテンツ投入

**Objective:** As a 実行委員会の運営者, I want 静的コードから移すコンテンツを Directus 上に揃えたい, so that 新デザインの公開時点で表示すべき内容が欠けない

#### Acceptance Criteria

1. The 統合作業 shall Directus へ投入すべきコンテンツを一覧化したドキュメントを `nightly` ブランチ上に作成する
2. The 投入一覧 shall 各項目について、投入先の collection とフィールド、値の出所 (静的コード上の該当箇所)、投入手段 (Directus 管理画面での手作業 / REST API) を含む
3. Where REST API で投入する, the 統合作業 shall 実行内容を再現可能な形 (スクリプトまたはリクエスト定義) で残す
4. When 投入が完了した, the 統合作業 shall 表示結果が静的実装時の内容と一致することを確認する
5. If コンテンツが未投入の状態でフロントエンドが参照した, then the 公式サイト shall 該当セクションを非表示にするか定義済みのフォールバックを表示し、エラーにしない
6. The 統合作業 shall 投入作業を本番 Directus へ直接行う前に staging または開発環境で確認する
