# Requirements Document

## Project Description (Input)

荒牧祭サイトのヘッドレス CMS を Directus から Payload CMS へ移行する。

### 移行の動機

1. **無償ライセンスが custom permission rule を無効化する (決定打)**
   Directus 12.1.1 の `CORE_LICENSE` は `custom_permission_rules_enabled: false` のため、
   `PermissionsService.readByQuery` が「行レベルフィルタを持つ」「`fields` が `*` を含まない」
   「`validation` / `presets` が空でない」いずれかに該当する `directus_permissions` 行を、
   エラーもログも出さずに権限評価から除外する。例外は `@directus/system-data` の
   `appRecommendedPermissions` と完全一致する行のみで、ユーザー定義コレクションは 1 件も含まれない。
   結果として `student_exhibitor` ロールは Directus 12 移行後 1 度も機能しておらず、
   `directus/migrations/` 配下の RBAC マイグレーション群が投入したフィルタ付き権限も
   prod / staging で無効になっている。
   出展者に自分の企画だけを編集させるという要件は、Directus の無償ライセンス下では実現できない。

2. **OIDC 認証の無料枠が v11 までで終了している**
   v12 以降で OIDC を使うには有料プランが必要。委員会メンバーの認証を外部 IdP に寄せる方針と衝突する。

3. **RBAC モデルの複雑さ**
   `directus_policies` → `directus_access` → `directus_permissions` の 3 階層に加え、
   permission キャッシュが custom migration の直接書き込みで更新されず再起動が要るなど、
   運用上の落とし穴が多い。障害調査のたびに「キャッシュか、ライセンスか、権限行か」の切り分けが発生している。

### 移行対象

- コレクション / スキーマ: 現行 `directus/schema/snapshot.yaml` が定義する 16 コレクション
  (`announcements`, `topics`, `student_exhibitions`, `sponsors`, `stages`, `performance_slots`,
  `map_areas`, `time_slots`, `faq_items`, `festival_meta`, `page_home`, `pages`,
  および `*_files` 中間テーブル)
- 既存データ: 本番 Postgres 上の実データ
- 認証・認可: 実行委員ロール、および出展者による自企画のみの編集 (行レベル access control)
- メディア: アップロード済みファイルと、Directus hook で実装した画像最適化 (WebP 変換 / リサイズ)
- フロントエンド: `frontend/src/lib` の Directus SDK 依存箇所と、それを利用する App Router 配下のページ
- インフラ: K8s 上の Directus Deployment / schema-apply Job / ArgoCD 連携、
  および `aramakisai-web` → `aramakisai-infra` のスキーマ同期ワークフロー

### 判断が必要な論点 (design フェーズで詰める)

- Payload のホスティング形態 (K8s 上の自前運用か、Cloudflare Workers 同居か、Payload Cloud か)
- 既存 Postgres の再利用可否 (`@payloadcms/db-postgres` で既存テーブルを引き継ぐか、新スキーマへデータ移送するか)
- 移行方式 (一括カットオーバーか、コレクション単位の段階移行か)
- メディアストレージの移行先と、既存ファイル ID / URL の互換性
- 認証方式 (Payload 標準認証 + OIDC 連携、あるいは外部 IdP 連携)
- 移行期間中の運用 (Directus と Payload の並行稼働の要否)

### 制約

- 本番サイトは公開中であり、ダウンタイムと URL 変更を最小化する
- `additive-only` ルールと同様に、破壊的変更はフロントエンドのデプロイ完了後に行う
- シークレットは Infisical 管理。`.env` は使用禁止
- インフラ変更は `aramakisai-infra` リポジトリ側の PR が必要

## Introduction

本仕様は、荒牧祭サイトのヘッドレス CMS を Directus 12 から Payload CMS へ移行するための要件を定義する。

移行の目的は機能追加ではなく **現行の運用要件を実際に成立させること** にある。とりわけ「出展者が自分の企画レコードだけを編集できる」という要件は、Directus の無償ライセンスでは構造的に実現不能であり、これが移行の主要な駆動要因である。したがって本仕様は「Payload に載せ替えること」ではなく「載せ替えた結果、行レベル access control・外部 IdP 認証・GitOps によるスキーマ管理が同時に成立していること」をゴールとする。

読者向けの Web サイト (フロントエンド) の表示内容・URL 構造は移行前後で変わらないことを前提とする。移行は編集者と運用者から見た CMS の入れ替えであり、来場者から見て観測可能な変化があってはならない。

## Boundary Context

- **In scope**:
  - Payload のコンテンツモデル定義、access control、認証方式の設計と実装
  - 既存 Postgres データおよびメディア資産の移送と同一性検証
  - フロントエンドのデータ取得層 (`frontend/src/lib/*`) と型定義の差し替え
  - K8s / ArgoCD 上の Payload 稼働基盤と、スキーマ変更を GitOps に載せる仕組み
  - カットオーバー手順、ロールバック手順、および Directus の廃止
- **Out of scope**:
  - サイトの情報設計・デザイン・ページ追加といったコンテンツ側の変更
    (`page-home-friendly-editing` / `home-page-expansion` の所有領域)
  - Cloudflare Workers 上のフロントエンド配信構成そのものの変更
    (`frontend-scaffold` / `cicd-pipeline` の所有領域)
  - 新規コレクション・新規フィールドの追加 (移行完了後に別 spec で扱う)
- **Adjacent expectations**:
  - `student-exhibitions-schema-fix` は RBAC 部分を本仕様に委譲済み。同 spec の
    `student_exhibitions` スキーマ変更は Directus 側で先に適用され、Payload はその結果を引き継ぐ。
  - `additive-only-schema-check` / `cicd-pipeline` が所有する `directus-schema-sync.yml` と
    `additive-schema-check.yml` は、Directus 廃止に伴い置換または撤去の対象になる。
  - `error-monitoring` が定義する監視対象に Payload を追加する必要がある。

## Requirements

### Requirement 1: 移行方式の選定と検証

**Objective:** 開発者として、ホスティング形態・DB 戦略・移行方式を実証データに基づいて決定したい。そうすることで、後戻りコストの大きい選択を推測で行わずに済む。

#### Acceptance Criteria

1. The Payload 移行プロジェクト shall ホスティング形態・データベース戦略・メディアストレージ・認証方式・移行方式の 5 論点について、選定した案・却下した案・選定理由を design.md に記録する。
2. When 候補となるホスティング形態を評価するとき, the Payload 移行プロジェクト shall Cloudflare Workers (Edge Runtime) 上で Payload の管理画面と API が動作するか否かを実機で検証し、結果を記録する。
3. When 既存 Postgres の再利用可否を評価するとき, the Payload 移行プロジェクト shall 現行 16 コレクションのうち Payload のスキーマ規約に適合しないものを列挙する。
4. If いずれかの論点で実機検証が不能または非現実的である, then the Payload 移行プロジェクト shall 検証不能である理由と、代替として採用する判断根拠を明示する。
5. The Payload 移行プロジェクト shall 選定結果に基づき、移行に要するダウンタイムの見積もりを提示する。

### Requirement 2: 出展者による自企画のみの編集

**Objective:** 学生模擬店の担当者として、自分の出展レコードだけを CMS 上で編集したい。そうすることで、実行委員会に更新を依頼せずに情報を最新化できる。

#### Acceptance Criteria

1. While 出展者ロールのユーザーがログインしている, when 自分が作成した `student_exhibitions` レコードを更新する, the Payload CMS shall その更新を許可する。
2. While 出展者ロールのユーザーがログインしている, when 他者が作成した `student_exhibitions` レコードを更新しようとする, the Payload CMS shall その操作を拒否する。
3. While 出展者ロールのユーザーがログインしている, when `student_exhibitions` の一覧を取得する, the Payload CMS shall 自分が作成したレコードのみを返す。
4. If 出展者ロールのユーザーが編集を許可されていないコレクションへ書き込みを試みる, then the Payload CMS shall その操作を拒否し、権限エラーを返す。
5. The Payload CMS shall 行レベルの access control を、有償ライセンスや追加プランを必要とせずに適用する。
6. The Payload 移行プロジェクト shall 上記 1〜4 の挙動を自動テストで検証する。

### Requirement 3: 実行委員ロールと認証

**Objective:** 実行委員会メンバーとして、外部 IdP のアカウントで CMS にログインし、全コンテンツを管理したい。そうすることで、CMS 固有のパスワードを個別管理せずに済む。

#### Acceptance Criteria

1. While 実行委員ロールのユーザーがログインしている, the Payload CMS shall 全コレクションに対する作成・読取・更新・削除を許可する。
2. Where 外部 IdP 連携が有効である, when ユーザーが IdP 経由でログインする, the Payload CMS shall 対応するロールを付与したセッションを確立する。
3. The Payload CMS shall 外部 IdP 連携を、有償ライセンスや追加プランを必要とせずに提供する。
4. If 未認証のリクエストが管理画面または書き込み系 API に到達する, then the Payload CMS shall 認証エラーを返し、コンテンツを露出しない。
5. When 公開済みコンテンツが未認証でリクエストされる, the Payload CMS shall フロントエンドが必要とする読取専用のレスポンスを返す。
6. The Payload 移行プロジェクト shall ロールと権限の定義をコードとして Git 管理し、管理画面上の手作業設定に依存しない。

### Requirement 4: コンテンツモデルの移植

**Objective:** 開発者として、現行 Directus スキーマと等価なコンテンツモデルを Payload 上で定義したい。そうすることで、編集者の作業手順とフロントエンドの参照構造を維持できる。

#### Acceptance Criteria

1. The Payload CMS shall 現行 `snapshot.yaml` が定義する 16 コレクションに対応するコレクションまたはグローバルを提供する。
2. When 現行スキーマがシングルトン (`festival_meta`, `page_home`) を定義している, the Payload CMS shall 対応する構造を単一レコードとして提供する。
3. The Payload CMS shall 現行スキーマの o2m / m2m リレーション (`performance_slots` と `student_exhibitions`、各 `*_files` 中間テーブル等) と等価な参照関係を保持する。
4. The Payload CMS shall 現行スキーマで必須・選択肢・既定値が設定されているフィールドについて、同等の制約を適用する。
5. Where 現行の CHECK 制約・複合 UNIQUE が custom migration で管理されている, the Payload CMS shall 同等の制約を維持する。
6. The Payload 移行プロジェクト shall コンテンツモデル定義を TypeScript として Git 管理し、型定義をフロントエンドから参照可能にする。

### Requirement 5: 既存データの移行

**Objective:** 実行委員会メンバーとして、これまで登録したコンテンツを失わずに新 CMS へ引き継ぎたい。そうすることで、移行のために再入力する作業が発生しない。

#### Acceptance Criteria

1. When 移行を実行する, the データ移行処理 shall 本番 Postgres 上の全コレクションのレコードを Payload のデータ構造へ移送する。
2. When 移行が完了した, the データ移行処理 shall 移行元と移行先のレコード件数をコレクション単位で比較し、一致を検証する。
3. When 移行が完了した, the データ移行処理 shall リレーション参照が移行先で解決可能であることを検証する。
4. If 移行中にレコード単位の変換失敗が発生する, then the データ移行処理 shall 対象レコードを特定できる形でログに記録し、処理を中断する。
5. The データ移行処理 shall 再実行しても結果が重複しない冪等な形で実装する。
6. The データ移行処理 shall 移行前に本番データベースのバックアップを取得済みであることを前提条件として明示する。

### Requirement 6: メディア資産の移行と配信

**Objective:** 来場者として、移行後もサイト上の画像が同じ URL で同じ品質で表示されてほしい。そうすることで、リンク切れや表示崩れに遭遇しない。

#### Acceptance Criteria

1. When 移行を実行する, the メディア移行処理 shall Directus に保存済みの全ファイルを Payload のメディアストレージへ移送する。
2. When フロントエンドが移行前に生成した画像 URL をリクエストする, the 配信基盤 shall 同一の画像を返すか、恒久リダイレクトで新 URL へ誘導する。
3. When 編集者が JPEG / PNG / WebP 画像をアップロードする, the Payload CMS shall 現行の Directus hook と同等の最適化 (WebP 変換・上限サイズへのリサイズ) を適用する。
4. If 画像最適化に失敗する, then the Payload CMS shall 原本を保持したままアップロードを完了させ、警告を記録する。
5. When フロントエンドが表示幅を指定して画像を要求する, the 配信基盤 shall 指定幅に応じた画像を返す。
6. The メディア移行処理 shall 移行元と移行先のファイル件数および合計サイズを比較し、欠落がないことを検証する。

### Requirement 7: フロントエンドのデータ取得層の差し替え

**Objective:** 開発者として、フロントエンドの CMS 依存を Payload 向けに置き換えたい。そうすることで、Directus SDK と Directus 固有のクエリ形式への依存を解消できる。

#### Acceptance Criteria

1. The フロントエンド shall `frontend/src/lib` 配下のデータ取得関数を Payload の API 経由に置き換え、`@directus/sdk` への依存を削除する。
2. When ページがレンダリングされる, the フロントエンド shall 移行前と同一の表示内容を生成する。
3. The フロントエンド shall CMS のレスポンス型を TypeScript の型として保持し、`any` を使用しない。
4. The フロントエンド shall CMS のエンドポイント URL を `src/env.ts` の zod スキーマ経由で参照し、`process.env` を直接参照しない。
5. If CMS への参照が失敗する, then the フロントエンド shall 現行と同等のエラーハンドリング (エラーページ表示・部分的な描画継続) を維持する。
6. When Edge Runtime 上で実行される, the フロントエンド shall Node.js 専用 API に依存せずに CMS を参照する。
7. The フロントエンド shall 差し替え後も既存のコンポーネント/ロジックテストが通ることを保証する。

### Requirement 8: 稼働基盤とスキーマ変更の GitOps 運用

**Objective:** 開発者として、Payload のコンテンツモデル変更を Git 管理下のレビュー可能な経路で本番へ反映したい。そうすることで、Directus で確立した運用規律を維持できる。

#### Acceptance Criteria

1. The Payload 稼働基盤 shall prod と staging の 2 環境で稼働する。
2. When コンテンツモデル定義の変更が `main` にマージされる, the デプロイパイプライン shall 対応するデータベース変更を prod と staging に適用する。
3. When コンテンツモデル定義を変更した PR が作成される, the CI shall 破壊的変更 (フィールド削除・型変更) を機械的に検出して報告する。
4. If 破壊的変更が検出された, then the CI shall フロントエンド側の対応がデプロイ済みであることの確認を要求する。
5. The Payload 稼働基盤 shall シークレットを Infisical から注入し、`.env` ファイルを使用しない。
6. When 障害が発生する, the 監視基盤 shall Payload の異常を既存の監視経路で検知できる。
7. The Payload 移行プロジェクト shall Directus 向けの `directus-schema-sync.yml` および `additive-schema-check.yml` の後継または撤去方針を定義する。

### Requirement 9: カットオーバーとロールバック

**Objective:** 実行委員会メンバーとして、移行作業でサイトが長時間停止しないことを保証したい。そうすることで、来場者への影響と告知コストを抑えられる。

#### Acceptance Criteria

1. The Payload 移行プロジェクト shall カットオーバー手順を、実行順序・所要時間・担当・確認項目を含む形で文書化する。
2. When カットオーバーを実行する, the 移行手順 shall 公開サイトの停止時間を事前に見積もった範囲内に収める。
3. When カットオーバーが完了した, the 移行手順 shall 主要ページの表示と CMS の書き込みが正常であることを確認する検証項目を提供する。
4. If カットオーバー後に重大な不具合が判明する, then the 移行手順 shall Directus 構成へ復帰するロールバック手順を提供する。
5. While ロールバックが可能な期間である, the 移行手順 shall Directus 側のデータベースとメディアを削除しない。
6. Where 段階移行方式を採用する, the 移行手順 shall Directus と Payload が同時に参照される期間の整合性維持方法を定義する。

### Requirement 10: 移行後の検証と Directus の廃止

**Objective:** 開発者として、移行完了後に旧構成を確実に撤去したい。そうすることで、二重管理による設定ドリフトと無駄なリソース消費を防げる。

#### Acceptance Criteria

1. When 移行後の安定稼働が確認された, the Payload 移行プロジェクト shall Directus の Deployment・スキーマ適用 Job・関連 ConfigMap を削除する。
2. When Directus を廃止する, the Payload 移行プロジェクト shall `directus/` 配下のスキーマ定義・custom migration・拡張のうち不要になったものを削除する。
3. When Directus を廃止する, the Payload 移行プロジェクト shall 不要になった Directus 向けシークレットと DNS レコードの扱いを決定する。
4. The Payload 移行プロジェクト shall steering (`product.md` / `tech.md` / `structure.md`) の Directus 記述を Payload 構成に更新する。
5. If 廃止時点で Directus にしか存在しないデータまたは設定が残っている, then the Payload 移行プロジェクト shall 廃止を保留し、残存項目を記録する。
