# Research & Design Decisions

## Summary
- **Feature**: `signage-sync-transport`
- **Discovery Scope**: Complex Integration(新しいWorkerとDurable Object、CMSからの保存時通知、端末の通信方式の置き換え)
- **Key Findings**:
  - Cache APIはCloudflare Accessの背後のWorkerでは使えないと公式に記載があり、サイネージのAPIはAccessの背後にある。キャッシュの共有に頼る案は本番で効かない前提で考える必要がある
  - DOを実装するWorkerにはバージョンURL(PRプレビュー)が発行されない。OpenNextも別のWorkerにDOを置くよう案内している。サイトのWorkerはDOを`script_name`で参照するだけにし、DOは別のWorkerに置く
  - Workerの要求数は、端末ごとの3秒ポーリングをWebSocketに置き換えると9台・31日で約924万から約38万に減る。DOの要求数(pingを20:1で換算)は約32万で、Paidの込み量100万にもFreeの1日10万にも収まる

## Research Log

### 現行の確認通信と負荷
- **Context**: 端末を増やしたときのCMSとWorkersの負荷の内訳を把握する
- **Sources Consulted**: `frontend/src/lib/signage-data.ts`、`frontend/src/app/api/signage/pin/route.ts`、`frontend/src/lib/signage-pin.ts`、`frontend/src/lib/use-polling.ts`、`frontend/src/lib/signage-time.ts`、`frontend/src/components/signage/signage-screen.tsx`、`frontend/src/lib/cms.ts`、`frontend/src/lib/parking-data.ts`
- **Findings**:
  - 端末は`/api/signage/pin`を取得完了から3秒後に再取得する。応答の`serverNow`から`clockOffsetMs`(serverNow+RTT/2−受信時刻)でずれを求める。非表示の間はポーリングを止め、表示に戻ると即時に取得する
  - `getPinState`はno-storeで`signage_settings`(depth=2)と`signage_slides`(idのみ)を毎回取得する
  - スナップショットは20秒ごと。CMSへの約10回の取得を`cachedFetch`でCache API(TTL 15秒、駐車場20秒、festival_metaは既定60秒)に共有する。表示対象なのに中身の無いスライドがあると`?fresh=1`で取り直し、端末側10秒・`__refresh`キー5秒の間隔制限がある
  - 1台あたり、pin 28,800件/日+スナップショット4,320件/日。9台・31日で約924万件
- **Implications**: 要求数を減らすには、固定の確認をHTTPのポーリングから外す必要がある。共有キャッシュでCMSの負荷を下げても要求数は減らない

### CMSの保存とトランザクション
- **Context**: 保存時通知をどのフックから出すか、通知の時点で保存が読めるか
- **Sources Consulted**: `cms/node_modules/payload/dist/collections/operations/updateByID.js`・`delete.js`、`cms/node_modules/payload/dist/globals/operations/update.js`(Payload 3.88.0)、`cms/src/hooks/media-edge-purge.ts`、`cms/src/payload.config.ts`、`cms/src/collections/signage-*.ts`、`cms/src/lib/signage-pin-release.ts`
- **Findings**:
  - `afterChange`・`afterDelete`・`afterOperation`のフックは、いずれも`commitTransaction(req)`より前に走る
  - 既存のエッジのpurgeは、commit後に走るジョブ(`payload.jobs.queue`、`waitUntil`で10秒待つ)に載せている。ジョブの自動実行は10秒ごとのcron
  - 読み取りレプリカ(`readReplicas`)を使う構成がある。未認証のREST読み取りはレプリカに届きうる
  - 固定の自動解除は同じ要求の中で`signage_settings`を更新するので、そのグローバルの`afterChange`も走る
  - `signage_slides`には`afterDelete`が無い。削除で固定が外れるときも、表示対象から消えることで`getPinState`の結果が変わる
- **Implications**: ジョブ経由は最大10秒遅れて1.1の3秒に収まらない。フックから直接送り、受け手(ハブ)が500ms待ってから読む。commitやレプリカの遅れには、5秒後にもう1回、固定と版の両方を取り直す。それでも外れた表示内容は2分のポーリングで補う

### Cache APIとAccess
- **Context**: 共有キャッシュでCMSへの問い合わせを台数から切り離せるか
- **Sources Consulted**: [Cache · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/cache/)、`aramakisai-infra/terraform/access.tf`
- **Findings**:
  - 「For Workers fronted by Cloudflare Access, the Cache API is not currently available.」
  - Cache APIはデータセンター単位で、複製されない
  - サイネージのAccessアプリケーションは`aramakisai.com/signage`と`aramakisai.com/api/signage`をdestinationsに持つ(ホスト名とパスで指定する種類)
- **Implications**: 既存の`cachedFetch`の共有も本番で効いていない疑いがある(未実測)。版付きの取り直しは、効いていれば共有、効いていなければ各自取得のどちらでも正しく動くようにする

### Durable ObjectsとWebSocket Hibernation
- **Context**: 全端末へのpushを1か所で行う
- **Sources Consulted**: [Use WebSockets · Durable Objects docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- **Findings**:
  - `ctx.acceptWebSocket`で受け、`serializeAttachment`で接続ごとの値を保持できる(16,384バイトまで)
  - 「Ping/pong handling does not interrupt hibernation.」(プロトコルのping)。「Billable Duration (GB-s) charges do not accrue during hibernation.」
  - 「Events such as alarms, incoming requests, and scheduled callbacks prevent hibernation.」「This includes `setTimeout` and `setInterval` usage.」
  - 「Outgoing WebSockets do not hibernate.」「an open outbound WebSocket connection prevents eviction for up to 15 minutes.」
  - 「Deploying a new version restarts every Durable Object, which disconnects any existing connections.」
  - 1インスタンスで数千の接続を受けられる
- **Implications**: 遅延はalarmで行い`setTimeout`を使わない。pingは`setWebSocketAutoResponse`の固定の応答で返し、DOを起こさない(下の「DOの休止とping/pongの自動応答」参照)。上流への接続をDOに持たせると、その間はhibernationしない。ハブのデプロイで全端末が切れるので、端末は自動で接続し直す

### Durable Objectsの料金と込み量
- **Context**: 3.2・3.3と、11/22以降のFreeでの扱い
- **Sources Consulted**: [Pricing · Durable Objects docs](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Pricing · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/pricing/)
- **Findings**:
  - Free: 1日10万要求、13,000GB-s/日。SQLite backedのDOのみ使える。上限を超えると操作が失敗する。日次の上限はUTCの0時に戻る
  - Paid: 月100万要求込み(超過100万ごとに0.15ドル)、40万GB-s込み(超過100万GB-sごとに12.50ドル)
  - 要求に数えるのはHTTP要求、RPC、WebSocketのメッセージ、alarm。受信のWebSocketメッセージは20件で1要求。接続の確立は1要求。送信のメッセージ、受信のプロトコルのping、自動応答は課金されない
  - durationは1オブジェクトあたり128MBで計算する。hibernationできる待機中は課金されない
  - `setAlarm()`はSQLite backedでは1行の書き込みに数える(Freeは1日10万行)
  - Workers: 「Durable Objects are available both on Workers Free and Workers Paid plans.」Freeは「Only Durable Objects with SQLite storage backend are available.」
  - Workers: 「Requests made from your Worker to another worker via a Service Binding do not incur additional request fees.」「WebSocket connections made to a Worker are charged as a request.」「WebSocket messages routed through a Worker do not count as requests.」
- **Implications**: 9台でpingを5秒ごとにしても1日約7,800要求で、alarmや接続を足しても約10,300/日。Paid期間31日で約32万、Free期間でも1日の上限の約1割。durationはalarmの起動(60秒ごと)だけで約3,200GB-s/日の上限(下の確認結果と、design.mdのPerformance & Scalability)

### バージョンURLとDurable Objects
- **Context**: PRプレビュー(`wrangler versions upload`のバージョンURL)とe2eを保てるか
- **Sources Consulted**: [Preview URLs · Workers docs](https://developers.cloudflare.com/workers/configuration/previews/)、[Gradual deployments with Durable Objects](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/)、[Skew protection · OpenNext](https://opennext.js.org/cloudflare/howtos/skew)
- **Findings**:
  - 「Version URLs are not generated for Workers that implement a Durable Object, including Containers and Sandbox Workers.」
  - 「Versions of Worker bundles that change Durable Object class lifecycle cannot be uploaded.」lifecycleの変更(migration)は`wrangler deploy`で単独に出す
  - 「For a given deployment, requests to each Durable Object will always use the same Worker version.」
  - OpenNext: 「Preview URLs are disabled for Workers that implement a Durable Object.」「If your app uses Durable Objects, they will need to be implemented in a separate Worker.」
- **Implications**: DOのクラスは別のWorker(`aramakisai-signage-hub`)に置き、サイトのWorkerは`script_name`付きのbindingで参照する。PRプレビューのサイトは本番のハブに繋がる。ハブはPRプレビューもdev環境も持たず、ローカルの`wrangler dev`で確かめる。`script_name`だけのbindingでバージョンURLが出ることは公式に明記が無いため、最初のPRで確かめる

### OpenNextのカスタムworker
- **Context**: WebSocketのupgradeと通知を、Next.jsのルートを通さずDOへ渡す
- **Sources Consulted**: [Custom Worker · OpenNext](https://opennext.js.org/cloudflare/howtos/custom-worker)、`frontend/node_modules/@opennextjs/cloudflare/dist/cli/templates/worker.js`(1.20.1)
- **Findings**:
  - カスタムworkerから`./.open-next/worker.js`の`default`をimportしてfetchを委ね、`wrangler`の`main`をカスタムworkerに向ける。生成物はビルド時にできるので型の抑制が要る
  - 生成される`worker.js`は`DOQueueHandler`・`DOShardedTagCache`・`BucketCachePurge`をexportしている。再exportはDO QueueやDO Tag Cacheを使うときだけ要る(このサイトは`memoryQueue`で使っていない)
- **Implications**: 入口は`/api/signage/ws`と`/api/signage/notify`だけを扱い、OpenNextのDOのクラスは再exportしない

### Accessの背後のWebSocket
- **Context**: 端末の接続をAccessの保護下で行えるか
- **Sources Consulted**: [Cloudflare Access · Workers docs](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)、[Policy inheritance(app paths)](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)、[WebSockets · Network settings](https://developers.cloudflare.com/network/websockets/)
- **Findings**:
  - 「Worker-level Access policies do not currently support WebSocket connections.」「WebSocket upgrade requests to a Worker protected by a worker-level Access policy will fail with a `403` error.」WebSocketにはホスト名ベースのAccessアプリケーションを使うよう案内されている
  - 下位のパスは、固有の規則が無ければ親のパスの規則を引き継ぐ。`/api/signage/ws`・`/api/signage/notify`は`/api/signage`の配下
  - プロキシ経由のWebSocketは追加の設定なしで動く
  - Accessのcookieが同じオリジンのWebSocketのupgrade要求に付くことと、Accessがそれを検査して通すことを明記したページは見つからなかった
- **Implications**: 既存のサイネージのAccessアプリケーション(ホスト名とパス)の配下に置けば動く見込み。本番でログイン済みの端末の101と、未ログインの拒否を確かめる

### CMSのシークレットの置き場
- **Context**: 通知の認証に使う値をどこに置くか
- **Sources Consulted**: `docs/cms-operations.md`、`cms/src/env.ts`、`cms/src/lib/edge-purge.ts`、`aramakisai-infra/terraform/access.tf`(E2E用のService Tokenと`non_identity`のpolicy)
- **Findings**:
  - CMSの実行時の環境変数はk8sのDeploymentと`cms-secrets`(ExternalSecret、Infisical prodが元)から入る
  - 外部へ送る設定が揃わなければ何もせず、プロセスにつき1回だけ警告する前例がある(`readPurgeConfig`・`warnIfPurgeUnconfigured`)
  - AccessのService Tokenと`non_identity`のpolicyを特定のアプリケーションに足す前例がある(E2E)
- **Implications**: 同じ形で、通知専用のService Tokenをサイネージのアプリケーションに足し、その値をInfisical prodから`cms-secrets`経由でCMSへ渡す

### Cloudflareの利用量の取得(運用ダッシュボード)
- **Context**: 8.1〜8.3。既存のcollectorにWorkersのCPU時間とDOの利用量を足す
- **Sources Consulted**: `aramakisai-infra/gitops/manifests/prod/ops-dashboard/collector/`(`app/sources/billing_cloudflare.py`・`app/plan.py`・`dashboard.toml`・`app/render/labels.py`)、`aramakisai-infra/.kiro/steering/tech.md`、[Durable Objects metrics and analytics](https://developers.cloudflare.com/durable-objects/observability/graphql-analytics/)、[Querying Workers Metrics with GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/)、[API token authentication · GraphQL Analytics](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)、第三者の実装(`NWBY/cftop`の`src/queries.ts`、`skymethod/denoflare`の`common/analytics/cfgql_client.ts`、`thedotmack/claude-mem`の`workers/sync-hub/src/watchdog.ts`)
- **Findings**:
  - collectorは`workersInvocationsAdaptive`の`sum.requests`を、UTCの0時からと暦の月初(UTC)からで取り、`dashboard.toml`の`[[plans]]`(`active_plan`はJSTの日付で選ぶ)の`requests_day`・`requests_month`と比べて`quota_item`にしている。警告は`warn_ratio = 0.8`
  - `dashboard.toml`のWorkers Paidは2026-11-01〜11-30で、WBSの10/23〜11/22とずれている
  - トークン`OPS_CLOUDFLARE_READ_TOKEN`は既に`Account Analytics Read`を持つ。公式はアカウント単位のGraphQL Analyticsに「Account」「Account Analytics」「Read」を求める
  - DOの公式のデータセット: `durableObjectsInvocationsAdaptiveGroups`(`sum.requests`)、`durableObjectsPeriodicGroups`(`sum.cpuTime`等)、`durableObjectsStorageGroups`、`durableObjectsSubrequestsAdaptiveGroups`。WebSocketのメッセージ数は`durableObjectsPeriodicGroups`にあり、hibernationでの受信は`durableObjectsInvocationsAdaptiveGroups`に現れる。フィールドの一覧はintrospectionで見るよう案内されている
  - 公式のチュートリアルはWorkersのCPU時間を`quantiles.cpuTimeP50`等でしか示していない。第三者の実装は`workersInvocationsAdaptive`の`sum.cpuTimeUs`、`durableObjectsPeriodicGroups`の`sum.duration`(スキーマの説明では「Sum of Duration - GB*s」)・`sum.activeTime`・`sum.inboundWebsocketMsgCount`を使っている
  - DOの請求では受信のWebSocketメッセージ20件が1要求。`durableObjectsInvocationsAdaptiveGroups`の`requests`がhibernation中の受信を1件ずつ数えているなら、そのままでは請求より多くなる
- **Implications**: 問い合わせを1つ広げるだけで足り、トークンの権限の追加は要らない。`cpuTimeUs`・`duration`・`inboundWebsocketMsgCount`は公式の文書に名前が無いので、実装の最初にintrospectionで確かめる。DOのリクエスト数は受信のWebSocketの換算分を差し引き、請求の使用量と比べて確かめる。Paidの集計の起点は暦の月初でなく、プランの`from`にする

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| DO+WebSocket Hibernation、保存時通知(採用) | 1つのDOが全端末の接続を持ち、CMSの通知で取り直して配る | 要求数が台数×3秒に比例しない。反映が保存直後。他機能(速報)のpush経路になる | 新しいWorker、CMSの通知とその認証、端末のクライアントの作り直し | 別WorkerにしてPRプレビューを保つ |
| Cache APIで短TTL共有 | pinの状態をTTL 1秒で共有し、未命中時だけCMSへ | 変更が小さい | Accessの背後でCache APIが使えない。Workersの要求数は減らない(9台31日で約924万) | 不採用 |
| `cf.cacheTtl`によるCDN共有 | CMSへの取得をCDNで1〜数秒キャッシュ | Accessの影響を受けない(CMSのホストはAccessの外) | 反映がTTL+ポーリング3秒+往復で最悪4秒強。Workersの要求数は減らない。サーバーからのpushの経路にならず、速報に使えない | 不採用 |
| CMS側のメモリキャッシュ | Payloadで表示対象の計算結果を短時間保持 | DBの負荷は下がる | CMSへの要求数とWorkersの要求数は減らない。Pod間で共有されない | 不採用 |
| SSE | Workerが応答を開いたまま変化時に送る | ブラウザ標準で再接続がある | Workerの1要求を長く保持し、待機中も変化を知る手段(結局DO等)が要る。サーバー→端末の片方向でpingの往復が取れない | 不採用 |
| ロングポーリング | 変化があるまで応答を保留 | 要求数は減る | 待機中に変化を知る手段が要る点はSSEと同じ。RTTに保留時間が入り、時刻補正が成り立たない | 不採用 |
| 条件付きリクエスト(ETag/304) | 状態のハッシュをETagにして変化なしは304 | 転送量は減る | 304も1要求に数える。ETagを決めるのにCMSへの問い合わせが要る | 不採用 |
| DOをサイトのWorkerに同居 | `main`のカスタムworkerでDOのクラスもexport | Workerが1つで済む | バージョンURLが出なくなり、PRプレビューとe2eが壊れる | 不採用 |
| スナップショットの中身をpushで配る | 更新時にハブが中身を取って配る | 端末のHTTP取得が無くなる | 表示対象の判定をハブ側に持ち込む必要があり、5.1を既存の公開判定で守れなくなる。スナップショットは大きい | 不採用。版だけを配る |

## Design Decisions

### Decision: DOを別のWorkerに置く
- **Context**: DOを実装するWorkerにはバージョンURLが出ず、PRプレビューとe2eが前提を失う
- **Alternatives Considered**:
  1. サイトのWorkerに同居させる
  2. 別のWorker(`aramakisai-signage-hub`)に置き、サイトのWorkerは`script_name`で参照する
- **Selected Approach**: 2。ハブのWorkerは`workers_dev = false`・`preview_urls = false`で公開のURLを持たない。dev用のハブは持たず、dev環境とPRプレビューのサイトも本番のハブに繋ぐ。ハブは先にmainまで出し、その後にサイトのbindingを出す2段階でデプロイする
- **Rationale**: PRプレビューを保ちつつ、サイトのWorkerのデプロイでDOが再起動しない(端末の接続が切れない)
- **Trade-offs**: デプロイの順序(ハブが先)とジョブが増える。PRプレビューのサイトは本番のハブに繋がるので、メッセージの型は後方互換で変える
- **Follow-up**: `script_name`だけのbindingでバージョンURLが出ることを最初のPRで確かめる

### Decision: 通知はAccessの中に置き、通知専用のService Tokenだけで認証する
- **Context**: CMS(k8s)からサイトのWorkerへ保存を知らせる。5.2は認証を通っていない要求でWorkerを起動させないことを求める
- **Alternatives Considered**:
  1. Accessの外のパス(例`/internal/signage-notify`)に置き、Workerで共有シークレットを照合する
  2. 既存のAccessの配下(`/api/signage/notify`)に置き、Service TokenでAccessを通し、Workerでも共有シークレットを照合する(二重の認証)
  3. 2のうちService Tokenだけにする
- **Selected Approach**: 3。トークンは既存の`e2e_ci`と同じ形(`duration = "8760h"`、`min_days_for_renewal = 30`、`create_before_destroy`、`decision = "non_identity"`の独立したpolicy)で通知専用に新設し、`aramakisai_signage`のアプリケーションに許可する
- **Rationale**: 認証を通っていない要求がWorkerに届かない(5.2)。通知は本文に中身を持たず、ハブに取り直しを促すだけなので、Accessを通れる利用者から送られても起きるのは取り直しだけで、表示の中身は差し込めない。値はCMSに2つで済み、Workerにシークレットを持たせずに済む
- **Rejected**:
  - 1: infraの変更は要らず値も1つで済むが、Accessの外なので外部の要求でWorkerが起動し、5.2に反する。共有シークレットの照合をWorkerに持つ必要もある
  - 2: サイネージ用の共有アカウントなどAccessを通れる利用者からの通知も拒めるが、守れるのは「取り直しを起こさせない」ことだけで、中身の改ざんの余地は元から無い。CMSに3つの値、Workerにシークレットと照合の処理が増え、更新の手間も2系統になる
  - `e2e_ci`の使い回し: workers.devのアプリケーションにしか許可されておらず、用途ごとに分ければ失効や更新が互いに影響しない
- **Trade-offs**: サイネージ用の共有アカウントでログインしたブラウザからも通知を送れる(残るリスク)。トークンは1年ごとに作り直され、そのたびに`cms-secrets`の値を差し替えてCMSを再起動する手間がある
- **Follow-up**: トークンの期限日を運用ダッシュボードの`[[credentials]]`に宣言する

### Decision: 通知を受けたら500ms待ってから取り直す
- **Context**: Payloadのフックはcommitより前に走る。連続保存(並べ替え、自動解除)は通知が続けて届く
- **Alternatives Considered**:
  1. commit後に走るジョブで送る(既存のpurgeと同じ)
  2. フックから直接送り、ハブがalarmで500ms待ってから取り直す
- **Selected Approach**: 2。commitやレプリカの遅れに備えて、5秒後に同じ`targets`でもう1回取り直す(固定は変われば配り、版はもう一度進める)
- **Rationale**: ジョブは10秒ごとのcronで1.1に収まらない。alarmなら待ちとまとめが同じ仕組みで済み、hibernationを妨げない
- **Trade-offs**: commitやレプリカが500ms以上遅れると、表示内容の反映は次のポーリング(2分)まで遅れる
- **Follow-up**: 本番で保存から反映までを測り、取りこぼしが出るなら待ちを延ばす

### Decision: 固定のポーリングはやめ、保険はハブの取り直しとスナップショットのポーリングで持つ
- **Context**: WebSocketが使えない間の保険として、3秒ごとのpinのポーリングを残すか
- **Alternatives Considered**:
  1. pinのポーリングを残す(間隔を延ばす)
  2. やめる。ハブは60秒ごとに取り直し、端末はスナップショットを2分ごとに取る
- **Selected Approach**: 2
- **Rationale**: スナップショットは未認証の読み取りで表示対象に絞られた`slides`と`pinnedSlideId`を持ち、それだけで固定と表示対象の保険になる。pinのポーリングを残すと端末ごとの要求が戻り、経路が2本になって状態の優先順位を決める必要が出る
- **Trade-offs**: WebSocketが繋がらない間、固定の反映は最悪2分強かかる
- **Follow-up**: なし

### Decision: 時刻補正はスナップショットの`serverNow`、ping/pongは自動応答の生存確認
- **Context**: 時刻を載せたpongはpingのたびにDOを起こし、5秒間隔では休止できない(常時稼働で約10,800GB-s/日)
- **Alternatives Considered**:
  1. `webSocketMessage`でpingを受け、`serverNow`付きのpongを返す
  2. 固定文字列の自動応答(DOを起こさない)にし、時刻はスナップショットの`serverNow`から求める
- **Selected Approach**: 2。pongは生存確認(5秒以内に来なければ再接続)だけに使う。接続直後のメッセージにも時刻は載せない(スナップショットで足りる)
- **Rationale**: 2.2の「配信元の時刻に合わせる」を保ったまま、DOを休止できる。時刻のずれの求め方は`signage-screen.tsx`に既にある
- **Trade-offs**: ずれの更新が2分ごと(と版の取り直しごと)になる
- **Follow-up**: 本番で`quota.do_gbs_day`を見積もりと比べる

### Decision: 表示内容は版だけをpushし、端末が取り直す
- **Context**: 6.1の数秒以内の反映。5.1の表示対象外の中身を配らないこと
- **Alternatives Considered**:
  1. 中身をpushで配る
  2. 版をpushし、端末が`/api/signage?v=<版>`を取り直す
- **Selected Approach**: 2。端末は0〜1秒の乱数で待ってから取り直す。既存の`?fresh=1`・端末側10秒・`__refresh`5秒の間隔制限は、版付きのキーに置き換えて削除する
- **Rationale**: 中身はこれまでどおり公開判定を通るHTTPで取る。版付きのキーなら、同じ版の取得どうしは共有でき、新しい版が古い取り直しの結果を読むことは無い。間隔制限は連続保存の2回目以降の反映を最大10秒遅らせ、6.1と衝突する
- **Trade-offs**: 保存のたびに端末の台数ぶんの要求とCMSへの問い合わせが出る(Cache APIが効かない場合、9台×約10件)。乱数の待ちのぶん反映が最大1秒遅れる
- **Follow-up**: 駐車場の更新が多い日のCMSの負荷を見る

### Decision: スナップショットのポーリングを2分にする
- **Context**: 6.2は知らせが届かない場合に数分以内の反映を求める。要求数を減らしたい
- **Selected Approach**: 2分。最悪は2分+共有キャッシュのTTL(スナップショット15秒、駐車場の判定に使う`festival_meta`は既定60秒)
- **Rationale**: 3分でも6.2を満たすが、通知が欠落したときの固定の保険も兼ねるため短い方を取る。2分で9台・31日約20万要求
- **Trade-offs**: なし(20秒から要求は1/6)

## Risks & Mitigations
- Accessの背後でWebSocketのupgradeが通らない — 公式に明記が無い。本番で101を確かめるまで、旧来のpinのポーリングを持つ旧JSを残せるよう、端末の切り替えは最後(全端末の再読み込み)に行う
- `script_name`だけのbindingでもバージョンURLが出ない — 最初のPRで確かめる。出ない場合は、PRプレビューではbindingを外す設定(`[env.preview]`等)を検討する
- ハブのデプロイで全端末の接続が切れる — 自動で接続し直す。開催中(11/14〜15)はハブをデプロイしない
- 通知用のService Tokenの更新後、`cms-secrets`の差し替えまで通知がAccessに拒否される — ハブの60秒の取り直しと2分のポーリングで反映は続く。期限日をダッシュボードで知らせ、差し替えの手順を`docs/cms-operations.md`に書く
- 通知がcommitやレプリカの遅れより早く届く — 500msの待ちと5秒後の確かめ(固定と版)、2分のポーリング
- ハブの変更を本番の前に端末で確かめる環境が無い — `make signage-dev`で確かめる。メッセージの型は後方互換で変える
- DOのリクエスト数の換算(WebSocketの受信20:1)をGraphQLの値から正しく出せない — 実装後にCloudflareの請求の使用量と比べ、合わなければ換算しない値(多めの側)を出す
- 速報の上流接続をハブに持たせるとhibernationしなくなる — 別のDOクラスに置くことを推奨し、durationは最悪でも込み量に収まることを確かめた
- Accessのセッション切れで接続できなくなる — 既存の運用(開催前日の再ログイン)のまま。端末は指数バックオフで要求を増やさない
- 駐車場の更新が多いとCMSへの問い合わせが集中する — ハブの500msのまとめ、端末の乱数の待ち

## References
- [Durable Objects metrics and analytics](https://developers.cloudflare.com/durable-objects/observability/graphql-analytics/) — DOのGraphQLのデータセット
- [Querying Workers Metrics with GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/) — `workersInvocationsAdaptive`の問い合わせ
- [API token authentication · GraphQL Analytics](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/) — Account Analytics Readの権限
- [Cache · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/cache/) — Accessの背後でCache APIが使えない
- [Use WebSockets · Durable Objects docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) — Hibernation API、outboundのWebSocket、デプロイでの切断
- [Pricing · Durable Objects docs](https://developers.cloudflare.com/durable-objects/platform/pricing/) — 込み量、20:1、Freeの上限、alarmの課金
- [Pricing · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/pricing/) — FreeでのDO、Service binding、WebSocketの要求の数え方
- [Preview URLs · Workers docs](https://developers.cloudflare.com/workers/configuration/previews/) — DOを実装するWorkerにバージョンURLが出ない
- [Gradual deployments with Durable Objects](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/) — lifecycleを変える版はupload不可
- [Skew protection · OpenNext](https://opennext.js.org/cloudflare/howtos/skew) — DOは別のWorkerに
- [Custom Worker · OpenNext](https://opennext.js.org/cloudflare/howtos/custom-worker) — カスタムworkerの入口
- [Cloudflare Access · Workers docs](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) — Worker単位のAccessはWebSocket非対応
- [Policy inheritance · Cloudflare One docs](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) — 下位パスの規則の継承

## DOの休止とping/pongの自動応答(確認結果)
- **Sources**: [Pricing · Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Use WebSockets · Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[DurableObjectState · Durable Objects API](https://developers.cloudflare.com/durable-objects/api/state/)、[Lifecycle of a Durable Object](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)
- **確認できたこと**
  - `setWebSocketAutoResponse(new WebSocketRequestResponsePair(request, response))`は、一致する受信に、休止中のWebSocketを起こさずに応答する。引数を省くと設定が消える。request・responseは各2,048文字まで(State API)
  - 自動応答は「additional wall-clock timeを消費せず課金されない」(Pricing)
  - 「休止できる待機中のDOはdurationを課金されない」(Pricing)。durationは1オブジェクトあたり128MBで計算(Pricing)
  - 受信のWebSocketメッセージは20件で1要求に換算して課金。接続の確立は別に1要求(Pricing)
  - Free: 13,000GB-s/日。超えるとその種の操作はエラーになる。UTC0時にリセット。Paid: 月40万GB-s込み、超過は100万GB-sあたり12.50ドル(Pricing)
  - 休止に入る条件: 実行中のリクエスト・イベントが無い、`setTimeout`/`setInterval`のコールバックが無い、未完了の`waitUntil`・アウトバウンド接続が無い。休止できる待機状態になってから10秒の無活動で休止する(Lifecycle: 「after 10 seconds of inactivity」)
  - 休止中にイベントが来るとコンストラクタが再実行されて起動する(Lifecycle)。プロトコルのping/pongは休止を妨げない(WebSockets)
- **未確認**
  - 自動応答の受信がリクエスト数(20:1換算)に数えられるか。文書は自動応答をdurationの面でしか述べていない
  - 自動応答がリクエスト文字列の完全一致だけか(文書は「matching the provided request」とのみ記載)
  - alarmが休止中のDOを起こすと明記した箇所(Lifecycleは「アクティブでないオブジェクトに最初に来るリクエストまたはイベント(alarmなど)でコンストラクタが走る」とする)
  - 休止に入るまでの10秒の待ちが課金対象か(課金対象の状態の一覧に休止できる待機は無いが、明記は無い)
- **Implications**: 5秒ごとの時刻付きpongはDOを起こすので休止できない。固定文字列の自動応答にすればDOは休止でき、時刻はスナップショットの`serverNow`から求める。GB-sの見積もりは、休止に入るまでの10秒を課金されるものとして計算する
