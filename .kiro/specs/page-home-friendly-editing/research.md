# Research & Design Decisions

## Summary
- **Feature**: `page-home-friendly-editing`
- **Discovery Scope**: Extension(既存Directus/Next.jsシステムへの拡張)。ただし一部(WYSIWYGサニタイズ、Cloudflare Workersカスタムドメイン)は未知の外部依存を含むため、当該部分のみ深掘り調査を実施。
- **Key Findings**:
  - `announcements`/`topics` collectionが既存し、Home Pageの「お知らせ/トピックス可変ブロック」要件は新規Repeaterフィールドを作らず既存collection参照で満たせる。結果、新規collectionのフィールド構成を大幅に削減できた(`page_home_live`は実質 `hero_image`/`hero_message` の2フィールドのみで済む)
  - RBAC migration(`20260701C-rbac-roles.js`)は `fields: "*"` でCRUD権限を付与しているため、**既存collection(`page_home`, `festival_meta`)へのフィールド追加はRBAC変更不要**。RBAC変更が必要なのは新規collection(`page_home_live`)を追加する場合のみに限定される
  - Cloudflare Terraform provider(v4系)に `cloudflare_workers_custom_domain` リソースが存在し、`dev.aramakisai.com` のような Workers カスタムドメイン接続に使える。ただし `environment` 引数が Workers Assets(静的アセット同梱)構成と衝突する既知issueがあり、実装時の検証が必要
  - `opennextjs-cloudflare deploy --env=<name>` はwrangler named environment(`wrangler.toml`の`[env.<name>]`)をサポートしており、devブランチ専用の名前付き環境を追加してデプロイする構成が可能
  - `sanitize-html`はNode.js組み込みモジュール依存のため素のCloudflare Workersでは動作しないとされるが、本プロジェクトの`wrangler.toml`は既に`compatibility_flags = ["nodejs_compat"]`を設定済みであり、動作可否は実装時の実機検証が必要

## Research Log

### Directus RBAC migrationの権限付与粒度
- **Context**: 新規collection(`page_home_live`)追加時にRBAC migrationの更新が必要か、フィールド追加のみの既存collection(`page_home`, `festival_meta`)でも必要かを確認したい
- **Sources Consulted**: `directus/migrations/20260701C-rbac-roles.js`(リポジトリ内)
- **Findings**:
  - `executivePerms`/`readPerms` はいずれも `fields: "*"` で全フィールドを許可しており、フィールド単位の権限行は存在しない
  - `ALL_COLLECTIONS`/`PUBLIC_COLLECTIONS` はcollection名のハードコード配列であり、新規collectionはここに無いとexecutive/student_exhibitorとも一切アクセスできない
  - 既に本migrationは適用済み(migrations管理テーブルに記録済み)のため、この配列を直接書き換えても再実行はされない。**新規collection用の権限は別の新規migrationファイルで追加する必要がある**
- **Implications**: `page_home`/`festival_meta`へのフィールド追加はRBAC変更不要。`page_home_live`追加時のみ、`YYYYMMDD{suffix}-rbac-page-home-live.js`のような新規migrationファイルで、executiveの`create/read/update/delete`とstudent_exhibitorの`read`(published相当の条件は不要、singletonでaccess制御はUIのみ)を追加する

### Cloudflare Workersカスタムドメインの Terraform リソース
- **Context**: `dev.aramakisai.com` をCloudflare Workersのカスタムドメインとして接続する際のTerraformリソース種別を確認
- **Sources Consulted**: [cloudflare_workers_custom_domain | Terraform Registry](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/workers_custom_domain), [Support Worker Domains · Issue #1921](https://github.com/cloudflare/terraform-provider-cloudflare/issues/1921), [`cloudflare_workers_custom_domain` requires environment however... · Issue #5618](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5618)
- **Findings**:
  - `cloudflare_workers_custom_domain` リソースが存在し、`account_id`/`zone_id`/`environment`/`hostname`/`service`(/`zone_name`)を引数に取る
  - Issue #5618: Workers Assets(静的アセットを同梱するデプロイ、本プロジェクトの`wrangler.toml`の`[assets]`構成に該当)使用時に、`environment`引数が実際のデプロイと噛み合わずカスタムドメイン接続に失敗する報告がある(未解決の可能性)
- **Implications**: 設計では`cloudflare_workers_custom_domain`の使用を前提とするが、Workers Assets構成との相性は実装フェーズで実機検証が必須(Risk参照)。うまくいかない場合はCloudflareダッシュボード手動設定 + Terraform importへのフォールバックを検討する

### OpenNext(`opennextjs-cloudflare`)の環境別デプロイ
- **Context**: devブランチ専用の永続デプロイ先を、既存の`deploy-prod`/`deploy-preview` jobパターンとどう共存させるか
- **Sources Consulted**: [OpenNext Cloudflare CLI docs](https://opennext.js.org/cloudflare/cli), [env flag not respected on opennextjs-cloudflare deploy · Issue #11741](https://github.com/cloudflare/workers-sdk/issues/11741)
- **Findings**:
  - `opennextjs-cloudflare deploy --env=<name>` は `wrangler.toml` の `[env.<name>]` ブロック(named environment)を参照してデプロイ対象を切り替えられる
  - `--env`フラグの挙動に関する既知issue(#11741)があり、意図通りに反映されないケースが報告されている
- **Implications**: `wrangler.toml`に`[env.dev]`(専用worker名 `aramakisai-web-dev` 等)を追加し、CIから`opennextjs-cloudflare deploy --env=dev`相当で運用する設計とするが、実装時に`--env`の挙動を実機確認するタスクを含める

### WYSIWYG本文のHTMLサニタイズ
- **Context**: `input-rich-text-html`で入力された本文をfrontendで安全にレンダリングする方法
- **Sources Consulted**: [sanitize-html npm](https://www.npmjs.com/package/sanitize-html), [Cloudflare Pages and sanitize-html · remix-run/remix Discussion #8660](https://github.com/remix-run/remix/discussions/8660), [Next.js · Cloudflare Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- **Findings**:
  - `sanitize-html`はNode組み込み(`process`等)に依存するため、素のCloudflare Workers(workerd)環境では動作しないという報告がある
  - 本プロジェクトの`frontend/wrangler.toml`は既に`compatibility_flags = ["nodejs_compat"]`を設定済み(`@opennextjs/cloudflare`の要件)であり、`process`等の一部Node API相当が利用可能な状態
  - `isomorphic-dompurify`はjsdomベースでより重いがブラウザ/サーバー両対応
- **Implications**: 第一候補として`sanitize-html`を採用し、実装時に`nodejs_compat`環境での動作を検証するタスクを設ける。動作しない場合は`isomorphic-dompurify`にフォールバックする(Risk参照)

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 単一collection + phase条件分岐 | `page_home`内に`phase` select + 全フィールドを保持し、frontendで出し分け | Directus collection数が増えない | 切替日にフィールド単位の手動編集が必要になり、要求(切替日の作業をしんどくしない)に反する。ユーザーからの明示的却下済み | Req3改訂前の初期案。不採用 |
| 2 singleton collection + festival_meta切替フラグ(採用) | `page_home`(開催前用、既存流用)と新規`page_home_live`(直前〜当日・開催後兼用)を用意し、`festival_meta`に切替フラグを追加 | 切替日はフラグ変更のみで完結。既存`page_home`のcollection削除を避けられ破壊的変更を最小化 | 新規collection追加に伴うRBAC migration追加が必要(見落としやすい) | ユーザー合意済み。本designで採用 |
| お知らせ/トピックスをpage_home内Repeaterで独自管理 | JSON Repeaterフィールドで管理 | Home Page内で完結 | 既存`announcements`/`topics`と二重管理になり不整合リスク | 不採用。既存collection参照を採用 |

## Design Decisions

### Decision: Home Page用collectionの構成を「既存page_home流用 + 新規page_home_live追加」の2 singletonとする
- **Context**: Req3(2 singleton構成)をどう具体化するか
- **Alternatives Considered**:
  1. 既存`page_home`をそのまま「開催前用」として存続させ、新規collection`page_home_live`を1つ追加
  2. 両方を新規名(`page_home_pre`/`page_home_live`)にリネームし既存`page_home`を削除
- **Selected Approach**: 1を採用。既存`page_home`は「開催前用」として存続、新規`page_home_live`(直前〜当日・開催後兼用)を追加する
- **Rationale**: collection削除という重い破壊的変更を避けられ、additive-schema-checkの検出対象を既存の`blocks`フィールド削除のみに限定できる。additive-onlyルールの精神(破壊的変更の最小化)に合致する
- **Trade-offs**: `page_home`という名前が「開催前用」であることを直接表さないが、Directus管理画面上の`note`(既存パターンで各collectionに説明文を付与)で補える
- **Follow-up**: `page_home`の`meta.note`を「開催前(開催1ヶ月前〜直前)用トップページ」に更新するタスクを含める

### Decision: お知らせ/トピックスは既存`announcements`/`topics`をHome Pageから参照する(新規Repeaterフィールドを作らない)
- **Context**: Req1 AC3(可変ブロック要件)をどう実現するか
- **Alternatives Considered**:
  1. `page_home`/`page_home_live`に新規Repeater(interface: list)フィールドを追加
  2. 既存`announcements`/`topics` collectionをfrontendから直接クエリして表示
- **Selected Approach**: 2を採用
- **Rationale**: 既存collectionは既にWYSIWYG本文・画像・並び替えを備えた確立済みのCRUD体験を提供しており、実行委員の学習コスト・二重管理リスクを避けられる。Req1 AC3の文言(「行の追加・削除・並び替えが可能な構造化フォーム」)は、Directus標準の非singleton collection一覧画面(`topics`の`sort_field`等)で既に満たされている
- **Trade-offs**: Home Page専用の表示件数・強調フラグ等が今後必要になった場合、`announcements`/`topics`側にフィールド追加(RBAC変更不要、fields:"*"のため)で対応する
- **Follow-up**: frontend側のクエリ条件(表示件数、フェーズ別フィルタ)を実装タスクで確定する

### Decision: 開催後の「閉会メッセージ」は専用フィールドを設けず、`page_home_live.hero_message`の書き換えで対応する
- **Context**: Req3 AC2(開催後の差し替えを軽微な編集で対応)
- **Alternatives Considered**:
  1. `closing_message`等の専用フィールドを`page_home_live`に追加し、開催後はそちらを表示に切り替える
  2. 既存の`hero_message`(WYSIWYG)フィールドの内容を、実行委員が「ご来場ありがとうございました」に書き換えるだけで対応する
- **Selected Approach**: 2を採用
- **Rationale**: 新規フィールド・表示切り替えロジックを追加せずに済み、最もシンプル。「軽微な編集で対応できる程度」という要件文言に直接合致する
- **Trade-offs**: 「当日の内容を維持しつつ」閉会メッセージを追加したい場合(完全な差し替えでなく併記したい場合)は、将来的に専用フィールドの追加を検討する余地を残す
- **Follow-up**: なし(運用でカバー)

### Decision: SNSアカウントリンクは`page_home`/`page_home_live`個別ではなく`festival_meta`に一元配置する
- **Context**: Req1 AC5(SNSリンクを複数登録できるフィールド)をどのcollectionに置くか
- **Alternatives Considered**:
  1. `page_home`と`page_home_live`それぞれにSNSリンクのRepeaterフィールドを持たせる
  2. `festival_meta`(祭全体メタ情報、既に切替フラグを追加する場所)に一元的に持たせ、Home Page側は参照のみ行う
- **Selected Approach**: 2を採用
- **Rationale**: SNSアカウント自体は開催前/直前〜当日/開催後を通じて基本的に変わらない祭全体の情報であり、2つのcollectionに同じ内容を重複登録・維持させる必要性が薄い。`festival_meta`は既に祭名・開催日程という同種の「サイト全体で共有される静的メタ情報」を持っており役割が合致する
- **Trade-offs**: SNSリンクをHome Page変種ごとに出し分けたい場合(将来的に開催後だけ非表示にする等)は、`festival_meta`側でなく各collection側に持たせる設計に戻す必要がある。現時点ではそのような要件はない
- **Follow-up**: なし

### Decision: `festival_meta`に切替フラグ`home_active_variant`(select)を追加する
- **Context**: Req3 AC3、およびユーザーとの合意(「festival_metaで」)
- **Alternatives Considered**: `page_home`/`page_home_live`自身に持たせる(循環的で不自然、ユーザーとの対話で却下済み)
- **Selected Approach**: `festival_meta.home_active_variant`(interface: select-dropdown, choices: `pre_event` / `live`)を追加
- **Rationale**: `festival_meta`は既に祭全体のメタ情報(祭名・開催日程)を持つsingletonであり、「今どちらのHome Pageを見せるか」も祭全体の状態の一部として自然に収まる
- **Trade-offs**: なし
- **Follow-up**: なし

### Decision: HTMLサニタイズは`sanitize-html`を第一候補とし、動作検証を実装タスクに含める
- **Context**: Req2 AC2/AC3(WYSIWYG本文の安全なレンダリング)
- **Alternatives Considered**:
  1. `sanitize-html`(軽量、DOM不要)
  2. `isomorphic-dompurify`(jsdomベース、より重いがブラウザ/サーバー両対応実績あり)
  3. サニタイズせずそのまま`dangerouslySetInnerHTML`(編集者は実行委員のみのため脅威モデル上は限定的)
- **Selected Approach**: `sanitize-html`を第一候補として実装し、`nodejs_compat`環境での動作を実装フェーズの最初のタスクとして検証する。動作しない場合は`isomorphic-dompurify`にフォールバックする
- **Rationale**: 編集者はDirectus RBAC(executiveロール、Authentik認証)で認証された少人数の実行委員に限定されるため、脅威モデルとしては外部攻撃者によるXSSではなく「多層防御としての事故防止」が主目的。とはいえCLAUDE.mdのセキュリティ方針・OWASP順守の観点から、素の`dangerouslySetInnerHTML`は避け、軽量なサニタイズを一段挟む
- **Trade-offs**: `sanitize-html`が`nodejs_compat`下で動作しない場合、`isomorphic-dompurify`へのフォールバックが必要になり実装コストが増える
- **Follow-up**: 実装フェーズの最初のタスクとして、実際のCloudflare Workersプレビュー環境で動作確認する

### Decision: スタイリング基盤にTailwind CSSを採用し、presentation層をdata層から分離する
- **Context**: デザインチームはコーディングを行わずFigmaでデザインを渡す(またはこちら側でFigma相当を実装する)運用のため、後日の見た目差し替えが`HomePageService`やDirectusスキーマに波及しない構造が要る。また`frontend`にはスタイリング基盤(Tailwind/CSS Modules等)が一切存在しない
- **Alternatives Considered**:
  1. Tailwind CSS(utility-first、Figmaのデザイントークンを`tailwind.config.ts`にマッピングしやすい)
  2. CSS Modules(Next.js標準搭載、zero-config だがトークン運用の型がない)
  3. スタイリング基盤の選定を本specでは決定せず先送りする
- **Selected Approach**: 1(Tailwind CSS)を採用し、ユーザーとの対話で確認済み。あわせて表示コンポーネント(`HeroSection`等)は`HomePageService`が返す型付きpropsのみに依存し、Figma到着前は最小限のプレースホルダー実装とする方針もユーザーと合意済み(Figma到着待ち、それまでは仮実装で進める)
- **Rationale**: Next.js 15での標準的選択肢であり、Figmaのデザイントークン(色・spacing・フォント)を`theme`拡張として反映しやすく、コンポーネント側の記述量も少ない
- **Trade-offs**: Tailwindの学習コストがCSS Modulesよりやや高いが、デザイントークン運用のしやすさを優先
- **Follow-up**: なし

### Decision: `dev.aramakisai.com`のバックエンドは本番Directus(`api.aramakisai.com`)を参照する
- **Context**: dev環境用に専用のテストDirectusデータを用意すべきか、既存staging/本番を参照すべきか
- **Alternatives Considered**:
  1. staging Directus(`stg-api.aramakisai.com`)を参照(PRプレビューと同じ)
  2. 本番Directusを直接参照。読み取り専用でありHome Page関連collectionは機密情報を含まないためリスクなしと判断
  3. dev専用の別Directusインスタンス/データセットを新設
- **Selected Approach**: 2を採用(ユーザー判断)。dev環境フロントエンドは本番Directusに対し読み取りのみ行い、書き込み経路を持たない
- **Rationale**: dev環境の目的は開催フェーズ切替(`festival_meta.home_active_variant`)の見た目レビューであり、staging DBのデータは本番の実コンテンツと乖離している可能性が高く、切替リハーサルとして不正確になりうる。本番Directusを直接参照すれば実際に切替日に表示される内容をそのまま事前確認できる
- **Trade-offs**: dev環境から本番Directusへの常時読み取りトラフィックが発生する(想定される負荷は低い、CF Access配下で人間のレビューアクセスのみ)
- **Follow-up**: なし

### Decision: Directus Public(匿名)ポリシーへの読み取り権限付与の実装方式
- **Context**: 現状Directus Public(匿名)ロールにはどのcollectionへの読み取り権限も付与されておらず、Home Pageはおろかfrontendのどの画面も未認証では何も取得できない状態だった。ユーザーとの対話で、この付与を本specのRBAC migrationに含めることで合意
- **Sources Consulted**: Directus本体リポジトリ [`api/src/database/migrations/20240806A-permissions-policies.ts`](https://github.com/directus/directus/blob/main/api/src/database/migrations/20240806A-permissions-policies.ts)
- **Findings**:
  - Directus 12(policyベースの権限モデル、v11以降)では、匿名アクセス用の「Public」policyはDirectus本体が固定UUID `abf8a154-5b1c-4a46-ac9c-7300570f4f17` で作成する。全Directusインストールで共通の値
  - `directus_access`テーブルに`role: null, user: null, policy: <PUBLIC_POLICY_ID>`という行が存在することで、この policy が未認証リクエストに適用される
- **Implications**: 新規RBAC migrationは、独自のPublic policyを作成する必要はなく、既存の固定UUID `PUBLIC_POLICY_ID = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'` を定数として参照し、`directus_permissions`に`page_home`/`page_home_live`/`festival_meta`/`announcements`/`topics`向けのread権限行を追加するだけでよい。既存の`EXECUTIVE_POLICY_ID`等と同じ「固定UUID参照」パターンを踏襲できる

### Decision: Figmaデザインの受け取り方式は「共有リンク + Inspectパネル手動転記」とし、自動トークン同期は導入しない
- **Context**: デザインチームはコーディングを行わずFigmaでデザインを渡す想定だが、具体的にどう受け取り実装へ反映するかが未定だった。ユーザーはfrontend領域に詳しくないため、開発側から実務的な方法を提案してほしいという要望があった
- **Alternatives Considered**:
  1. Figmaファイルの閲覧リンク共有 + 開発側がInspectパネル(無料枠で利用可)で値を確認し`tailwind.config.ts`へ手動転記
  2. デザイントークン(色/spacing/font)をMarkdown表やJSONエクスポートで受け取る
  3. Figma API + Tokens Studio等による自動デザイントークン同期パイプラインの構築
- **Selected Approach**: 1を採用
- **Rationale**: デザインチーム・開発側双方が小規模でコーディングを前提としないこと、対象がHome Page1画面のみであることから、自動連携基盤(3)は導入・保守コストが見合わない。Inspectパネルは無料プランでも利用可能で追加ツール導入が不要、閲覧リンク共有のみで完結する
- **Trade-offs**: 転記が手作業のため、デザイン側の細かい修正のたびに人手で追従する必要がある。デザイン変更頻度が増えた場合は(3)を再検討する
- **Follow-up**: なし

## Risks & Mitigations
- `cloudflare_workers_custom_domain`がWorkers Assets構成(本プロジェクトの`[assets]`設定)と噛み合わない既知issueがある — 実装序盤でTerraform applyを小さく試し、失敗する場合はCloudflareダッシュボード手動設定+`terraform import`にフォールバックする
- `opennextjs-cloudflare deploy --env=`フラグが意図通り動かない既知issueがある — devデプロイjobの実装序盤で実機検証し、動かない場合は`wrangler deploy --env=dev`への切り替えを検討する
- `sanitize-html`がCloudflare Workers(`nodejs_compat`)環境で動作しない可能性 — 実装序盤で動作検証し、`isomorphic-dompurify`へのフォールバックを用意する
- 新規collection(`page_home_live`)追加時にRBAC migrationの追加を忘れると、executiveロールでも編集不能になる — design/tasksに明記し、レビュー時のチェック項目に含める

## References
- [cloudflare_workers_custom_domain | Terraform Registry](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/workers_custom_domain) — Workersカスタムドメイン接続用リソースの引数
- [Support Worker Domains · Issue #1921](https://github.com/cloudflare/terraform-provider-cloudflare/issues/1921) — カスタムドメインサポートの経緯
- [`cloudflare_workers_custom_domain` requires environment... · Issue #5618](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5618) — Workers Assets構成との既知の相性issue
- [OpenNext Cloudflare CLI docs](https://opennext.js.org/cloudflare/cli) — `--env`フラグの挙動
- [env flag not respected · Issue #11741](https://github.com/cloudflare/workers-sdk/issues/11741) — `--env`フラグの既知issue
- [sanitize-html npm](https://www.npmjs.com/package/sanitize-html) — サニタイズライブラリ候補
- [Cloudflare Pages and sanitize-html · Discussion #8660](https://github.com/remix-run/remix/discussions/8660) — Workers環境でのNode依存に関する実例報告
- [Directus `20240806A-permissions-policies.ts`](https://github.com/directus/directus/blob/main/api/src/database/migrations/20240806A-permissions-policies.ts) — Public policyの固定UUIDと`directus_access`のrole/user null表現
