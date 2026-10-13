# Research & Design Decisions

## Summary
- **Feature**: `signage-earthquake-alert`
- **Discovery Scope**: Complex Integration(外部の2系統のWebSocket、Cloudflare Durable Objects、既存のサイネージの配信経路、Payload CMS)
- **Key Findings**:
  - Wolfxの地震情報フィード(`jma_eqlist`)は最大震度しか持たず、前橋市の観測点の震度を持たない。前橋市の実測震度による段階の判定はP2P地震情報の551だけが根拠になり、Wolfxは「最大震度が4以下」のときの段階2への移行だけを冗長化できる。
  - 既存のハブのWorkerは`workers_dev = false`でサイトのWorkerの入口からしか呼べず、サイトの入口は変更禁止のため、CMSからの解除の口を持つ上流の接続のDOは、公開のURLを持つ別のWorkerに置く必要がある。
  - Discord Webhookは`?wait=true`で投稿すると作成したメッセージ(`id`を含む)を返し、`PATCH /webhooks/{id}/{token}/messages/{message_id}`で編集できる。レート制限は429と`retry_after`(秒)・`Retry-After`、`X-RateLimit-*`のヘッダで示され、Webhookの経路ごとの具体的な上限の数は文書に無い。
  - P2P地震情報のサンドボックスは2023年当時の発表時刻のまま再生し(受信日時`time`だけを再生時刻に書き換える)、`test`フラグを持たず、群馬県を対象地域に含む警報も前橋市の震度5強以上も含まない。試験モード(古い報の除外と群馬県の絞り込みを外し、すべて訓練扱い)が無いと、サンドボックスで段階1も出せない。

## Research Log

### P2P地震情報v2のスキーマ(一次情報)
- **Context**: 551・556の正確なフィールド名と震度の値表現を確定する。
- **Sources Consulted**: https://www.p2pquake.net/swagger-ui/specification.yaml(API仕様v2.3.0、2026-10-13取得)
- **Findings**:
  - 共通(BasicData): `id`(一意のID)、`code`、`time`(受信日時、`2006/01/02 15:04:05.999`形式)。同一の情報を複数回配信する可能性があり、`id`での重複除去を推奨。
  - 制限: `/ws`はIPあたり2接続、`/history`は60回/分、`/jma`は10回/分。WS APIの処理遅延は約70ms。サーバ・受信プログラムは冗長化しておらず、障害時の再配信も無い。
  - 551(JMAQuake): `issue.time`(発表日時)、`issue.type`は`ScalePrompt`(震度速報)・`Destination`(震源に関する情報)・`ScaleAndDestination`(震度・震源に関する情報)・`DetailScale`(各地の震度に関する情報)・`Foreign`・`Other`。`issue.correct`は訂正の有無。`earthquake.time`(発生日時)、`earthquake.hypocenter.name`(震源名)、`earthquake.maxScale`(最大震度、無ければ-1)。`points[]`は`pref`・`addr`(震度観測点名称。震度速報では区域名)・`isArea`(区域名かどうか)・`scale`。
  - 震度の値: 10=震度1、20=2、30=3、40=4、45=5弱、46=5弱以上と推定されるが震度情報を入手していない、50=5強、55=6弱、60=6強、70=7。`maxScale`には46が無い。
  - 556(EEW、警報のみ): `test`(テストかどうか、任意)、`cancelled`(取消、必須)、`issue.time`・`issue.eventId`・`issue.serial`(文字列)。`earthquake.originTime`・`arrivalTime`・`hypocenter.name`(取消のときは設定されない)。`earthquake.hypocenter.depth`(km、無ければ-1、整数部のみ有効)・`magnitude`(無ければ-1)。`areas[]`は`pref`(府県予報区)・`name`(細分区域名)・`scaleFrom`・`scaleTo`(-1=不明、99=〜程度以上)・`kindCode`(10=主要動が未到達と予測、11=既に到達と予測、19=到達予想なし(PLUM法)、いずれも警報)・`arrivalTime`(主要動の到達予測時刻)。
  - 時刻の文字列はタイムゾーンを持たない日本時間(例`2022/08/11 00:53:00`)。
- **Implications**: 前橋市の判定は`points[]`のうち`isArea === false`かつ`addr`が「前橋市」で始まるものに限る。`ScalePrompt`(区域のみ)と`Destination`(震度なし)は段階の判定に使わない。46は5強以上の可能性を否定できないため段階2の根拠にしない。重複除去のキーは`id`ではなく`eventId`と`serial`(2系統をまたいで同一視するため)。

### P2P地震情報の実データの形(本番・サンドボックス)
- **Context**: スキーマと実データの差、サンドボックスでの試験可否を確認する(試験モードの前提)。
- **Sources Consulted**: `wss://api-realtime-sandbox.p2pquake.net/v2/ws`に約8分接続して16件を受信(2026-10-13 14:34〜14:42 JST)。`https://api-v2-sandbox.p2pquake.net/v2/history?codes=556&limit=100`(44件)。`https://api.p2pquake.net/v2/history?limit=100`。`https://api.p2pquake.net/v2/jma/quake?prefectures[]=群馬県,10&since_date=20230401&until_date=20231019&quake_type=DetailScale&limit=100`(44件)。
- **Findings**:
  - サンドボックスのWSは約30秒に1件。受信日時`time`は再生した時点の時刻(例`2026/10/13 14:34:43.481`)に書き換わるが、`issue.time`・`earthquake.time`(551)、`issue.time`・`issue.eventId`(556)は2023年当時の値のまま。
  - P2Pのメッセージは、サンドボックスのWSも本番のWS(`wss://api.p2pquake.net/v2/ws`、2026-10-13に受信したcode 555)も、IDを`_id`(例`6ace4462c58757000704bbaf`)と`uid`に持ち`id`を持たない。HTTPの`/history`(サンドボックス・本番とも)は`id`を持つ。
  - サンドボックスの556は全件`test`フィールドを持たない(値はundefined)。`cancelled`は全件false、`serial`は全件"1"。
  - サンドボックスの556は再生の1周(約14.5時間)に13の地震。対象地域は北海道・石川県能登・千葉・茨城・埼玉県南部・東京都23区・伊豆諸島・静岡県伊豆・鹿児島県十島村・新潟・富山・長野県北部・岐阜県飛騨・宮城・沖縄県宮古島で、群馬県を含む警報は無い。`areas[].pref`は「千葉」「石川」のような府県予報区の短い名前、`name`は「千葉県北東部」のような細分区域名。
  - 同じ期間の群馬県に震度1以上を含む各地の震度に関する情報は44件。前橋市の観測点(前橋市昭和町・大手町・堀越町・粕川町・富士見町・鼻毛石町)を含むものは21件で、最大は震度2(20)。震度5強以上は無い。
  - 警報と、前橋市の観測点を含む地震情報の両方がある地震: 2023/05/05 14:42、石川県能登地方(警報`20230505144206`、前橋市最大震度2)、2023/05/05 21:58、石川県能登地方(警報`20230505215718`・`20230505215807`、前橋市震度1)、2023/05/11 04:16、千葉県南部(警報`20230511041647`、前橋市震度1)、2023/05/26 19:03、千葉県東方沖(警報`20230526190331`、前橋市震度2)。
  - サンドボックスの551は同じ地震で`ScalePrompt`→`Destination`→`DetailScale`の順に、30秒おきに続けて流れる(1分半ほど)。
  - 本番の`/history`では555(各地域ピア数)が10分おき(毎時0・10・20…分の4秒前後)に必ず届き、その間にも不定期に届く。
- **Implications**: 試験モードではサンドボックスで段階1→段階2(2023/05/05等)と訓練表示まで確かめられる。段階3と取消はサンドボックスでは出ないため、保存したJSONを流す手段で確かめる。サンドボックスは`test`を持たないので、訓練の明示は試験モードで付ける。WSのIDは`_id`。読み取りは、保存したJSONや`/history`由来のfixturesとの両立のため`id ?? _id`とする。P2Pの半開き接続は555が10分おきに来ることを前提に、12分の無受信で切断と判定する。

### 別プロセスの`wrangler dev`からのDOのRPC
- **Context**: リレーからハブのDO `SignageHub`の`publish`を、ローカルで別プロセスの`wrangler dev`どうしで呼べるか。
- **Sources Consulted**: wrangler 4.105.0(lockfileの版)で実験。https://developers.cloudflare.com/workers/development-testing/multi-workers/
- **Findings**:
  - ハブ(`name = "aramakisai-signage-hub"`、DO binding `SIGNAGE_HUB`・`SignageHub`、`new_sqlite_classes`)と、`script_name = "aramakisai-signage-hub"`付きのbindingを持つcallerを、それぞれ別プロセスの`wrangler dev`で起動し、`stub.publish({quake:5})`が`{"ok":true,"got":{"quake":5}}`を返した。callerのログに`SIGNAGE_HUB (SignageHub, defined in aramakisai-signage-hub) Durable Object local [connected]`が出た。
  - 文書: 「You need to access a Durable Object namespace or Workflow from another Worker using script_name ...」「You can also run each Worker in separate dev commands, each with its own terminal and configuration.」
  - 呼び出す側のwrangler設定にはサイトと同じ`script_name`付きのDO bindingを書き、`migrations`は書かない。
  - ハブを先に`wrangler dev -c <ハブの設定> --port <A> --inspector-port <B>`で起動し、その後リレーを別プロセスで`--port <C> --inspector-port <D>`で起動する。ポートとinspector-portは重複させない。
- **Implications**: `make quake-dev`は`make signage-dev`の起動後に、重ならないポートで単体の`wrangler dev`を起動する。投入口でハブ経由の配信をローカルで確かめられる。

### `wrangler deploy --secrets-file`
- **Context**: リレーのデプロイでWorkersの秘密を渡す手段。
- **Sources Consulted**: wrangler 4.105.0の`--help`。https://developers.cloudflare.com/workers/configuration/secrets/
- **Findings**:
  - `--help`: 「Path to a file containing secrets to upload with the version (JSON or .env format). Applies additively with secrets from previous deployments - omitted secrets will not be deleted.」文書: 「You can upload secrets at the same time as your Worker code using the --secrets-file flag on wrangler deploy ... JSON or .env file」
  - ファイルにあるキーは追加・上書きされ、ファイルに無いキーは削除されない。秘密を削除するときは`wrangler secret bulk`でJSONの値を`null`にする。
- **Implications**: CIは秘密のファイルを作って`wrangler deploy --secrets-file`で出す。キーの削除はデプロイとは別に`wrangler secret bulk`で行う。

### WolfxのAPI(一次情報・実データ)
- **Context**: 冗長系としての緊急地震速報と地震情報の形、地震情報で前橋市の震度が取れるかを確認する。
- **Sources Consulted**: https://wolfx.jp/en/docs/websocket/ 、https://wolfx.jp/en/docs/open-api、`https://api.wolfx.jp/jma_eew.json`・`https://api.wolfx.jp/jma_eqlist.json`(2026-10-13取得)
- **Findings**:
  - WS: `wss://ws-api.wolfx.jp/jma_eew`(緊急地震速報)、`wss://ws-api.wolfx.jp/jma_eqlist`(地震情報)。メッセージは`type`を持つ。サーバーは接続直後と1分ごとに`{"type":"heartbeat", ...}`を送る。
  - `jma_eew`: `EventID`(14桁の文字列、例`20261013112730`)、`Serial`(数値)、`AnnouncedTime`・`OriginTime`(日本時間、`2026/10/13 11:28:11`形式)、`Hypocenter`、`Magnitude`と同じ値の`Magunitude`、`Depth`、`MaxIntensity`、`WarnArea[]`(`Chiiki`・`Shindo1`・`Shindo2`・`Time`・`Type`=`Forecast`|`Warning`・`Arrive`)、`isTraining`・`isAssumption`・`isWarn`・`isFinal`・`isCancel`。予報(`isWarn: false`)も流れる。
  - `jma_eqlist`: `No1`〜`No50`(新しい順)と`md5`。各要素は`Title`・`EventID`・`time`・`time_full`(発生時刻)・`location`・`magnitude`・`shindo`(最大震度の文字列)・`depth`・`info`。実データの`shindo`は`1`〜`4`と`不明`。5弱以上はドキュメント(https://wolfx.jp/en/docs/open-api)に「Maximum seismic intensity (with ± qualifiers)」とあり、Wolfxを使う第三者の実装の資料(https://github.com/TastyHeadphones/QuakeSignal/blob/main/docs/WOLFX_API.md)では`"5-"`・`"5+"`・`"6-"`・`"6+"`の形。
  - `jma_eqlist`の`EventID`は同じ地震の`jma_eew`の`EventID`と一致する(実データで`20261013112730`が両方に出現)。
  - P2Pの556の`issue.eventId`も同じ14桁の気象庁のEventID。
  - 規約(https://wolfx.jp/en/legal/terms): データを公式の警報として提示・提供することを禁止。再提供は個別のドキュメントやデータ元の規約が許す範囲。数値の接続制限は記載なし(合理的な制限を設けうる)。無保証。
  - 公式のサンドボックスは無い。
- **Implications**: Wolfxの地震情報では前橋市の震度が分からない。段階2への移行は「`EventID`が一致し、最大震度`shindo`が`1`〜`4`」のときだけWolfxで行い、それ以外(`5-`以上・`不明`・想定外の文字列)は段階を変えずP2Pの551を待つ。段階3はP2Pだけが決める。重複除去のキーは2系統共通で`EventID`+続報番号。

### 試験モードの要件
- **Context**: サンドボックスでは発表時刻が古く、群馬県の警報も無いため、通常の選別では何も表示されない。
- **Findings**: 上流の接続先が本番の配信元でない系統は試験モードとし、古い報の除外(1.6)と群馬県の絞り込み(1.8)を外し、すべての報を訓練報として扱う。本番の接続先では試験モードにしない。Wolfxは保存したJSONを流して確かめる。
- **Implications**: 試験モードは系統ごとに、設定された接続先URLが本番のURLの定数と一致するかで決める(設定値で試験モードを直接オンにする口を持たない)。保存したJSONを流す口は試験モードの系統として扱う。

### Discord Webhook(一次情報)
- **Context**: 実行委員用のチャンネルへの投稿・編集と、レート制限の扱いを確定する。
- **Sources Consulted**: https://docs.discord.com/developers/topics/rate-limits 、https://docs.discord.com/developers/resources/webhook(旧URL https://discord.com/developers/docs/topics/rate-limits 等からの転送先、2026-10-13取得)
- **Findings**:
  - Execute Webhook(`POST /webhooks/{webhook.id}/{webhook.token}`): `wait`(既定false)が真なら送信の確定を待って作成したメッセージを返し、偽なら`204 No Content`(保存されなくてもエラーにならない)。`content`は2000文字まで。`allowed_mentions`で受信した文字列による予期しないメンションを防げる。
  - Edit Webhook Message: `PATCH /webhooks/{webhook.id}/{webhook.token}/messages/{message.id}`。`content`・`embeds`・`allowed_mentions`等を編集でき、メッセージを返す。`content`は2000文字まで。取得は`GET`の同じパス。
  - レート制限: 超過すると429とJSONの本文。`retry_after`は待つ秒数(小数)、`Retry-After`ヘッダも返る(例は`65`と`64.57`)。`X-RateLimit-Limit`・`Remaining`・`Reset`(epoch秒)・`Reset-After`(秒)・`Bucket`、429のときだけ`X-RateLimit-Global`・`X-RateLimit-Scope`(`user`・`global`・`shared`)。`shared`の429は無効な要求の数に入らない。
  - Webhookは経路ごとの制限の最上位の資源(`webhook_id`または`webhook_id + webhook_token`)。経路ごとの具体的な上限の数は示されず、ヘッダに従うよう求めている。全体の上限はbotで毎秒50件(認証ヘッダが無ければIP単位)とあるが、Webhookへの適用は明記されていない。
  - 401・403・429は無効な要求で、10分に10,000件を超えるとIPごと一時的に制限される。404を返したWebhookは以後使わないよう求めている。
- **Implications**: 投稿は`?wait=true`でメッセージIDを得て、P2P地震情報の内容への置き換えは同じメッセージの`PATCH`で行う。1件ずつ順に送り、`X-RateLimit-Remaining`が0なら`Reset-After`だけ待ち、429は`retry_after`に従う。404・401・403を受けたら再起動まで送らない。Workersの送信元IPは共有のため、無効な要求を重ねない。

### Cloudflare Durable Objectsの制約
- **Context**: 上流の常時接続をDOに置くときの課金・寿命・再起動。
- **Sources Consulted**: https://developers.cloudflare.com/durable-objects/platform/pricing/ 、https://developers.cloudflare.com/durable-objects/best-practices/websockets/ 、https://developers.cloudflare.com/workers/examples/websockets/
- **Findings**:
  - 課金は128MB固定・実時間。Free 13,000 GB-s/日(超過でエラー)、Paid月40万GB-s込み・超過$12.50/100万GB-s。FreeはSQLite backedのDOのみ。
  - Hibernationはサーバー側のWebSocketだけ。外向きのWebSocketはHibernationされず、開いている外向きの接続はDOの退避を最大15分防ぎ、その後もI/Oで延びる。alarm・`setTimeout`・受信中のリクエストもHibernationを妨げる。
  - デプロイで全DOが再起動し、全WebSocketが切れる。alarmはストレージに残り、再起動後に発火する。
  - 外向きのWebSocketは`fetch(url, { headers: { Upgrade: 'websocket' } })`の応答の`webSocket`を`accept()`して使う。
  - 常時起動の上流接続のDOは1日約10,800 GB-s(128MB×86,400秒)。
- **Implications**: 上流接続のDOはalarmを30秒ごとに張り続けて退避を防ぎ、同じalarmで無受信の監視と再接続を行う。期間外はalarmを消し、外向きの接続を閉じて退避させる。デプロイ後は残ったalarmで30秒以内に再接続する。

### 稼働期間(WBS)
- **Context**: Paidの期間と切り替えの時刻。
- **Sources Consulted**: WBS(GitHub Projects #1)「Cloudflare Workers を Paid に切り替える (開催期間のみ)」
- **Findings**: アップグレードは2026-10-23 JST 9:00以降に手作業。請求期間の末(11/22頃)にFreeへ戻る。上流接続とハブで合計1日約21,600 GB-sになり、Freeの日次上限を超える。Freeの日次上限はUTCの日単位。
- **Implications**: 稼働期間を`2026-10-23T09:00:00+09:00`から`2026-11-22T00:00:00+09:00`(終端を含まない)とする。開始時刻はアップグレードの作業可能時刻に揃え、UTCの日の始まり(9:00 JST)からなので、アップグレードが当日中に遅れてもその日の消費はFreeの上限内(上流接続とハブで1時間約900 GB-s)に収まる。終端はFreeへの戻りの前日の終わり。

### 法令とガイドライン
- **Context**: 表示内容の制約。
- **Sources Consulted**: 気象庁の予報業務許可のQ&A(https://www.jma.go.jp/jma/kishou/minkan/q_a_s.html)、気象庁の緊急地震速報の利活用ガイドライン(https://www.jma.go.jp/jma/kishou/know/jishin/eew/katsuyou/guideline/guideline.pdf)、群馬大学の安否確認の基準(https://www.gunma-u.ac.jp/studentlife/stu010/g173175)
- **Findings**: 受信した値をそのまま転送・表示する限り予報業務許可は不要。ガイドラインは予想震度・猶予秒数を報知しない、続報で表示を変えない、揺れの後に観測震度で警戒の解除を知らせることを推奨。閾値は前橋市の実測震度5強。
- **Implications**: 予想震度・到達予想時刻は端末へ送らない(payloadに持たせない)。震度・震源・発生時刻は受信した文字列・コードを表示用の名前に置き換えるだけで、計算しない。

### 既存コードの統合点
- **Context**: ハブ・端末・CMSのどこに足すか。
- **Sources Consulted**: `frontend/workers/signage-hub/{index.ts,hub-core.ts,wrangler.toml}`、`frontend/workers/site-entry.ts`、`frontend/wrangler.toml`、`frontend/src/lib/{signage-channel.ts,use-signage-channel.ts,signage.ts,signage-data.ts,signage-pin.ts}`、`frontend/src/components/signage/*`、`cms/src/collections/{signage-slides.ts,signage-groups.ts}`、`cms/src/globals/signage-settings.ts`、`cms/src/lib/{signage-visibility.ts,signage-notify.ts,signage-pin-release.ts}`、`cms/src/access/payload-access.ts`、`cms/src/components/SignagePin*.tsx`、`scripts/dev.sh`、`.github/workflows/frontend-ci.yml`、`docs/cms-operations.md`
- **Findings**:
  - ハブの`publish(input: Exclude<SignagePublishInput, { feature: 'pin' | 'snapshot' }>)`はRPCで、`applyPublish`が機能ごとの最新を保持に入れ、接続直後に期限内の保持を全部送る。`SignageFeaturePayloads`にキーを足すだけでハブの実行時のコードは変わらない。
  - 端末の`parseServerMessage`は未知の機能のbroadcastもそのまま`latest`に入れ、`useSignageFeature`で読む。旧版の画面は`quake`を読まないので通常の表示は変わらない(8.6)。
  - ハブは`workers_dev = false`で、サイトのWorkerからDO binding(`script_name = "aramakisai-signage-hub"`)でしか呼べない。ハブの固定名は`signage-hub`。
  - 本番のデプロイは`deploy-prod`でハブを`wrangler deploy`してからサイトを出す。Workersの秘密は`--secrets-file`でInfisical prodから渡す。
  - `make signage-dev`はサイトとハブを1つの`wrangler dev`(複数の`-c`)で起動し、2つ目以降の設定はHTTPを受けない。
  - スナップショット(`/api/signage`)は未認証でCMSを読む。未認証の`signage_slides`の読み取りは`enabled`かつ`visibleSlideFilter`(表示中のグループ、「すべて」が表示中なら全有効スライド)に絞られる。`withPin`は`visibleSlideIds`でスナップショットのスライドを絞るだけで、足さない。
  - `signage_groups`は未認証でも全件読める。「すべて」は`is_all`(マイグレーションで作った1件、APIから付け外し不可、削除不可)で表す。
  - CMSからサイトへの通知は`SIGNAGE_NOTIFY_URL`(CMSのDeploymentのenv)とAccessのService Token(Infisical prod→ExternalSecret→`cms-secrets`)。URLはInfisicalに無いため、ローカルのCMSでは通知が無効になる。
  - スライドの描画は1536×864の枠(`.signage-main`)が前提で、縦長では0.671875倍に縮める。
- **Implications**: 速報の型を`SignageFeaturePayloads`に足すだけでハブ・端末の配信は成り立つ。緊急地震速報のグループは`is_all`と同じ方式(マイグレーションで作る1件・不変のフラグ)で表す。未認証の読み取りに緊急地震速報のスライドを通し、スナップショットの側で巡回の一覧から外す。CMSの接続先URLも通知と同じ置き場所にし、ローカルで本番のリレーを叩かない。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. ハブのWorker内に別クラス | `aramakisai-signage-hub`に上流接続のDOクラスを足す | Worker・デプロイが1つで済む | ハブは公開URLを持たず、CMSからの解除の口がサイトの入口(変更禁止)経由になる。ハブの公開範囲を広げることになる | 不採用 |
| B. 別Worker(採用) | `aramakisai-signage-quake`に上流接続のDOとCMS向けのHTTP口を置き、ハブへはDO bindingのRPCで`publish` | ハブ・サイトの入口・bindingを変えない。秘密と公開URLを上流接続側に閉じ込められる。稼働期間外にWorkerごと止めやすい | Workerとデプロイ手順が1つ増える。ローカルではハブとリレーを別の`wrangler dev`で起動する | 採用 |
| C. CMS(K8s)で上流に接続 | Node常駐で上流を受ける | 実時間課金なし | CMSのPodの再起動・複数レプリカで接続数・重複が崩れる。CMSからハブへの経路が無い(サイトの入口の`notify`は`pin`/`snapshot`のみ) | 不採用 |

## Design Decisions

### Decision: 上流接続のDOを別Workerに置く
- **Context**: 8.2・8.3・8.5。CMSから解除を伝える口が要る。
- **Alternatives Considered**: 上の表のA・C。
- **Selected Approach**: `frontend/workers/signage-quake/`に`aramakisai-signage-quake`(workers.devのURLを持つ、PRプレビューURLなし)。DOクラス`QuakeRelay`(SQLite backed)を固定名の1インスタンスで持ち、ハブへは`script_name = "aramakisai-signage-hub"`のDO bindingで`publish`をRPCで呼ぶ。HTTPの口は共有秘密のBearerで守る。
- **Rationale**: 変更禁止の範囲に触れずに済み、公開の口を新しいWorkerに限定できる。
- **Trade-offs**: 本番デプロイのたびに上流が最大30秒切れる(DOクラスを含むWorkerは`wrangler deploy`しか使えず、デプロイで再起動する)。
- **Follow-up**: Cron Triggerの数とworkers.devの有効化を本番のアカウントで確認する。

### Decision: 共有秘密のBearerでCMSからリレーを呼ぶ
- **Context**: 6.4・6.8・9.5。
- **Alternatives Considered**: 1. Cloudflare AccessのService Token(通知と同じ) 2. 共有秘密のBearer
- **Selected Approach**: `SIGNAGE_QUAKE_TOKEN`(Infisical prod)をリレーのWorkersの秘密とCMSの`cms-secrets`の両方に入れ、リレーは`Authorization: Bearer`を定数時間で比較する。CMSの管理画面からは直接呼ばず、CMSのカスタムエンドポイントが実行委員の認証を確かめてから中継する。
- **Rationale**: workers.devにAccessを掛けるにはinfra側のTerraformの追加が要る。Bearerならリレーのコードだけで閉じる。
- **Trade-offs**: 秘密の更新は2か所(リレーのデプロイ時のsecrets-fileとCMSのSecret)。

### Decision: 稼働期間の自動開始・停止はCron Triggerとalarm
- **Context**: 10.1〜10.3・10.6・9.3。
- **Selected Approach**: 期間はリレーの`wrangler.toml`の`[vars]`(`QUAKE_ACTIVE_FROM`・`QUAKE_ACTIVE_UNTIL`)。Cron Trigger(5分ごと)はWorkerの中で期間を判定し、期間内のときだけDOの`ensure()`を呼ぶ。DOは期間内なら接続し30秒ごとのalarmを張る。alarmで期間外と判定したら接続を閉じ、alarmを消す。
- **Rationale**: 期間外にDOを起こさない(Cronの判定はWorker側で済む)。開始はCronで最大5分遅れ、デプロイ後の再接続は残ったalarmで30秒以内。
- **Trade-offs**: Cronの実行回数は月約8,600回(Workersのリクエストに含まれる)。

### Decision: 緊急地震速報用のグループと段階→スライドの対応付けを`signage_groups`に持たせる
- **Context**: 7.1〜7.4。
- **Alternatives Considered**: 1. `signage_settings`に4つの対応付けを足す、2. 新しいグローバル、3. `signage_groups`の緊急地震速報のグループの文書に対応付けを持たせる
- **Selected Approach**: 3。`is_quake`(マイグレーションで作る1件だけが持つ不変のフラグ)と、そのグループの編集画面だけに出る`quake_slides`(段階1・段階2・段階3・取消のスライドへの参照、選択肢はそのグループのスライド)。
- **Rationale**: 運用者はグループの編集画面でスライドの所属と対応付けを一度に扱える。「すべて」と同じ不変フラグの方式で既存の仕組みに揃う。
- **Trade-offs**: `signage_groups`の列が増える(追加のみで破壊的変更なし)。

### Decision: 緊急地震速報のスライドは巡回・固定から外し、未認証の読み取りには通す
- **Context**: 7.3・7.4、`getPinState`の変更禁止。
- **Selected Approach**: CMSの`visibleSlideIds`は緊急地震速報のグループのスライドを常に除く(固定の選択肢・自動の固定解除もこれに従う)。未認証の`signage_slides`の読み取りは「表示対象」か「緊急地震速報のグループの所属」のどちらかに通す。サイトのスナップショットは緊急地震速報のグループを読み、その所属のスライドを`slides`から除いて`quakeSlides`へ分ける。
- **Rationale**: `withPin`は`visibleSlideIds`で絞るだけでスライドを足さないため、`/api/signage/pin`の`visibleSlideIds`に緊急地震速報のスライドが混ざっても巡回には出ない。`getPinState`と`withPin`のコードは変えずに済む。
- **Trade-offs**: 通常のグループと緊急地震速報のグループの両方に属するスライドは巡回に出ない(緊急地震速報の所属を優先)。

### Decision: 段階の判定に使う地震情報
- **Context**: 3.1〜3.8。Wolfxの地震情報は前橋市の震度を持たない。
- **Selected Approach**: P2Pの551は`isArea === false`の観測点を1つ以上持つものだけを使い、前橋市の観測点の最大の`scale`が50以上で段階3、46を含み50以上が無ければ段階を変えない、それ以外(前橋市が載らない場合を含む)は段階2。Wolfxの`jma_eqlist`は`No1`の`EventID`が表示中の地震と一致し`shindo`が`1`〜`4`のときだけ段階2へ進める。551と警報の対応は、警報の`originTime`と551の`earthquake.time`の差が2分以内。
- **Rationale**: 受信した値の比較だけで決め、5強以上の可能性が残る値では「揺れは収まりました」を出さない。
- **Trade-offs**: P2Pが止まっていて最大震度が5弱以上・不明のとき、段階1のまま手動の解除を待つ(3.12)。段階3はP2Pの551が無いと出ない(3.10)。受信状態はCMSとDiscord(12.6)で実行委員に知らせる。

### Decision: 取消報は段階1・段階2でだけ取消の表示にする
- **Context**: 4.1。段階3(前橋市で5強以上を観測済み)の後に取消を出すと、避難の案内を消してしまう。
- **Selected Approach**: 段階3を表示中の取消報は無視して段階3を保つ(4.6)。取消の表示にするのは段階1・段階2だけ(4.1)。
- **Trade-offs**: 警報の取消は発表から数十秒以内に出るのが通常で、段階3の後に届くことは実際上無い。

### Decision: 保存したJSONを流す口
- **Context**: 11.3・11.5〜11.7(Wolfxに公式のサンドボックスが無い)。
- **Alternatives Considered**: 1. ローカルのWebSocketサーバーで再生する(Nodeに標準のWSサーバーが無く、依存の追加か別Workerが要る) 2. リレーに開発時だけ有効な投入口を設ける
- **Selected Approach**: 2。`QUAKE_DEV_INJECT = "1"`のときだけ有効な`POST /dev/inject/{channel}`に保存したJSONを送ると、その系統の受信と同じ処理(解釈・選別・段階の判定・publish)に流す。投入した報は試験モードの系統の報として扱う。`frontend/scripts/quake-inject.ts`で`fixtures/`のJSONを順に送る。
- **Rationale**: 依存を増やさず、受信後の処理を本物と同じ経路で通せる。
- **Trade-offs**: WebSocketの接続・heartbeatの処理は投入口では通らない(サンドボックスへの接続とWolfxの本番への接続で確かめる)。

### Decision: 実行委員用のDiscord通知はリレーが送る
- **Context**: 12.1〜12.17。サイネージより詳しい受信値と情報源を実行委員に届ける。
- **Alternatives Considered**: 1. CMSがリレーの状態を読んで投稿する 2. リレーが報を選別した時点で投稿する
- **Selected Approach**: 2。何を投稿・編集するかは`relay-core.ts`の純粋関数が`notices`として返し、文面と送信の待ち行列は`discord.ts`に置く。publishの後に待ち行列へ渡し、表示を待たせない。WebhookのURLはリレーのWorkersの秘密(`DISCORD_QUAKE_WEBHOOK_URL`、Infisical prod)。
- **Rationale**: 報の中身(予想震度・地域ごとの到達予想時刻)はリレーだけが持ち、payloadには載せない(2.3)。CMS経由にすると報の中身をCMSへ渡す口が増える。
- **Trade-offs**: 待ち行列はメモリだけで、DOの再起動で未送信の通知を失う(12.13の限定的な再試行)。解除した実行委員はCMSのユーザーのメールアドレスで示す(`users`に名前のフィールドが無い)。

### Decision: 情報源の優先(P2P地震情報を優先)
- **Context**: 13.1〜13.8。P2P地震情報の方が粒度が細かい(地域ごとの到達予想時刻のコード、観測点ごとの震度)が、Wolfxの方が先に届くことがある。
- **Selected Approach**: 地震ごとに最も新しい報の記録(続報番号・取消か・情報源・Discordのメッセージ)を持ち、`eewPrecedence`で`new`・`replace`・`drop`を決める。順位は(続報番号, 取消か)。同じ順位でWolfx→P2Pだけ`replace`し、サイネージは帯の情報源だけ、Discordは先の投稿の編集で置き換える。地震情報は表示中の`observation`がP2P由来ならWolfxの地震情報を捨てる。
- **Rationale**: 先に届いた報で表示の速さを保ち、後からより詳しい内容に揃えられる。地震ごとに1件の記録で、重複除去と置き換えとメッセージIDの保持を兼ねる。
- **Trade-offs**: Discordの編集は先の投稿の成功(メッセージID)が前提。投稿に失敗していたら編集の代わりに投稿する。

### Decision: リレーのデプロイはリレーのパスの変更があるときだけ
- **Context**: リレーのデプロイで上流が最大30秒切れる。`frontend/**`の変更のたびにデプロイすると、開催期間中にサイトの修正だけで受信が途切れる。
- **Selected Approach**: `deploy-prod`で`git diff`の対象を`frontend/workers/signage-quake/`・`frontend/src/lib/signage-quake.ts`・`frontend/src/lib/signage-channel.ts`に絞り、変更があるときだけリレーを出す。開催期間中はリレーのパスを変えるPRをマージしない運用を`docs/cms-operations.md`に書く。
- **Rationale**: 新しいActionの依存を足さずに、リレーが読むコードの変更だけでデプロイできる。
- **Trade-offs**: `frontend/package.json`・lockfileだけの変更(wranglerの版の更新等)ではリレーを出さない。必要なら同じPRでリレーのパスにも変更を入れる。

### Decision: オーバーレイの見た目はFigmaで確定する
- **Context**: 5.1・5.5・7.5。帯の項目(段階・訓練・受信値・情報源・公式でない旨)と段階のスライドの枠を横長・縦長で読める形に収める。
- **Selected Approach**: tasksの生成の前に、Figmaで横長(1920×1080)・縦長(1080×1920)の2フレームを作って見た目を確定する。designの配置の値はそれまでの前提。

## Risks & Mitigations
- P2Pの本番WSのIDは`_id`(`/history`は`id`) — `id ?? _id`で読む。重複除去はIDに依存しない(`eventId`+`serial`)。
- Wolfxの`shindo`の5弱以上の表記は公式に値の列挙が無く第三者の資料による — 判定は`1`〜`4`の完全一致だけで行うため、表記が異なっても段階2へ誤って進むことはない。
- 外向きのWebSocketは半開きを検知する手段がアプリ層の受信だけ — P2Pは12分、Wolfxは3分の無受信で切断・再接続する。
- ローカルでは別プロセスの`wrangler dev`からハブのDOをRPCで呼べる(`script_name`付きのbinding、ハブを先に起動、ポートとinspector-portを重複させない)。
- 本番のデプロイで上流が最大30秒切れる — リレーのパスの変更があるときだけデプロイし、開催期間中はリレーの変更をマージしない運用で補う。
- DiscordのWebhookの経路ごとの上限の数が文書に無い — 応答のヘッダ(`X-RateLimit-Remaining`・`Reset-After`・`retry_after`)に従い、1件ずつ送る。
- Webhookの削除・作り直しで投稿が止まる — 404で`disabled`にし、CMSの管理画面に「Discord通知: 停止中」を出す。Infisicalの値を替えてリレーを出し直す。
- Free期間に上流接続が残るとサイネージの配信経路ごと止まる — 期間はコードで固定、Cronは期間外にDOを呼ばない、alarmは期間外で自らを消す。12月の確認はWBSの手順4に含める。

## References
- [P2P地震情報API仕様v2](https://www.p2pquake.net/swagger-ui/specification.yaml) — 551・556のスキーマ、制限、サンドボックス
- [P2P地震情報 二次利用](https://www.p2pquake.net/secondary_use/) — 商用・非商用の利用可、無保証
- [Wolfx WebSocket API](https://wolfx.jp/en/docs/websocket/) — エンドポイント、heartbeat
- [Wolfx Open API](https://wolfx.jp/en/docs/open-api) — `jma_eew`・`jma_eqlist`のフィールド
- [Wolfx利用規約](https://wolfx.jp/en/legal/terms) — 公式の警報としての提示の禁止
- [Discord Rate Limits](https://docs.discord.com/developers/topics/rate-limits) — 429・`retry_after`・`X-RateLimit-*`、無効な要求の上限
- [Discord Webhook](https://docs.discord.com/developers/resources/webhook) — 投稿の`wait`、メッセージの編集
- [Durable Objects料金](https://developers.cloudflare.com/durable-objects/platform/pricing/) — 実時間課金、Freeの日次上限
- [Durable Objects WebSocket](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) — 外向きの接続はHibernationしない、デプロイで切れる
- [Workers WebSocket](https://developers.cloudflare.com/workers/examples/websockets/) — 外向きの接続の張り方
- [気象庁 予報業務許可のQ&A](https://www.jma.go.jp/jma/kishou/minkan/q_a_s.html) — 転送表示は許可不要
- [気象庁 緊急地震速報の利活用ガイドライン](https://www.jma.go.jp/jma/kishou/know/jishin/eew/katsuyou/guideline/guideline.pdf) — 予想震度・猶予秒数を報知しない、続報で表示を変えない
- [群馬大学 安否確認](https://www.gunma-u.ac.jp/studentlife/stu010/g173175) — 前橋市の震度5強の基準
