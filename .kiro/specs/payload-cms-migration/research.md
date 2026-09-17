# Research & Design Decisions: payload-cms-migration

## Summary

- **Feature**: `payload-cms-migration`
- **Discovery Scope**: Complex Integration (full discovery)
- **Key Findings**:
  - Cloudflare は 2025-09 に Payload の Workers 稼働を公式サポートしたが、
    **Workers Paid プランが必須**である (無料枠のバンドル上限 3 MiB に対し Payload が収まらない)。
    「追加の有償プランを契約しない」という制約により Workers 構成は採用できず、稼働先は K8s に確定した。
  - ただし `sharp` は Workers のマルチスレッド非対応により動作しない。Payload では `sharp` は optional 依存であり、
    外して `imageSizes` を諦める構成が正規の回避策。代わりに **Cloudflare Image Transformations** を使う。
    この機能は本プロジェクトの zone で既に有効化済みで、`aramakisai-infra` の
    `terraform/cloudflare_directus_assets.tf` に「用途別サイズの出し分けはエッジ変換で行う」と方針が明記されている。
    Requirement 6.5 (任意幅) の答えは既にインフラ側に存在する。
  - Payload 3.88.0 がサポートする Next.js は 15.2.9〜15.2.x / 15.3.9〜15.3.x / 15.4.11〜15.4.x / 16.2.6+。
    本リポジトリの実インストールは **15.5.19** でこの範囲外。既存 `frontend/` に Payload を同梱するには
    Next のバージョン変更が必須になるため、Payload は独立した Next アプリとして切り出すのが自然。
  - prod-node-1 のメモリ実測 81% (空き 1.2Gi) により、Directus と Payload の並行稼働は成立しない。
    Requirement 9.6 の段階移行は却下し、一括カットオーバーを採る。
  - K8s へ確定したことで `sharp` が使えるようになり、画像はアップロード時に最適化する方式を採る。
    配信時変換 (Image Transformations、月 5,000 変換まで無料) は転送量と読み込み時間の観点から採らない。
  - SQLite バックエンドの Durable Objects は無料プランで利用できるため、
    将来のリアルタイム要求 (`aramakisai-web#53` / `#54`) への余地は無償のまま確保される。

## Research Log

### Payload の Cloudflare Workers 稼働可否

- **Context**: Requirement 1.2 が Workers 上での動作検証を要求。gap-analysis は Node / `sharp` / DB への TCP 依存から
  成立見込みが低いと評価していた。
- **Sources Consulted**:
  - Cloudflare Blog "Payload on Workers: a full-fledged CMS, running entirely on Cloudflare's stack" (2025-09)
  - Payload Blog "Deploy Payload CMS on Cloudflare in a single click"
  - `payloadcms/payload` の `templates/with-cloudflare-d1`
- **Findings**:
  - Cloudflare 公式テンプレートが存在し、D1 + R2 バインディングで 1 クリックデプロイできる。
  - Postgres 構成も公式に検証済み。Workers ではリクエスト間で接続を共有できないため
    プール設定を `maxUses: 1` にして無効化する必要があり、その代償のレイテンシを Hyperdrive が吸収する。
  - Hyperdrive の接続文字列は OpenNext の Cloudflare context (`cloudflare.env.HYPERDRIVE.connectionString`) から取得する。
    本リポジトリは既に `@opennextjs/cloudflare` を使っており、デプロイ経路が一致する。
  - バンドルサイズ上限のため **Workers Paid プランが必須** (無料枠 1MB / 有料 10MB)。
  - GraphQL サポートは Workers 環境では完全ではない。REST を前提に設計する。
- **Implications**: 調査時点では Option C (Workers) を第一候補に格上げした。
  **その後「追加の有償プランを契約しない」制約が確定し、Workers Paid が必須である本構成は採れなくなった。**
  最終的な選定は Design Decisions の「ホスティングは K8s 上の独立 Payload アプリとする」を参照。
  以下の Hyperdrive 関連の調査結果も、K8s 構成では不要になっている。

### Hyperdrive から非公開 Postgres への到達手段

- **Context**: prod の CNPG (`directus-db-1`) は外部公開されていない。Workers からどう到達するか。
- **Sources Consulted**: Cloudflare Hyperdrive docs "Connect to a private database using Tunnel" /
  "Connect to a private database using Workers VPC"
- **Findings**:
  - 経路は Worker → Hyperdrive → Cloudflare Access → Cloudflare Tunnel → 非公開 DB。公式にサポートされた構成。
  - `cloudflared` を DB に到達できるプライベートネットワーク内で稼働させ、Access で
    特定の Hyperdrive 設定のみに接続を制限する。
  - 本プロジェクトは既に `cloudflared` を運用しており、トンネル自体は新規要素ではない。
- **Implications**: DB を公開せずに Workers から接続できる。Requirement 8.5 (Infisical) との整合は
  Hyperdrive 側に接続文字列を保持させることで保たれる。

### 画像変換とメディア配信

- **Context**: Requirement 6.3 (WebP 変換・リサイズ) と 6.5 (任意幅) を Payload でどう満たすか。
- **Sources Consulted**: Payload Uploads docs、`payloadcms/payload` Discussion #3395 / #13499、
  Cloudflare Images docs "Transform via fetch"、`aramakisai-infra/terraform/cloudflare_directus_assets.tf`
- **Findings**:
  - Payload の `imageSizes` はアップロード時の事前生成方式。`?width=N` のような配信時の任意幅変換は標準にない
    (ロードマップ上の項目)。
  - 変換は `sharp` が担うが、Workers はマルチスレッド非対応のため `sharp` を動かせない。
    Payload 3.x では `sharp` は optional 依存で、渡さなければ変換機能ごと無効化される。
  - Cloudflare Image Transformations は URL ベースで任意幅・フォーマット自動変換を提供する。
    本 zone では **既に手動で有効化済み**。`cloudflare_directus_assets.tf` に
    「用途別サイズ (サムネイル/カード/詳細) の出し分けは Cloudflare Image Transformations + Cache Rule の
    エッジ変換で行い、Directus 側の配信時変換は使わない」と方針が記録されている。
  - 同ファイルの Cache Rule は `api.aramakisai.com` / `stg-api.aramakisai.com` の `/assets/` パスを対象としており、
    Payload へ移行するとホストとパスが変わるため書き換えが必要。
- **Implications**: 画像最適化を CMS の責務から外し、配信層 (Cloudflare) に寄せる。
  Requirement 6.3 / 6.4 の「アップロード時に最適化し、失敗しても原本を保持する」という記述は、
  「配信時に変換し、変換不能なら原本を返す」という形で満たされる。要件文面の再解釈を design で明示する。
  保留中の Directus image-optimize 拡張は、この方針では不要になる。

### Payload の access control モデル

- **Context**: 移行の決定打である Requirement 2 (行レベル access control) が本当に無償で成立するか。
- **Sources Consulted**: Payload docs "Collection Access Control" / "Access Control overview" / "Field-level Access Control"
- **Findings**:
  - access control 関数はサーバー側で実行され、`boolean` または `Where` 制約を返す。
    `Where` を返すとユーザーのクエリにマージされ、行レベルのフィルタになる。
  - `{ author: { equals: user.id } }` のような所有者フィルタが標準的な書き方。
  - フィールド単位の access control も標準機能。ライセンスによるゲートは存在しない。
  - 注意点: Access Operation 経由で評価される場合、`Where` は実行されず「権限なし」として扱われる。
    管理画面の UI 表示可否の判定に影響する。
- **Implications**: Requirement 2.5 (有償ライセンス不要) は満たされる。移行動機 1 が解消する。

### 認証と外部 IdP 連携

- **Context**: Requirement 3.2 / 3.3。Authentik との OIDC 連携を無償で行えるか。
- **Sources Consulted**: Payload docs "Custom Strategies"、`gousta/payload-plugin-oidc`、
  Payload Discussion #1555 (Okta OIDC)、Payload Enterprise SSO ページ
- **Findings**:
  - Payload の標準認証はローカル (users コレクション) で、OSS 版に含まれる。
  - 外部 IdP 連携は Custom Strategy として自前実装するか、コミュニティの `payload-plugin-oidc` を使う。
    どちらも OSS で、Enterprise SSO プランは「SAML/OAuth を公式サポート付きで使う」ための商用オプション。
  - Directus と異なり、無償版で OIDC 連携が機能不全になるゲートは存在しない。
- **Implications**: Requirement 3.3 は満たせるが、実装は自前 (プラグインの保守状況に依存)。
  ここが本移行で唯一「Directus より作り込みが必要になる」領域。

### Payload のバージョン制約

- **Context**: 既存 `frontend/` に Payload を同梱できるか。
- **Sources Consulted**: npm `payload` (3.88.0)、Payload Installation docs、`frontend/pnpm-lock.yaml`
- **Findings**:
  - Payload 3.88.0 の Next 対応レンジは 15.2.9〜15.2.x / 15.3.9〜15.3.x / 15.4.11〜15.4.x / 16.2.6+。
  - Node.js は 20.9.0 以上が必要。
  - 本リポジトリの実インストールは Next **15.5.19**。上記レンジのいずれにも含まれない。
- **Implications**: 同梱するなら Next を 15.4.x へ下げるか 16.2.6+ へ上げる必要がある。
  公開サイトのフレームワークバージョンを CMS の都合で動かすのは筋が悪いため、
  Payload を独立した Next アプリとして切り出し、バージョンを別管理する。

### Workers の制限値とリアルタイム機能の実現手段

- **Context**: `aramakisai-web#53` (駐車場空き情報) が「Cloudflare Workers はリアルタイム更新に
  対応してないかも」という懸念を挙げている。`#54` (デジタルサイネージ) も
  「コレクションの更新と同時に画面を更新する」を要求している。移行先の選定がこれらを塞がないかの確認。
- **Sources Consulted**: Cloudflare Workers Platform Limits、Durable Objects "Use WebSockets" docs、
  Workers changelog "Workers are no longer limited to 1000 subrequests" (2026-02-11)
- **Findings**:
  - 有料プランの制限値は Startup CPU time 1 秒、CPU time 既定 30 秒 (最大 5 分)、
    バンドル 10 MB、サブリクエスト既定 10,000 (最大 1,000 万)、isolate メモリ 128 MB。
    待ち時間は CPU time に計上されない。
  - サブリクエスト上限は 2026-02 に 1,000 から 10,000 へ緩和されており、深い `depth` 指定でも到達しない。
  - リアルタイムは Durable Objects + WebSocket が標準解。
    SQLite バックエンドのものは**無料プランで利用でき、ストレージ課金も発生しない**。
    Hibernation API により接続を維持したまま休止でき、待機中の課金が発生しない。
  - `ctx.getWebSockets()` で接続中のクライアントへ一斉配信できる。
  - OpenNext が内部で使う Durable Object バインディングはローカル開発で動作しない。
    自前の Durable Object は別 Worker として定義すればローカルでも動く。
- **Implications**: Workers の選定はリアルタイム要求を塞がない。むしろ Durable Objects という
  専用機能を持つ点で K8s 構成より有利。Go / No-Go を決めるのは Startup CPU time とバンドルサイズの 2 つに絞られる。

### ローカルでの本番再現手段

- **Context**: Requirement 1.2 の実機検証と Authentik 連携の試行をローカルで行いたい。
- **Sources Consulted**: Hyperdrive "Local development" docs、`cloudflare/workers-sdk` Issue #8157、
  Workers changelog "Connect to remote databases during local development with wrangler dev" (2025-12-04)
- **Findings**:
  - `wrangler dev` は workerd をそのまま動かすため、ネイティブモジュール不可などの制約が本番と同じ形で再現される。
  - Hyperdrive はバインディング名に対応する環境変数、または設定上のローカル接続文字列でローカル DB へ向けられる。
    ただし `wrangler dev` ではクエリキャッシュが効かず、キャッシュ挙動の確認には `wrangler dev --remote` が要る。
  - この環境変数を `.dev.vars` ではなく `.env` から読むという既知の不具合報告がある (Issue #8157)。
    本リポジトリの `.env` 禁止方針と衝突するため、シェルの環境変数として渡す必要がある。
  - Cloudflare Image Transformations と Cloudflare Access はローカルで動作しない。
- **Implications**: ローカル検証は可能だが、画像変換とアクセス制御は再現できない。
  Authentik 連携は既存 IdP にローカル用リダイレクト URI を追加する方式が最も軽い。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **A. K8s 上の独立 Payload アプリ** | `prod` namespace に Deployment を追加、FE は Workers 据え置き | 既存 ArgoCD / Infisical 経路をそのまま使える。`sharp` が使える | ノードのメモリ空きが 1.2Gi しかなく並行稼働の余地が乏しい。常駐プロセスが 1 つ増える | **採用** |
| B. FE ごと Payload に統合し K8s 運用 | `frontend/` を Payload アプリへ取り込む | Local API が使え構成が単純 | requirements の Out of scope と衝突。Workers / CDN 資産を捨てる。公開サイトが単一ノード依存になる | 却下 |
| C. Workers 上の独立 Payload アプリ | Payload を別 Worker としてデプロイ、DB は Hyperdrive 経由で既存 CNPG | K8s に常駐を追加しない。FE と同じ `@opennextjs/cloudflare` 経路 | **Workers Paid が必須**。`sharp` 不可。GraphQL 不完全。Hyperdrive + Tunnel の新規配管 | 却下 (無償プラン制約) |
| D. Payload Cloud / 外部 PaaS | マネージド環境に委ねる | 運用負荷ゼロ | 費用。Infisical / ArgoCD 運用からの逸脱。DB が外部に出る | 却下 |

## Design Decisions

### Decision: ホスティングは K8s 上の独立 Payload アプリとする

- **Context**: Requirement 1.2 / 1.6 / 1.7。prod-node-1 のメモリ実測 81%、空き 1.2Gi。
- **Alternatives Considered**:
  1. Option A — K8s 上の独立 Deployment
  2. Option B — FE への統合
  3. Option C — Workers 上の独立アプリ
- **Selected Approach**: Option A。Payload を `cms/` として独立した Next アプリに切り出し、
  K8s 上の Deployment として Directus を置き換える。
- **Rationale**: Option C は Workers Paid プランを必須とし、無償プラン制約と両立しない。
  Option A は既存の ArgoCD / Infisical / CNPG 経路をそのまま使え、`sharp` も使える。
- **Trade-offs**: ノードのメモリ空き (1.2Gi) を引き受けるため並行稼働を諦め、一括カットオーバーを採る。
- **Follow-up**: Payload の実メモリ消費を実測し、Directus 撤去後の空きに収まるか確認する。

### Decision: データベースは既存 CNPG 上に新規スキーマとして作る

- **Context**: Requirement 1.3 / 5。prod のコンテンツ実体は 5 行 + 9 ファイル。
- **Alternatives Considered**:
  1. Cloudflare D1 (Workers ネイティブ)
  2. 既存 Directus テーブルを Payload に引き継ぐ
  3. 既存 CNPG 上に Payload 用の新規データベースを作る
- **Selected Approach**: 3。CNPG に `payload` データベースを新設し、Payload のマイグレーションで
  スキーマを構築する。Directus のテーブルには触れない。
- **Rationale**: D1 アダプタは Cloudflare の自作で Postgres より実績が浅く、既存のバックアップ運用も
  CNPG 前提で組まれている。既存テーブルの引き継ぎは Payload の drizzle 命名規約に合わせる改造が必要で、
  移行対象 5 行に対して割に合わない。Directus のテーブルを残すことは Requirement 9.5
  (ロールバック期間中は削除しない) をそのまま満たす。
- **Trade-offs**: 既存データは自動移送せず手入力で再投入する。Requirement 5 の受入基準を実測規模に合わせて縮小する。
- **Follow-up**: CMS は Directus と同じ namespace 内から Postgres へ直接接続する。
  クラスタ外への接続経路を新設しない。

### Decision: 画像はアップロード時に最適化し、配信時の変換を行わない

- **Context**: Requirement 6.3 / 6.4 / 6.5。稼働先が K8s に確定したことで `sharp` が使えるようになった。
- **Alternatives Considered**:
  1. Payload の `imageSizes` で事前生成し、FE は用意されたサイズを選ぶ
  2. Cloudflare Image Transformations で配信時に変換する
- **Selected Approach**: 1。`sharp` を Payload に渡し、アップロード時に WebP 変換と
  用途別サイズの生成を行う。FE は表示幅を満たす最小の生成済みサイズを選ぶ。
- **Rationale**: 配信時変換はキャッシュに乗るまで毎回変換のラウンドトリップが発生し、
  キャッシュミス時の転送量と読み込み時間が増える。本サイトの画像は 9 件で用途別サイズも限られるため、
  アップロード時に生成しておくほうが配信経路が単純で速い。
  Requirement 6.3 / 6.4 の文面をそのまま満たせる点でも整合する。
- **Trade-offs**: 派生サイズの分だけストレージが増える。`imageSizes` に定義しない幅を FE が要求すると
  意図より大きい画像が配信される。変換は CMS の CPU を使うが、アップロードは低頻度で定常負荷にならない。
- **Follow-up**: FE が現在要求している幅を洗い出し、`imageSizes` の一覧を決める。
  メディア配信の Cache Rule をホストとパスの変更に合わせて書き換える。

### Decision: 認証は Authentik OIDC を一次経路とし、第一段階から実装する

- **Context**: Requirement 3.2 / 3.3。`aramakisai-infra` の Terraform に、
  出展者ユーザーの自動払い出し (`authentik_student_exhibitor_provisioning.tf`)、
  パスワード設定フロー (`authentik_student_exhibitor_flow.tf`、2026-08-26 実機検証済み)、
  リカバリ用サービスアカウントが既に実装されている。
- **Alternatives Considered**:
  1. ローカル認証を先に成立させ、OIDC を後続で追加する段階構成
  2. Authentik OIDC を第一段階から実装する
  3. 出展者のみ OIDC、実行委員はローカル認証
- **Selected Approach**: 2。Custom Strategy または OIDC プラグインで Authentik と連携し、
  ローカル認証は実行委員の緊急用としてのみ残す。
- **Rationale**: 出展者アカウントの払い出しとパスワード設定は Authentik 側で完成しており、
  ローカル認証を選ぶとこの資産が移行直後に無用になる。加えてローカル認証は初回パスワード設定と
  リセットにメール送信 (SMTP) の実装を要し、Authentik が既に担っている責務を CMS に再実装することになる。
- **Trade-offs**: Custom Strategy の実装が移行のクリティカルパスに乗る。
- **Follow-up**: Authentik 側に Payload 用のプロバイダ定義と CMS 用グループを追加する
  (`aramakisai-infra` の変更)。OIDC プラグインの保守状況を実装直前に確認する。

### Decision: 段階移行 (Directus と Payload の並行稼働) を採らず、一括カットオーバーとする

- **Context**: Requirement 9.6。
- **Alternatives Considered**:
  1. コレクション単位で参照先を切り替える段階移行
  2. 一括カットオーバー
- **Selected Approach**: 2。Directus を停止してから Payload を起動し、フロントエンドを切り替える。
- **Rationale**: `prod-node-1` のメモリ実測は 81% で空きは約 1.2 Gi。
  Payload の常駐は 512Mi〜1Gi 規模と見込まれ、Directus (実測 208Mi) と同時には立てられない。
  移行対象が 5 行 + 9 ファイルと極小で、事前にコンテンツを再投入しておけば
  カットオーバー時の停止時間はフロントエンドのデプロイ時間のみに収まる。
- **Trade-offs**: カットオーバー中は編集を受け付けられない期間が生じる。
  Requirement 9.6 は段階移行を採る場合の条件節であり、採らないことで充足する。
- **Follow-up**: 実施タイミングを実行委員と調整する。

### Decision: 無償プランの範囲で成立する構成に限定する

- **Context**: 移行のために新たな月額課金を発生させないという制約が後から確定した。
- **Alternatives Considered**:
  1. Cloudflare Workers Paid を契約して Workers 構成を採る
  2. 無料枠に収まる構成のみを採る
- **Selected Approach**: 2。稼働先を K8s に確定し、Hyperdrive と Cloudflare Tunnel を経由する
  DB 接続の配管も不要になった。Payload は Directus と同じ namespace 内から CNPG へ直接接続する。
- **Rationale**: Payload の公式ドキュメントが Workers Paid 必須と明記しており、
  無料枠の 3 MiB に収まるかは実測しなければ分からない。外れた場合は稼働先ごと作り直しになる。
  確実に成立する構成を採るほうが期限内完了の確度が高い。
- **Trade-offs**: K8s のメモリ制約 (空き 1.2Gi) を引き受けることになり、並行稼働を諦める。
  Cloudflare の Image Transformations と Durable Objects は無料枠で使えるため、
  画像配信とリアルタイム要求への余地は失われない。
- **Follow-up**: Payload の実メモリ消費を P0 で見積もり、Directus 撤去後の空き (約 1.4 Gi) に収まるか確認する。

### Decision: メディアは CMS 経由で配信し、新ホストを立てて旧 URL は Redirect Rule で誘導する

- **Context**: Requirement 6.2。旧 URL のホストと S3 バケットの実態を確認した。
- **Findings (実測)**:
  - 旧 URL は `api.aramakisai.com/assets/<uuid>?format=webp&width=N` で、
    Directus が S3 から取り出してリクエストごとに変換して返している (200 / `image/webp`)。
    Cloudflare の Cache Rule が 30 日キャッシュしている。
  - S3 の直 URL は 403。バケット `aramakisai-backups` は CNPG の WAL アーカイブと
    restic バックアップを兼ねており、公開できない。
  - 旧 URL を組み立てているのはフロントエンドのアセット URL ビルダーのみで、
    データベースに保存された値ではない。
- **Alternatives Considered**:
  1. `api.aramakisai.com` を Payload に付け替える
  2. CMS 用の新ホストを立て、旧 `/assets/` は Cloudflare の Redirect Rule で 301
  3. S3 を公開して直配信する
- **Selected Approach**: 2。
- **Rationale**: 3 はバックアップ兼用バケットの公開を伴うため採れない。
  1 はカットオーバー時に DNS と Tunnel の切り替えを要し、ロールバックが重くなる。
  2 は切り戻しが Redirect Rule の無効化だけで済み、ホスト名が実態に合う。
  ファイル識別子が Directus の uuid から Payload の識別子へ変わるため、
  どの案でも対応表は必要であり、旧 URL 互換は選定の決め手にならない。
- **Trade-offs**: `aramakisai-infra` の Terraform に DNS / Cache Rule / Redirect Rule の 3 点を新設する。
- **Follow-up**: 対象は 9 件のため静的な対応表で足りる。

## Risks & Mitigations

- **Payload の常駐メモリがノードの空きに収まらない** — P0 で実測する。
  収まらない場合は他ワークロードの整理かノードの増強が先行タスクになる。
- **一括カットオーバー中に編集を受け付けられない期間が生じる** — 実施タイミングを実行委員と調整する。
  コンテンツは事前に再投入するため、停止時間は数分に収まる見込み。
- **カットオーバー後に Payload 上で編集が発生するとロールバックで失われる** —
  ロールバック可能期間を「Payload 上での編集を止める観察期間」として定義する。
- **Payload のイメージを自前ビルドするため脆弱性の追随責任が移る** —
  falco のイメージ許可リスト更新とあわせて、更新の運用を決める。
- **`imageSizes` に定義しない幅を FE が要求する** — 意図より大きい画像が配信される。
  FE が現在使っている幅を洗い出してからサイズ一覧を決める。
- **Authentik 連携の自前実装コスト** — 段階構成にして期限内完了を優先する。ローカル認証で先に稼働させる。
- **Directus SSO のライセンス猶予が移行前に切れる** — 実測では 2026-08-27 時点で稼働中だが失効時期が読めない。
  切れた場合は Directus 側をローカル認証へ退避させる (本 spec の外)。
- **Cloudflare Image Transformations の従量課金** — 画像 9 件・変換パターンが少ないため影響は小さい見込みだが、
  カットオーバー後に実績を確認する。

## References

- [Payload on Workers (Cloudflare Blog)](https://blog.cloudflare.com/payload-cms-workers/) — Postgres + Hyperdrive / D1 / R2 の実装詳細
- [Deploy Payload CMS on Cloudflare in a single click](https://payloadcms.com/posts/blog/deploy-payload-onto-cloudflare-in-a-single-click) — Workers Paid 必須の記述
- [Connect to a private database using Tunnel (Hyperdrive docs)](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database) — 非公開 DB への到達経路
- [Collection Access Control (Payload docs)](https://payloadcms.com/docs/access-control/collections) — `Where` を返す行レベル制御
- [Custom Strategies (Payload docs)](https://payloadcms.com/docs/authentication/custom-strategies) — 外部 IdP 連携の実装方式
- [Uploads (Payload docs)](https://payloadcms.com/docs/upload/overview) — `imageSizes` と `sharp` の関係
- [Transform via fetch (Cloudflare Images docs)](https://developers.cloudflare.com/images/transform-images/transform-via-workers/) — エッジ画像変換
- [payload npm](https://www.npmjs.com/package/payload) — 3.88.0 / Next 対応レンジ / Node 20.9.0+
- `aramakisai-infra/terraform/cloudflare_directus_assets.tf` — Image Transformations 有効化済みと Cache Rule の既存定義
