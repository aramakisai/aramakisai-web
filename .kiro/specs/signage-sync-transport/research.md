# Research & Design Decisions

## Summary
- **Feature**: `signage-sync-transport`
- **Discovery Scope**: Extension(既存の`/api/signage/pin`の取得経路に共有キャッシュを足す)
- **Key Findings**:
  - 端末の要求数はポーリング間隔で決まり、CMSへの問い合わせ数は`/api/signage/pin`の要求数に比例している。CMSへの問い合わせは、Workersの要求の手前で共有キャッシュを挟めば端末の台数から切り離せる
  - Cache API(`caches.default`)はデータセンター単位で、追加料金なしで使える。一方で公式ドキュメントに「Cloudflare Accessの背後のWorkerではCache APIは現在使えない」とあり、`/api/signage*`はAccessの背後にある。本番で効くかは実測で確かめる必要がある
  - 9台を31日間つけっぱなしにすると、サイネージだけでWorkersの要求は約924万件になり、公式サイト分と合わせると月1,000万件の込み量に迫るか超える。要求数そのものは通信方式を変えない限り減らないため、運用(夜間消灯)で抑える

## Research Log

### 現行の確認通信と負荷
- **Context**: 端末を増やしたときのCMSとWorkersの負荷の内訳を把握する
- **Sources Consulted**: `frontend/src/lib/signage-data.ts`(`getPinState`)、`frontend/src/app/api/signage/pin/route.ts`、`frontend/src/lib/signage-pin.ts`、`frontend/src/lib/use-polling.ts`、`frontend/src/components/signage/signage-screen.tsx`、`cms/src/lib/signage-visibility.ts`
- **Findings**:
  - 端末は取得完了から3秒後に次の`/api/signage/pin`を送る(ジッターなし)。画面が非表示の間はポーリングを止め、表示に戻ると即時に1回取得する
  - `getPinState`は`ttlSeconds: 0`(no-store)で`signage_settings`(depth=2)と`signage_slides`(idのみ)を並行して取得する。CMSは未認証の読み取りごとに`loadVisibleSlideIds`で有効なスライドとグループをDBから読む
  - 応答の`serverNow`は端末の時刻補正(`clockOffsetMs`=serverNow+RTT/2−受信時刻)の情報源で、3秒ごとに更新される
  - スナップショット`/api/signage`は20秒ごとで、CMSへの約10回の取得をCache API(TTL 15秒)で端末間に共有している。表示対象に中身の無いIDがあると`?fresh=1`で取り直す(端末側で最短10秒間隔、`__refresh`キー5秒)
  - CMSには保存時に外部へ知らせる経路(webhook・revalidate)が無い
- **Implications**: CMSへの問い合わせを台数から切り離すには、pinの結果をWorkers側で共有すれば足りる。端末側の挙動は変えなくてよい

### Cache APIの範囲と制約
- **Context**: pinの状態の共有先として、追加料金のかからないCache APIが使えるか
- **Sources Consulted**: [Cache · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- **Findings**:
  - 「The Cache API is available globally but the contents of the cache do not replicate outside of the originating data center.」共有はデータセンター単位
  - 「Workers deployed to custom domains have access to functional `cache` operations.」本番はカスタムドメイン(aramakisai.com)で動く
  - 「For Workers fronted by Cloudflare Access, the Cache API is not currently available.」サイネージの画面とAPIはAccessの背後にある
  - `put()`はGET以外・206・`Vary: *`で例外、Cache-Controlが保存を禁じると413。`stale-while-revalidate`は未対応
  - 1秒といった短いTTLがどの精度で失効するかの記載は無い
- **Implications**:
  - Accessの背後で`caches.default`が無効になる場合、`match`が常に未命中になり現行と同じ「毎回CMSへ問い合わせる」振る舞いに戻る(悪化はしない)。既存のスナップショットの共有キャッシュも同じ条件にあるため、本番のCMSアクセスログで命中を確かめる手順を検証に含める
  - 失効の精度に頼らないよう、保存した時刻をエントリに持たせ、読み出し時にもTTLを判定する
  - PRごとのプレビュー(workers.dev)ではキャッシュが効かない可能性があり、プレビューでの命中確認は本番の判断材料にしない

### Workersの料金と込み量
- **Context**: 3.2の「有料プランに含まれる量に収める」の可否を数字で確かめる
- **Sources Consulted**: [Pricing · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/pricing/)
- **Findings**:
  - Paid: 月額最低5ドル、要求は月1,000万件込み(超過100万件ごとに0.30ドル)、CPU時間は月3,000万ms込み(超過100万msごとに0.02ドル)
  - Free: 1日10万要求
  - 端末1台あたりの要求: pin 86,400÷3=28,800件/日(取得完了起点なので実際はやや少ない)、スナップショット86,400÷20=4,320件/日、計約33,100件/日
  - 9台: 約30万件/日。Paid期間(10/23〜11/22、31日)を終日つけっぱなしにすると約924万件
  - CPU時間: 924万件を3,000万msに収めるには、公式サイト分を除いても1要求あたり平均約3.2ms以下が要る
- **Implications**: キャッシュはCMS負荷を下げるが、Workersの要求数は減らさない。3.2は運用(使わない時間帯は画面を消す)と実測(CPU時間)に依存する。夜間に消すと、非表示中は`use-polling`がポーリングを止めるので要求はゼロになる

### Durable ObjectsとWebSocket
- **Context**: pushで要求数そのものを減らせるか
- **Sources Consulted**: [Pricing · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/pricing/)、[Use WebSockets · Durable Objects docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- **Findings**:
  - Durable Objects: Paidで月100万要求・40万GB-s込み、WebSocketの受信メッセージは20:1で要求に換算。Hibernation中は「Billable Duration (GB-s) charges do not accrue」
  - FreeでもSQLiteバックエンドのDurable Objectsは使える(1日10万要求)
- **Implications**: 料金面では収まる見込みだが、構成の変更量が大きい(下記の評価)

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Cache APIで短TTL共有(採用) | pinの状態(固定と表示対象、または失敗)をTTL 1秒で1エントリ共有。未命中時だけCMSへ2回問い合わせる | 変更が`signage-data.ts`内で閉じる。端末・時刻補正・CMSを変えない。追加料金なし | 反映が最大約1秒遅れる。Accessの背後で無効の可能性。Workers要求数は減らない | 未命中の同時発生は台数が少ないため許容 |
| Durable Objects+WebSocket(Hibernation)でpush | CMSの保存を契機にDOから全端末へ送る | 端末の要求がほぼ接続維持だけになる。反映が保存直後 | CMSに保存時の通知経路とその認証を新設する必要。OpenNextのワーカー入口にDOのクラスを足す改修。WebSocketでの時刻補正の作り直し。開催まで約1か月で変更量とリスクに見合わない。11/22以降Freeに戻ったときの扱いも要検討 | 不採用 |
| SSE/ロングポーリング | 1要求を長く保持し、変化時に返す | Workersの要求数は減る | 待機中もWorker内でCMSへの確認を回す必要があり、CMS負荷は減らない。RTTに保持時間が含まれ、`serverNow+RTT/2`の時刻補正が成り立たない | 不採用 |
| 条件付きリクエスト(ETag/304) | 状態のハッシュをETagにし、変化なしは304 | 転送量は減る | 304もWorkersの1要求として数えられる。ETagを決めるのにCMSへの問い合わせが要るので、CMS負荷も減らない | 不採用 |
| スナップショットへの統合 | pinをやめ、スナップショットに固定と表示対象を含めて頻度を上げる | エンドポイントが1つになる | スナップショットはCMSへ約10回の取得で重く、3秒周期にできない。周期を保つと反映が数十秒になり1.1を満たさない | 不採用 |

## Design Decisions

### Decision: pinの状態をCache APIにTTL 1秒で共有する
- **Context**: CMSへの問い合わせが端末の台数に比例している(3.1)
- **Alternatives Considered**:
  1. Cache APIで短TTL共有
  2. Durable Objects+WebSocket
  3. SSE/ロングポーリング
  4. ETag/304
  5. スナップショットへの統合
- **Selected Approach**: `getPinState`の中で、固定と表示対象(または失敗)を1エントリとしてCache APIに読み書きする。未命中のときだけCMSへ2回問い合わせる。`serverNow`はエントリに入れず、要求ごとに応答直前の時刻を付ける
- **Rationale**: CMSへの問い合わせはデータセンターあたり概ね1秒に1組になり、台数に依らない。端末側・時刻補正・CMSを変えずに済み、開催まで1か月の変更として小さい
- **Trade-offs**: 反映が最大約1秒遅れる(最悪約4秒強)。Workersの要求数は変わらない
- **Follow-up**: 本番でCMSへの問い合わせ頻度を実測し、命中していることを確かめる

### Decision: 既存の`cachedFetch`を使わない
- **Context**: `cms.ts`の`cachedFetch`は個々のCMS取得をTTL付きで保存する
- **Alternatives Considered**:
  1. `findGlobal`・`findMany`に`ttlSeconds: 1`を渡す
  2. pinの状態全体を1エントリで保存する
- **Selected Approach**: 2
- **Rationale**: `cachedFetch`は成功応答しか保存しないため、CMS障害時に毎回問い合わせが届く(3.4を満たさない)。また2つの取得が別々の時点で保存・失効するので、固定のスライドと表示対象のIDが異なる時点の組み合わせになりうる(固定したスライドが表示対象に無いと判定され、一瞬固定が外れる等)。1エントリなら2つは常に同じ時点の組になる
- **Trade-offs**: Cache APIの読み書きを`signage-data.ts`側に数行持つ。`cms.ts`からはキャッシュの取得(`getEdgeCache`)だけを共有する
- **Follow-up**: なし

### Decision: 失敗も同じTTLで保存する
- **Context**: CMSが落ちている間、未命中のたびに問い合わせが届くと復旧を妨げる(3.4)
- **Selected Approach**: 2回の問い合わせのどちらかが失敗したら、その失敗をTTL 1秒で保存する。命中した要求は従来どおり502を返し、端末は直前の状態を保つ(4.1)
- **Rationale**: 失敗中もCMSへの問い合わせ頻度が正常時と同じ上限になる。端末の再試行間隔は3秒のままで増えない
- **Trade-offs**: CMSが復旧しても最大1秒は失敗を返す
- **Follow-up**: なし

### Decision: 未命中の同時発生を許容する(単一フライト化しない)
- **Context**: 保存は`waitUntil`でCMSの応答後に行うので、CMSへの往復の間に届いた要求も未命中になる
- **Selected Approach**: 許容する。1データセンターあたりの問い合わせは1秒に「1組+往復時間中に届いた要求数」組が上限。9台(合計約3要求/秒)・往復0.2秒なら、平均で1秒に約1.6組
- **Rationale**: 端末が10台未満では、台数に比例する部分が小さい。単一フライト化(isolate内の待ち合わせや、別のロック)は複数のisolateにまたがると効かず、実装に見合わない
- **Trade-offs**: 台数を数十台に増やすと、往復時間中の未命中が比例して増える
- **Follow-up**: 増やす場合は、isolate内で進行中の取得を共有する、またはTTLを延ばすことを検討する

## Risks & Mitigations
- Cloudflare Accessの背後でCache APIが無効の可能性 — 無効でも振る舞いは現行と同じで悪化しない。本番のCMSアクセスログで`signage_settings`の取得頻度を測り、端末の台数に比例していれば無効と判断する。その場合の代替は、同じ関数の保存先をisolateのモジュールスコープの変数に替える案(isolate単位の共有で、追加料金なし)。採用の判断は実測後に行う
- 9台を31日間終日つけっぱなしにすると、サイネージだけで約924万件となり、公式サイトのピーク日(1日約10万件)と合わせると月1,000万件の込み量を超えうる — 使わない時間帯は画面を消す(非表示でポーリングが止まる)。例えば開催3日間(11/13〜15)に1日12時間だけ表示すると約45万件。超過しても100万件あたり0.30ドルで、停止はしない
- CPU時間が3,000万msを超える — 924万件を収めるには1要求あたり平均約3.2ms以下が要る。実装後にWorkersのメトリクスでCPU時間を確認し、超えそうなら運用で表示時間を絞る
- Cache APIの失効の精度が粗く、1秒より長く古い状態が返る — エントリに保存時刻を持たせ、読み出し時にTTLを判定する
- PRプレビュー(workers.dev)でキャッシュが効かない — プレビューでは機能の正しさ(応答の形・502)だけを確かめ、命中の確認は本番で行う

## References
- [Cache · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/cache/) — データセンター単位、Access背後での制約、`put`の制約
- [Pricing · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/pricing/) — Paidの込み量と超過料金、Freeの日次上限、Durable Objectsの料金
- [Use WebSockets · Durable Objects docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) — Hibernation中のduration課金
