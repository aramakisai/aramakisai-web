# Research & Design Decisions

## Summary
- **Feature**: `stamp-rally-server-record`
- **Discovery Scope**: Extension (既存スタンプラリーの拡張。D1・Zitadel OIDC ログイン・Analytics Engine の新規導入を含むため外部仕様は full 相当で確認)
- **Key Findings**:
  - PR プレビュー (`wrangler versions upload`) は本番 Worker のバージョンで、トップレベルのバインディングをそのまま使う。D1 を足すとプレビューが本番 DB に書き込む。バインディングはバージョンごとに保持されるため、プレビュー用の一時設定で D1 の `database_id` を dev 用に差し替えれば分離できる
  - 管理者画面の認証は Cloudflare Access を使わず、公式サイトの Worker が Zitadel の OIDC (認可コードフロー) でログインさせる。実行委員の判定は CMS と同じく userinfo の `groups` に `executive` があるかで行う。PR プレビューでは認証を掛けない
  - `workersInvocationsAdaptive` はパス別の値を持たない。エンドポイント別のリクエスト数・バイト数・応答時間は Workers Analytics Engine に自前で書く。CPU 時間のパス別は Workers Logs (Query Builder、10% サンプル、保持 7 日) でしか取れない

## Research Log

### 既存のスタンプ取得フローと端末内保存
- **Context**: サーバー記録をどこに差し込むか
- **Sources Consulted**: `frontend/src/components/stamp-collector.tsx`, `frontend/src/app/api/stamps/verify/route.ts`, `frontend/src/lib/mypage-storage.ts`, `frontend/src/lib/stamp-progress.ts`, `frontend/src/components/mypage-view.tsx`, `frontend/src/app/(site)/mypage/page.tsx`
- **Findings**:
  - `StampCollector` がフラグメント `#s=` を読んで即座に消し、`POST /api/stamps/verify` に `{id, category, signature}` を送る。応答は `{valid}`。成功時に `addStamp` で端末内に保存し、`added`/`exists` のトーストを出す。失敗時は何も出さない
  - `parseMypageData` は `lists` 以外のトップレベルのキーを捨てて書き戻す。匿名IDを保持するには保存形式の型を拡張する必要がある
  - エリアごとの取得率は `stamp-progress.ts` が算出する。分母は「公開中・stage 以外・areaId がある企画×カテゴリの組」で、値は `Math.floor`。areaId が無い取得済みは「その他」
  - トーストは `kind` と `message` の差し替えで失敗文言を出す前例がある (`map-user-location.tsx`)
- **Implications**: 検証 API に記録を足し、応答を `result` に変える。マイページは端末内の `stamps` を読まず、取得 API の結果を `stamp-progress.ts` に渡す

### Cloudflare D1
- **Sources Consulted**: https://developers.cloudflare.com/d1/platform/pricing/ , https://developers.cloudflare.com/d1/platform/limits/ , https://developers.cloudflare.com/d1/worker-api/return-object/ , https://developers.cloudflare.com/d1/observability/metrics-analytics/ , https://developers.cloudflare.com/d1/wrangler-commands/ , https://developers.cloudflare.com/workers/configuration/versions-and-deployments/
- **Findings**:
  - 料金: Free は書き込み 10 万行/日・読み取り 500 万行/日・5GB。Paid は書き込み 5,000 万行/月込み (超過 $1.00/百万)、読み取り 250 億行/月込み
  - インデックス列を含む書き込みは、インデックス 1 つにつき書き込み 1 行分加算される
  - `INSERT ... ON CONFLICT DO NOTHING` で衝突した行が `rows_written` に数えられるかは公式に記述が無い。本番の実測値で確かめる (実験の計測対象そのもの)
  - クエリ結果の `meta` は `rows_read`, `rows_written`, `changes`, `duration`, `size_after` 等を持つ
  - GraphQL の `d1AnalyticsAdaptiveGroups` (readQueries, writeQueries, rowsRead, rowsWritten, queryBatchResponseBytes)、`d1StorageAdaptiveGroups` (databaseSizeBytes) を `date` で日単位に集計できる。保持 31 日。トークン権限は Account Analytics Read
  - `[[d1_databases]]` は `[env.x]` に継承されない
  - `wrangler d1 migrations apply --remote` は非対話環境で確認を省く。適用履歴は `d1_migrations` テーブル
  - バージョンは bindings を含む状態を保持する。`versions upload` で D1 の参照先が違うバージョンを作れる
- **Implications**: 本番・dev の 2 DB。プレビューは一時設定で dev DB を指す。計測の D1 値は GraphQL から開催後 31 日以内に取り出す

### 管理者画面の認証 (Zitadel OIDC)
- **Context**: Cloudflare Access は使わない方針。実行委員だけに管理者画面を提供する
- **Sources Consulted**: `aramakisai-infra/terraform/access.tf` (Zitadel のエンドポイント), `aramakisai-infra/ansible/roles/zitadel-bootstrap/{vars/resources.yml,tasks/_oidc_app.yml,files/groups_claim.js}`, `cms/src/auth/{authentik-endpoints.ts,identity.ts,role-mapping.ts}`
- **Findings**:
  - Zitadel の discovery (`https://idp.aramakisai.com/.well-known/openid-configuration`、2026-10-28 取得): issuer `https://idp.aramakisai.com`、authorize `/oauth/v2/authorize`、token `/oauth/v2/token`、userinfo `/oidc/v1/userinfo`、PKCE は `S256`、token の認証方式は `client_secret_basic` 等。CMS は discovery から userinfo を引いている
  - OIDC アプリは ansible の `zitadel_oidc_apps` で宣言する。作成されるのは `OIDC_APP_TYPE_WEB` + `OIDC_AUTH_METHOD_TYPE_BASIC` (client secret 付き) のみ。リダイレクト URI は完全一致
  - Zitadel は Complement Token の action で project role のキーを `groups` クレームに入れる。role キーは `executive` (実行委員)、`student_exhibitor` (出展団体) 等
  - CMS は scope `openid email groups` で認可し、userinfo の `groups` を `resolveRole` に渡す
  - 既存の infra では PR プレビューのホスト (`*-aramakisai-web.aramakisai.workers.dev`) と `dev.aramakisai.com` がホスト全体で Access 保護されている (本機能とは無関係の既存設定)
- **Implications**: 公式サイト用の Zitadel アプリを追加し、client secret を Infisical から `--secrets-file` で Worker に渡す。トークン応答を Worker が直接受け取り userinfo で `groups` を取るため、ID トークンの署名検証ライブラリは足さない。PR プレビューはホスト名がバージョンごとに変わりリダイレクト URI を登録できないため、指示どおり認証を掛けない

### 計測手段
- **Sources Consulted**: https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/ , https://developers.cloudflare.com/workers/observability/query-builder/ , https://developers.cloudflare.com/workers/observability/logs/workers-logs/ , https://developers.cloudflare.com/observability/pricing/ , https://developers.cloudflare.com/analytics/analytics-engine/pricing/ , https://developers.cloudflare.com/analytics/analytics-engine/limits/ , https://developers.cloudflare.com/workers/reference/security-model/
- **Findings**:
  - `workersInvocationsAdaptive` の dimensions は datetime, scriptName, status で、パス別は無い
  - Workers Logs の Query Builder は `$workers.event.request.path` で Group By し `$workers.cpuTimeMs` を集計できる。保持 7 日。現行 `head_sampling_rate = 0.1`。Version URL (プレビュー) のログは見られない
  - Workers Analytics Engine: 1 点に blob 20・double 20・index 1。Free は書き込み 10 万点/日。保持 3 か月。公式は現在課金していないと記載
  - `Date.now()` は最後の I/O 時点で止まる。D1 の await を挟んだ経過時間は測れるが、CPU だけの区間は 0 になる
- **Implications**: エンドポイント別の値は Analytics Engine に 1 リクエスト 1 点で書く。CPU 時間は Workers Logs (サンプル) から開催後 7 日以内に取り出す。応答時間の比較 (8.3) は同じリクエストの「全体の経過時間」と「D1 の経過時間」を分けて記録し、差を記録前の相当値とする

### QR の読み取り
- **Sources Consulted**: https://caniuse.com/mdn-api_barcodedetector , https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia , npm registry / GitHub (jsqr, @zxing/browser, qr-scanner, barcode-detector, html5-qrcode)
- **Findings**:
  - BarcodeDetector は Chrome Android で対応、iOS Safari は既定で無効
  - `barcode-detector` (Sec-ant) 3.2.3 (2026-10-19 公開) は BarcodeDetector の ponyfill。ネイティブが無い環境で zxing-wasm を使う。wasm の取得先は `prepareZXingModule` で自前ホストにできる
  - qr-scanner は 2022 年、jsqr は 2021 年でリリースが止まっている
  - 各ライブラリの iOS Safari での動作実績は公式に記載が無い
  - getUserMedia は secure context 必須。iOS では `<video playsinline>` が要るとの報告 (二次情報)
- **Implications**: `barcode-detector` の ponyfill を使い、wasm は `public/` から配信する。iOS Safari での動作は実機で確かめる必要がある

### レート制限
- **Sources Consulted**: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- **Findings**: `[[ratelimits]]` バインディング (`simple` のみ、period は 10 か 60 秒)。拠点ごとの概算で結果整合。Free プランでの可否と料金はページに記載が無い
- **Implications**: 匿名で呼べる API (検証・取得・交換用QRの署名発行) に IP 単位の制限を掛ける。1 つの企画QRの検証値を持てば匿名IDを変えて無制限に書き込めるため

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存 Worker 内の Route Handler + D1 | Next.js の Route Handler / Server Component から D1 を直接使う | 新しいデプロイ単位が無い。既存の検証 API に記録を足すだけ | サイトの Worker の CPU 上限・障害を共有する | 採用 |
| 専用 Worker | スタンプ API だけ別 Worker | 障害分離 | デプロイ・認証・CI が 2 系統になる | 実験の規模に見合わない |

## Design Decisions

### Decision: PR プレビューの D1 分離
- **Context**: プレビューは本番 Worker のバージョン
- **Alternatives Considered**:
  1. プレビュー用の一時設定で D1 を dev DB に差し替える
  2. `wrangler preview` (Previews) の `previews.d1_databases` に移る
- **Selected Approach**: 1。`deploy-preview` が `wrangler.toml` から一時設定を作り、`STAMP_DB` の `database_id` だけを差し替えて `versions upload` に渡す。`STAMP_ENV` は `--secrets-file` の JSON で `preview` を渡す
- **Rationale**: 既存の `deploy-with-cpu-limit-fallback.ts` も一時設定で動いている。Previews は未宣言のバインディングの扱いが未確定
- **Trade-offs**: プレビューと dev が同じ DB を共有する
- **Follow-up**: 一時設定の差し替え漏れで本番 DB を指さないことを CI のテスト (`frontend-ci.workflow.test.ts`) で固定する

### Decision: 管理者画面を Worker の OIDC ログインで保護する
- **Context**: Cloudflare Access を使わない (ユーザー指示)
- **Alternatives Considered**:
  1. 公式サイトの Worker が Zitadel OIDC でログインさせる
  2. CMS (Payload) のログインを流用する — CMS のセッション Cookie は `cms.aramakisai.com` のもので、`aramakisai.com` から使うには Cookie ドメインか CORS の変更が要る
  3. 管理者画面を CMS のカスタムビューにする — D1 を CMS から読み書きする API と共有秘密値が別に要る
- **Selected Approach**: 1 (ユーザー選択)。認可コードフロー + `state` + PKCE (S256)。token エンドポイントで client secret 認証、userinfo の `groups` に `executive` があればセッションを発行する。セッションは HMAC 署名付き Cookie
- **Rationale**: CMS と同じ判定元 (Zitadel の role) と同じ取得経路 (userinfo) を使う。外部ライブラリを足さない
- **Trade-offs**: PR プレビューとローカル開発ではログインできない (リダイレクト URI が固定できない) ため認証を掛けない
- **Follow-up**: dev で実行委員と出展団体のアカウントでログインし、通過と拒否を実測する

### Decision: 交換用QRの署名に既存の秘密値を使う
- **Context**: 300 秒で失効する署名が要る
- **Selected Approach**: `STAMP_SIGNING_SECRET` を使い、署名対象を `exchange:<visitorId>:<expiresAt>` とする。企画QRの署名対象 `<id>:<category>` と接頭辞で区別する
- **Rationale**: 秘密値の配布経路 (Infisical → `--secrets-file`) を増やさない
- **Trade-offs**: 秘密値を変えると企画QRと交換用QRが同時に無効になる (開催期間中は変えない運用と同じ)

### Decision: 交換済みの一意性を部分一意インデックスで守る
- **Context**: 6.2, 6.3, 11.4
- **Selected Approach**: `exchanges` に `cancelled_at IS NULL` の部分一意インデックスを張る。登録は INSERT 1 文で、衝突は既に交換済みとして扱う
- **Rationale**: 同時登録の排他をアプリで書かない

## Risks & Mitigations
- 匿名IDを変えた大量書き込みで D1 の書き込み枠を使い切る — 匿名で呼べる API に IP 単位のレート制限
- 大学の Wi-Fi など同じ IP の来場者が制限に当たる — 制限値を余裕のある値にし、拒否件数を計測する
- iOS Safari で管理者画面の読み取りが動かない — 標準カメラでの読み取り (4.3) が残る。実機で確かめる
- 集計ページを開くたびに `stamps` を全件読む — 読み取り行数を計測し、開く頻度はスタッフの操作に限られる
- Workers Logs の CPU 時間は 10% サンプルで保持 7 日 — 開催後 7 日以内に取り出す手順を運用に入れる

## References
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Workers Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [Workers rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [barcode-detector](https://github.com/Sec-ant/barcode-detector)
