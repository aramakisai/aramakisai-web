# Research & Design Decisions

## Summary
- **Feature**: `parking-camera-endpoint`
- **Discovery Scope**: Complex Integration(既存のPayload CMSへの受信口・ジョブ・コレクション追加と、外部の生成AI APIの組み込み)
- **Key Findings**:
  - 本番のCMSはWeb用Pod6台と、ジョブを1台だけで実行する`cms-worker`に分かれている。判定をPayloadのジョブに載せると、Gemini APIの呼び出しは常に1プロセスに集まり、1分あたり・1日あたりの上限を共有状態なしに数えられる。
  - Gemini API上のGemma 4はHTTP 500を高頻度で返すが、呼び直しで通ることが多い。モデルごとに数回呼び直し、だめなら次のモデルへ移る。
  - S3プラグインのファイル配信(`/api/<collection>/file/<filename>`)は読み取りのaccessが返すWhere条件を評価する。公開判定はコレクションのaccessだけで決まり、配信経路を別に作らなくてよい。

## Research Log

### 既存の駐車場まわりとCMSの構成
- **Context**: 受信処理を既存の仕組みにどう載せるか。
- **Sources Consulted**: `cms/src/collections/parking-lots.ts`、`parking-statuses.ts`、`cms/src/access/policy.ts`、`cms/src/payload.config.ts`、`cms/src/lib/jobs-autorun.ts`、`cms/src/lib/signage-notify.ts`、`cms/src/endpoints/signage-quake.ts`、`aramakisai-infra/gitops/manifests/prod/cms/deployment.yaml`、`worker-deployment.yaml`、`cms-secrets/external-secret.yaml`
- **Findings**:
  - `parking_statuses`は`parking_lots`のフックだけが作成・削除し(`HOOK_MANAGED`)、保存のたびに`signageNotifyHook`がサイネージへ通知する。
  - リレーション列の外部キーは`ON DELETE set null`で作られる(`parking_statuses_lot_id_parking_lots_id_fk`)。駐車場を消すと、参照している列はDBが自動でNULLにする。
  - ジョブは`jobs.tasks`に定義し、`autoRun`(10秒ごと)で`cms-worker`だけが実行する(Web用Podは`CMS_JOBS_AUTORUN=false`)。完了したジョブは既定で削除される(`deleteJobOnComplete: true`)。
  - 秘密値は本番では`cms-secrets`(ExternalSecretがInfisical`prod`から生成)を`envFrom`で読む。秘密でない値はDeploymentの`env`に直接書く。
- **Implications**: 判定はジョブにし、レート制御はワーカーのメモリ上で行う。Gemini APIのキーは`cms-secrets`にキーを1つ足す。

### メディア保存と配信
- **Sources Consulted**: `cms/src/collections/media.ts`、`@payloadcms/storage-s3@3.88.0`の`getFile.js`、`payload@3.88.0`の`uploads/checkFileAccess.js`、`aramakisai-infra/terraform/cloudflare_media_cache.tf`
- **Findings**:
  - S3プラグインは登録したコレクションごとにキー接頭辞を持てる。`media`は`payload-uploads`。
  - ファイル配信は読み取りaccessの戻り値(Where)と`filename`で文書を引き、見つからなければ拒否する。
  - Cache Ruleは`/api/media/`配下だけを対象にする。それ以外の`.jpg`はCloudflareの既定の拡張子ベースのキャッシュに載る。`upload.modifyResponseHeaders`で応答ヘッダーを変えられる。
  - `media`は派生サイズ`hero`(1920)・`card`(960)を作り、生成できないと警告を出す。1600幅の画像では毎回`hero`の警告が出る。
- **Implications**: 駐車場の画像は`media`に混ぜず、専用のアップロードコレクションにする。ファイル名を推測できない乱数にし、一度書いたファイルを書き換えない。

### Gemini API(実験で確定した事実)
- **Sources Consulted**: models一覧(`GET https://generativelanguage.googleapis.com/v1beta/models`)、実験スクリプト(`q2.py`・`schema.json`)、https://ai.google.dev/gemini-api/docs/rate-limits 、https://discuss.ai.google.dev/t/constant-500s-on-gemma-4/140940
- **Findings**:
  - モデルID: `gemma-4-26b-a4b-it`、`gemma-4-31b-it`、`gemini-3.1-flash-lite`(models一覧で確認)。
  - Gemma 4でも`systemInstruction`と`responseMimeType: application/json`+`responseSchema`が使える。1600x1200の画像は258トークン、判定1回は約340トークン。
  - 無料枠(モデルごと): Gemma 4 26B/31Bは30RPM・16K TPM・14,400RPD、Flash Liteは15RPM・250K TPM・500RPD。1日の上限は太平洋時間の0時に戻る。
  - Gemma 4はHTTP 500 INTERNALを約半数で返し、503(high demand)も出る。画像・スキーマ・systemInstructionの有無とは無関係で、呼び直しで通ることが多い。
  - 実際の駐車場の画像で26Bが9/9回満車を正解し、写り具合も4種すべて正解した。
- **Implications**: 呼び直し(同じモデルで3回まで)とモデル切り替えを判定処理に組み込む。1判定あたり平均約2回の呼び出しになると見込んでも、駐車場4箇所・監視時間8.5時間(1台1日103判定)で1日約824回で上限に遠い。

### 撮影端末(ESP32-CAM)側の前提
- **Sources Consulted**: 撮影端末側の要件(露出補正-2〜+2を受け取り次の撮影から使う、再起動時は既定値に戻る、範囲外は無視)
- **Findings**: 端末は受け取った補正値をそのまま次の撮影の設定値として使い、保存しない。CMSは端末が今どの補正値で撮っているかを知らない。
- **Implications**: 端末は撮影時の補正値をヘッダーで送り、CMSは「判定した画像を撮った補正値」を起点に次の値を決める。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|---|---|---|---|---|
| 受信Podで応答後に判定 | 受信したPodが応答を返したあと非同期にGeminiを呼ぶ | 画像をメモリから渡せる | Web用Pod6台でレートの共有状態が要る。Pod再起動で判定が消える | 不採用 |
| Payloadジョブで判定 | 受信は画像を保存してジョブを積むだけ。`cms-worker`が判定する | 既存の仕組み。呼び出しが1プロセスに集まりレートをメモリで数えられる | ワーカー停止中は判定が止まる | 採用 |

## Design Decisions

### Decision: 画像はジョブ入力にbase64で載せる
- **Alternatives Considered**:
  1. ワーカーがS3から読む — S3クライアントを直接使うか、公開URLを自分で取りに行く必要がある。ローカルのディスク保存とも分岐する
  2. ジョブ入力に載せる — 約300KBのJSONが`payload_jobs`に一時的に入る
- **Selected Approach**: 2。判定処理は失敗を例外にせず記録して終えるため、ジョブは完了後に削除され行は残らない。
- **Trade-offs**: 管理画面のジョブ一覧で入力が大きく見える。

### Decision: 露出補正は判定した画像の補正値を起点にした絶対値で返す
- **Alternatives Considered**:
  1. 増減(+1/-1)を返す — 応答を取りこぼすと端末とCMSの認識がずれる
  2. 絶対値を返す — 端末の再起動や応答の取りこぼしがあっても同じ判定から同じ値になる
- **Selected Approach**: 2。`次の値 = 判定した画像の補正値 + (too_dark: +1、too_bright: -1、それ以外: 0)`を-2〜+2に収める。
- **Trade-offs**: 境目の明るさでは0と+1の間を行き来しうる。

### Decision: トークンはSHA-256のハッシュだけを保存する
- **Selected Approach**: 32バイトの乱数をbase64urlにした値を発行し、SHA-256(hex)だけを一意列に保存する。値は発行時に1度だけ画面に出す。
- **Rationale**: 推測できない長さの乱数なので、ソルトや低速ハッシュは不要で、ハッシュで直接引ける。

## Risks & Mitigations
- Gemma 4の500が続く — 3モデルへの切り替えで補い、すべて失敗しても状態を変えず次の画像で再判定する。
- ワーカー再起動で1日の回数がリセットされる — 上限超過の429を受けたらそのモデルを60秒休ませる。
- 受信時刻の差で判定を間引くと、端末の送信間隔が5分ちょうどのとき受信時刻のゆらぎで半分ほどが見送られる — 端末がSNTPで5分境界に揃えて撮影し、撮影時刻(`X-Captured-At`)の5分枠ごとに1回判定する。端末の時刻が狂った画像は400で拒否する。
- Cloudflareの前段が非ブラウザの送信を遮る — 現行のterraformにBot対策の設定は無い。設置前の結合確認で実機から送って確かめる。

## References
- https://ai.google.dev/gemini-api/docs/rate-limits — 無料枠の上限と日次のリセット時刻
- https://ai.google.dev/gemini-api/docs/structured-output — `responseSchema`
- https://discuss.ai.google.dev/t/constant-500s-on-gemma-4/140940 — Gemma 4の500の既知の問題
- https://payloadcms.com/docs/jobs-queue/overview — Payloadのジョブ
