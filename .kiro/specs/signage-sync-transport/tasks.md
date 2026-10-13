# Implementation Plan

2つのリポジトリにまたがる。各タスクの題名の先頭に、作業するリポジトリ(`aramakisai-web`・`aramakisai-infra`)を書く。

デプロイは2段階で行う。段1でハブのWorker(`aramakisai-signage-hub`)だけをmainまで出し(タスク5)、ハブが本番で動いてから、段2でサイトのWorkerの入口・端末の切替・CMSの通知を出す(タスク6〜9)。PRはdevへ出し、devからmainへ上げる。運用ダッシュボード(タスク3)は段1・段2と独立に出せるが、Workersの有料プランの開始(2026-10-23)より前に本番へ出す。

CMSのコレクション・グローバルの定義は、`afterChange`・`afterDelete`のフックを足すだけで項目を変えない。マイグレーション(`pnpm migrate:create`)と型の再生成(`pnpm generate:types`)は不要。

開発サーバーは`make dev`・`make cms`・`make signage-dev`(タスク9.1で追加)経由でだけ起動し、`pnpm dev`や`wrangler dev`を直接実行しない。Claudeが起動するときは`run_in_background`を使い、他のセッションや人間が立てたサーバーを止めない。端末の挙動を変えるコード(タスク6〜8)のコミットは、タスク9.2の実ブラウザでの確認の後に行う。実ブラウザでの確認の後は必ずブラウザを閉じ、判断に使ったスクリーンショットのパスを揃える。

- [x] 1. aramakisai-web: 設計の前提を実測する
- [x] 1.1 最小のハブで、`script_name`だけのDOのbindingを持つサイトのWorkerにPRプレビューのURLが出るかを確かめる
  - 受け入れたWebSocketに`ping`が来たら`pong`を返すだけの最小のハブを、`aramakisai-signage-hub`の名前・`new_sqlite_classes = ["SignageHub"]`のmigration・`workers_dev = false`・`preview_urls = false`で、Infisical経由の資格情報を使って`wrangler deploy`する
  - マージしない検証用のブランチで、サイトのWorkerに`script_name = "aramakisai-signage-hub"`だけのDOのbindingと、`/api/signage/ws`だけをハブへ渡す最小の入口を足し、devへのPRを作る
  - PRのCIで`wrangler versions upload`がバージョンのURLを出し、既存のe2eがそのURLで通ることを確かめる
  - PRプレビューのURLが出てe2eが通ったことを記録している。出なかった場合は、design.mdとresearch.mdを先に直してユーザーの確認を得てから、以降のタスクを直す
  - _Requirements: 3.3, 7.3_

- [x] 1.2 Accessの背後でWebSocketのupgradeが通るかを確かめる
  - 1.1のPRプレビューのURLで、Accessにログインしたブラウザから`/api/signage/ws`へ接続し、DevToolsのNetworkで101になり`ping`に`pong`が返ること、ログインしていないブラウザでは接続できないことを確かめる
  - PRプレビューのURLで403になり通らない場合は、ホスト名単位のAccessで守られた`dev.aramakisai.com`へ同じ最小の入口を一時的に出して同じことを確かめ、測定後にdev環境の版を元に戻す
  - 本番のパス指定のAccess(`aramakisai.com/api/signage`配下)での確認は10.1で行う
  - ログイン済みで101、未ログインで拒否になったことを記録している。通らなかった場合は、design.mdを先に直してユーザーの確認を得てから、以降のタスクを直す
  - 測定が終わったら検証用のPRを閉じてブランチを消す。最小のハブはタスク5で同じ名前のまま置き換える
  - _Requirements: 5.2, 7.5_

- [x] 2. aramakisai-infra: 通知用のService TokenとCMSの環境変数
- [x] 2.1 (P) 通知専用のService Tokenとポリシーを足す
  - `terraform/access.tf`に、既存のE2E用(`e2e_ci`)と同じ形で通知用の`cloudflare_zero_trust_access_service_token`(`duration = "8760h"`・`min_days_for_renewal = 30`・`create_before_destroy`)と、サイネージのアプリケーション(`aramakisai_signage`)への`decision = "non_identity"`の独立したポリシーを足す。`terraform/outputs.tf`にトークンの`client_id`と`client_secret`(sensitive)を足す
  - 既存のドリフトがあるため、`terraform apply`は`-target`で今回のリソースだけに絞る
  - 出力の値をInfisical prodの`SIGNAGE_NOTIFY_ACCESS_CLIENT_ID`・`SIGNAGE_NOTIFY_ACCESS_CLIENT_SECRET`へ登録する
  - Cloudflareのダッシュボードでサイネージのアプリケーションに通知用のポリシーが付き、そのトークンのヘッダを付けた`/api/signage`への要求がAccessを通り、付けない要求がログイン画面へ回ることを確かめている
  - _Requirements: 1.1, 5.2_
  - _Boundary: terraform/access.tf, terraform/outputs.tf_

- [x] 2.2 CMSへ通知の環境変数を渡す
  - `gitops/manifests/prod/cms-secrets/external-secret.yaml`に`SIGNAGE_NOTIFY_ACCESS_CLIENT_ID`・`SIGNAGE_NOTIFY_ACCESS_CLIENT_SECRET`を足し、`gitops/manifests/prod/cms/`のDeploymentに秘密でない`SIGNAGE_NOTIFY_URL`(`https://aramakisai.com/api/signage/notify`)を足す
  - ArgoCDの同期後、`make kubectl`で`cms-secrets`のSecretに2つのキーがあることと、CMSのPodの環境変数に3つの値が入っていることを実測している(同期済みの表示だけで判断しない)
  - _Requirements: 1.1, 5.2_

- [ ] 3. aramakisai-infra: 運用ダッシュボードにCloudflareの利用量を足す
- [x] 3.1 (P) GraphQLのスキーマでフィールドの名前と単位を確かめる
  - 既存の`OPS_CLOUDFLARE_READ_TOKEN`でGraphQL Analytics APIのintrospectionを行い、`workersInvocationsAdaptive`の`sum.cpuTimeUs`、`durableObjectsInvocationsAdaptiveGroups`の`sum.requests`、`durableObjectsPeriodicGroups`の`sum.duration`(GB-s)と`sum.inboundWebsocketMsgCount`の名前・単位と、`durableObjectsPeriodicGroups`を絞れる日時の項目(`date`・`datetimeHour`等)を確かめる
  - hibernation中のWebSocketの受信が`durableObjectsInvocationsAdaptiveGroups`の`requests`に1件ずつ数えられているかを、1.1の最小のハブの実績で確かめる
  - 確かめた名前・単位・絞り込みの項目を記録している。designの名前と違う場合は、design.mdを先に直してから3.3に進む
  - _Requirements: 8.1_
  - _Boundary: CloudflareUsageCollector_

- [x] 3.2 Workersのプランの期間と上限を宣言する
  - `dashboard.toml`の`cloudflare_workers`の`[[plans]]`を、Free〜2026-10-22、Paid 2026-10-23〜2026-11-22、Free 2026-11-23〜に直す
  - `limits`に、Freeは`do_requests_day = 100_000`・`do_gbs_day = 13_000`、Paidは`cpu_ms_month = 30_000_000`・`do_requests_month = 1_000_000`・`do_gbs_month = 400_000`を足す
  - `[[credentials]]`に通知用のService Tokenの期限日を足す
  - collectorの設定の読み込みのテストが通り、`active_plan`が各期間で期待するプランを返す
  - _Depends: 2.1_
  - _Requirements: 8.1, 8.3_

- [x] 3.3 WorkersのCPU時間とDOの利用量を集計して表示する
  - `billing_cloudflare.py`の1回の問い合わせに、3.1で確かめた項目を足し、プランの`limits`にあるキーだけ`quota_item`を作る(`quota.workers_cpu_month`・`quota.do_requests_day`・`quota.do_requests_month`・`quota.do_gbs_day`・`quota.do_gbs_month`)
  - DOのリクエスト数は`requests`から`inboundWebsocketMsgCount`×19/20を差し引く。Freeの日次はUTCの0時から、Paidはプランの`from`の0時(UTC)から集計する(暦の月初にしない)。範囲が問い合わせの期間の上限を超える場合は日ごとに分けて足す
  - `labels.py`に5つの項目の表示名を足す
  - `test_billing.py`で、FreeとPaidの期間それぞれで出る項目と上限、Paidの集計の起点がプランの`from`であること、WebSocketの受信の換算分を差し引くこと、80%で警告・100%で超過になることのテストが通る
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 3.4 運用ダッシュボードを本番へ出して表示を確かめる
  - 2026-10-22までに本番へ出し、運用ダッシュボードの`billing.cloudflare`に、Workersのリクエスト数とDOのリクエスト数・GB-sが込み量または上限に対する割合とともに表示されることを確かめる
  - 2026-10-23以降に、プランがPaidに切り替わり、CPU時間と月の項目が表示されることを確かめる
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 4. aramakisai-web: 端末とハブと他機能が共有するメッセージの型と期限の判定を作る
  - 固定と表示対象(`serverNow`を除く)、スナップショットの版、機能名ごとのpayloadの型、他機能がハブへ渡す形、ハブが配る形(`sentAt`付き)、端末とハブのあいだの`ping`・`pong`、ping間隔とpongの待ち(各5秒)を定める
  - 補正済みの現在時刻で期限を判定する関数と、受信した文字列を`any`を経由せずに解釈する関数(サーバーからとクライアントから)を作る。未知の機能のbroadcastは捨てずに返す
  - 型のimport以外で`@/`の別モジュールに依存しない(ハブのWorkerからも読む)
  - 期限の判定(期限なし・境界)と、不正な入力・未知の機能の解釈の単体テストが通る
  - _Requirements: 1.4, 5.1, 7.2, 7.6_

- [x] 5. aramakisai-web: ハブのWorkerを作り、本番まで出す(段1)
- [x] 5.1 ハブの状態の遷移を純粋関数で作る
  - 通知の後のalarmの時刻(500ms後、既に早いalarmがあれば延ばさない)、alarmの後の次のalarm(通知の直後は5秒後の確かめを1回、その後は接続があれば60秒後の保険、接続が無ければ設定しない)、確かめで`snapshot`を含むなら版をもう一度進めることを決める
  - 固定と表示対象は取り直した値が保持と違うときだけ配る。版は保持より大きくなるように進め、単調増加にする
  - 他機能のメッセージで保持を機能ごとに置き換え、期限切れは保持から捨てて送らない。接続の直後に送る一覧を、期限内の保持から作る
  - 取り直しに失敗したら保持と保留を残し、次は60秒後まで取りに行かない
  - designのTesting Strategyに挙げた`hub-core`の単体テストが通る
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 3.1, 3.4, 6.1, 7.1, 7.2, 7.3, 7.6_

- [x] 5.2 ハブのDOとWorkerの設定を作る
  - 固定名の1インスタンスのDOで、WebSocketをHibernation APIで受け、`ping`だけに`pong`(その時点の時刻)を返し、他の受信は捨てる。`setTimeout`・`setInterval`を使わず、遅延はすべてalarmで行う
  - 接続の直後に期限内の保持を全部送り、固定と表示対象の保持が無ければすぐ取り直す。`notify`と`publish`(固定と版は受け付けない)をRPCとして公開し、保持と保留はストレージに変化時だけ書く
  - 取り直しはサイトのWorkerへのService bindingで`/api/signage/pin`を取得し、応答の形を検査する。失敗は`console.warn`だけ残す
  - Workerの設定に、DOのbindingとmigration、サイトのWorkerへのService binding、`workers_dev = false`・`preview_urls = false`を書く。Workersの型で検査する設定を置き、フロントの型チェックに含める
  - フロントの型チェック・テストが通り、`wrangler deploy --dry-run`でハブのWorkerがビルドできる
  - _Requirements: 1.5, 2.2, 2.4, 3.1, 3.3, 5.1, 7.1, 7.2, 7.3_

- [x] 5.3 本番のデプロイでハブをサイトより先に出す
  - `frontend-ci.yml`の`deploy-prod`で、サイトのデプロイの前にハブを`wrangler deploy`で出す。`deploy-dev`とPRプレビューではハブを出さない。必須のチェックのジョブ名を変える場合は`frontend-ci-dummy.yml`の名前も揃える
  - `frontend-ci-deploy.workflow.test.ts`で、`deploy-prod`がハブを先に出し、`deploy-dev`とPRプレビューがハブを出さないことのテストが通る
  - _Requirements: 7.1, 7.3_

- [x] 5.4 ハブを本番まで出す
  - ハブには実ブラウザで確かめる画面が無いので、単体テスト・型チェック・ビルドが通った後にコミットし、devへのPRを経てmainまで出す
  - 本番のデプロイの後、Cloudflareのダッシュボードで`aramakisai-signage-hub`に`SignageHub`のDOがあり、公開のURLを持たず、サイトのWorkerの表示とe2eに影響が無いことを確かめる
  - 9.2でハブの不具合が見つかった場合は、ハブを直して段2より先にこの手順で出し直す
  - _Requirements: 7.1, 7.3_

- [x] 6. aramakisai-web: サイトのWorkerの入口と版付きのスナップショット(段2)
- [x] 6.1 サイトのWorkerの入口で、配信経路だけをハブへ振り分ける
  - `/api/signage/ws`は、upgradeでなければ426、`Origin`がホストと違えば403を返し、それ以外はハブへそのまま渡して101を返す
  - `/api/signage/notify`はPOSTだけを受け(他は405)、本文の`targets`を検査して(不正なら400)ハブの`notify`を呼び204を返す。認証はAccessに任せる
  - 他のパスはOpenNextの生成したハンドラへそのまま渡し、OpenNextのDOのクラスは再exportしない。Workerの`main`を入口に向け、本番と`[env.dev]`にハブへのDOのbinding(`script_name`付き、サイト側にmigrationは書かない)を足す
  - designのTesting Strategyに挙げた`site-entry`の単体テストが通り、`pnpm build`が通る
  - _Depends: 5.4_
  - _Requirements: 1.1, 5.2, 7.5_

- [x] 6.2 (P) 版付きでスナップショットを取り直せるようにする
  - `GET /api/signage?v=<版>`を受け、版が正の整数なら全取得を通常のキーを読まず版付きの共有キーで行う(TTLは既存のスナップショットと同じ)。版の形が不正なら版なしとして扱う
  - 駐車場と協賛の取得にも版を渡す。版なしの通常の取得は既存のキーとTTLのまま
  - 版があるときは通常のキーを読まず版付きのキーで保存することの単体テスト(`cms.test.ts`・`signage-data.test.ts`)が通る
  - _Requirements: 6.1, 6.3_
  - _Boundary: SnapshotVersionFetch_

- [x] 7. aramakisai-web: 端末をポーリングから配信経路へ切り替える(段2)
- [x] 7.1 (P) 端末のWebSocketクライアントを作る
  - 同じホストの`/api/signage/ws`へ1本だけ接続し、開いた直後と5秒ごとに`ping`を送り、`pong`からRTT/2で補正した時刻のずれを更新する
  - `pong`が5秒以内に来なければ切断して接続し直す。再接続の待ちは1秒から倍々に最大30秒(±20%の乱数)、`pong`を1回受けたら1秒に戻し、`online`イベントでは待ちを打ち切る。画面が非表示になったら閉じ、表示に戻ったらすぐ接続する
  - 機能ごとに最後のbroadcastを保持し、期限切れは受信時と表示時に捨てる。切断中も最後の固定・表示対象・ずれ・版を返し続け、画面にエラーを出さない
  - 他機能の部品がpayloadを読むための、期限切れならundefinedを返す読み出しを用意する
  - designのTesting Strategyに挙げた`use-signage-channel`の単体テストが偽の`WebSocket`で通る
  - _Depends: 4_
  - _Requirements: 1.5, 2.1, 2.2, 2.4, 3.4, 4.1, 4.2, 4.3, 6.3, 7.4, 7.6_
  - _Boundary: SignageChannelClient_

- [x] 7.2 サイネージ画面を配信経路の固定・表示対象・時刻・版で動かす
  - 固定と表示対象を配信経路から受け取り、これまでどおり重ねる。時刻のずれは配信経路の値を優先し、無ければスナップショットの値、さらに無ければ表示開始時の値を使う
  - 版が手元と違えば0〜1,000msの乱数で待ってから`/api/signage?v=<版>`を取り直し、成功したらその版を手元の版にする。同じ版では取り直さない。初回の版は必ず取り直す
  - スナップショットのポーリングを20秒から2分にする
  - `/api/signage/pin`の3秒ごとのポーリング、`missingSlideIds`、`?fresh=1`と`fetchFreshSnapshot`、`REFRESH_MIN_GAP_MS`、取り直し用のキャッシュ時間の指定とその定数を削除する。`/api/signage/pin`のルートと`getPinState`は変えない(ハブと旧JSの端末が読む)
  - `signage-screen.test.tsx`で、版が変わったら乱数の待ちの後に`/api/signage?v=`を取り直し、同じ版では取り直さないことのテストが通り、フロントの型チェック・テスト・ビルドが通る
  - _Depends: 6.1, 6.2, 7.1_
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.3, 3.1, 3.2, 4.1, 6.1, 6.2, 6.3_

- [x] 8. aramakisai-web: CMSの保存時通知(段2)
- [x] 8.1 (P) CMSからサイトのWorkerへ通知を送る仕組みを作る
  - 通知のURLとService Tokenの2つの値が揃っているときだけ、Accessのヘッダと`targets`の本文でPOSTする。揃っていなければ何もせず、プロセスにつき1回だけ警告する
  - 送信は待たずにすぐ戻り、3秒でタイムアウトし、失敗はロガーに警告として残して例外を出さない
  - コレクション用(`afterChange`・`afterDelete`共用)とグローバル用のフックを作る
  - 設定が揃わなければ送らないこと、送るヘッダと本文、`fetch`の失敗で例外を出さないことの単体テストが通る
  - _Requirements: 1.1, 6.1_
  - _Boundary: SignageNotify_

- [x] 8.2 サイネージが参照するコレクションとグローバルに通知のフックを付ける
  - designの対象表のとおり、サイネージ設定(固定)・グループ(固定)・スライド(固定と版)・テロップ・落とし物・協賛・ステージ・出演枠・駐車場の状況・駐車場・祭のメタ情報(版)に付ける。既存のフック(固定の自動解除等)の後ろに足す
  - 項目は変えないので、マイグレーションと型の再生成は行わない。`cms-schema-check`が破壊的変更を検出しないことを確かめる
  - 実行委員の操作の手順と画面は変えない
  - CMSの型チェック・テスト・ビルドが通る
  - _Requirements: 1.1, 1.2, 1.3, 5.3, 6.1_

- [x] 8.3 (P) 通知の環境変数とService Tokenの更新の手順を書く
  - `docs/cms-operations.md`に、通知の3つの環境変数の置き場(Infisical prodと`cms-secrets`、CMSのDeployment)と、Service Tokenの更新の手順(期限の30日前以降の`terraform apply`で作り直されること、新しい値でInfisical prodを差し替え、ExternalSecretの同期を待ってCMSのDeploymentを再起動すること、`dashboard.toml`の期限日の更新、差し替えまでは60秒・2分のポーリングで反映が続くこと)を書く
  - 開催中(11/14〜15)はハブのWorkerをデプロイしないことを書く
  - 手順の文書が`docs/cms-operations.md`にある
  - _Depends: 2.1_
  - _Requirements: 5.2_
  - _Boundary: docs/cms-operations.md_

- [x] 9. aramakisai-web: ローカルでの結合の確認と、段2の本番への反映
- [x] 9.1 ハブとサイトをまとめて起動する`make signage-dev`を足す
  - サイトを`opennextjs-cloudflare build`した後、サイトとハブの2つの設定で`wrangler dev`を起動する。ポートは`make dev`と同じくworktree名から決め、`make dev-ps`・`make dev-stop`で扱えるようにする
  - `run_in_background`で`make signage-dev`を起動し、表示されたポートで`/signage`が開ける
  - _Requirements: 1.1, 6.1, 7.1_

- [x] 9.2 ローカルで端末の反映を実ブラウザで確かめてからコミットする
  - `make signage-dev`でブラウザの`/signage`を大きさの違う2枚で開き、`curl`で`/api/signage/notify`へ`pin`・`snapshot`を送って両方の表示が変わること、DevToolsでping/pongが5秒ごとに流れること、不正な本文で400が返ることを確かめる
  - 通知の環境変数をローカルの入口に向けたCMSを`make cms`で起動し、固定の選択・解除、グループの表示の切り替えと所属の変更・削除、スライドの無効化による固定の自動解除、テロップの保存のそれぞれで、両方の端末が数秒以内に同じ表示へ切り替わることを確かめる。既に他のセッションが共有のCMSを起動していて環境変数を与えられない場合は、ユーザーに確認せず`make cms-worktree`と`make dev CMS=worktree`で自分専用のCMSを立てて確かめる
  - DevToolsのオフラインと復帰、タブの非表示と表示で、切断中も直前の表示のまま続き、復帰から数秒以内に最新の状態に追いつくことを確かめる
  - 通知の環境変数を外したCMSで、固定は60秒以内、テロップは2分以内に反映されることを確かめる
  - ハブの不具合が見つかったら、直して5.4の手順で先に本番へ出し直す
  - 確認の後にコミットする。フロントとCMSの型チェック・テスト・ビルドが通り、自分で起動したサーバーを止め、ブラウザを閉じ、確認内容とスクリーンショットのパスが揃っている
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 4.1, 4.2, 4.3, 5.3, 6.1, 6.2, 7.4_

- [x] 9.3 サイトのWorkerと端末の切替を本番まで出す
  - devへのPRで、PRプレビューのURLが出て既存のe2eが通り、プレビューのサイトが本番のハブに繋がって`/signage`の表示が切り替わることを確かめる
  - devへマージし、`dev.aramakisai.com`で同じことを確かめてからmainまで出す
  - 本番で、旧JSのままの端末が`/api/signage/pin`のポーリングで動き続けていることを確かめる
  - _Depends: 2.2_
  - _Requirements: 1.1, 5.2, 7.5_

- [x] 9.4 CMSの通知を本番へ出し、全端末を切り替える
  - CMSの変更をdevへのPRを経てmainまで出し、`cms-ci`が作る`aramakisai-infra`のタグ更新のPRをマージして、ArgoCDの同期を待つ
  - 本番のCMSで保存したとき、CMSのログに通知の警告が出ず、ハブが取り直すことを確かめる
  - 全端末と配信PCを再読み込みして新しいJSにし、全端末が配信経路に繋がっていることを確かめる
  - _Requirements: 1.1, 1.3, 5.3, 6.1_

- [ ] 10. aramakisai-infra: 運用ダッシュボードのDOのリクエスト数をCloudflareの請求と見比べる
  - 本番のハブが使われた1日分について、運用ダッシュボードのDOのリクエスト数を、Cloudflareのダッシュボードの請求の使用量と見比べる
  - 合わない場合は、collectorでWebSocketの受信の換算をやめ、`requests`をそのまま出す形に直して出し直す
  - 見比べた結果を記録し、WBS(GitHub Projects #1)の進捗とtasks.mdのチェックを更新している
  - _Requirements: 8.1_

- [ ] 11. ハブのDOが休止できるように、ping/pongを自動応答に切り替える
- [x] 11.1 共有型とハブをテスト駆動で切り替える
  - 先に失敗するテストを書く: `SignageClientMessage`と`pong`の型・`parseClientMessage`を使わないこと、`parseServerMessage`が`pong`を`null`にすること、ハブのコンストラクタが`ping`→`pong`の自動応答を設定すること
  - `signage-channel.ts`の`ping`をリテラル文字列`'ping'`・`'pong'`の定数にし、`serverNow`付きの`pong`の型と`parseClientMessage`を消す。ハブは`ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))`をコンストラクタで設定し、`webSocketMessage`は届いたものを捨てる。`pin`の`serverNow`の扱いは変えない
  - ハブとサイトの型チェックとテストが通る
  - _Requirements: 2.2, 3.2, 7.4_

- [x] 11.2 端末のクライアントとサイネージ画面の時刻補正をテスト駆動でスナップショット由来に切り替える
  - 先に失敗するテストを書く: クライアントが文字列`ping`を送り、`pong`を5秒以内に受けなければ再接続すること、`offsetMs`を返さないこと。画面の時刻のずれが、ポーリングと版付きの取り直しで取ったスナップショットの`serverNow`から`clockOffsetMs`で更新され、取得に失敗したら直前のずれが保たれ、初回は表示開始時の値であること
  - `use-signage-channel.ts`から`offsetMs`とpongの`serverNow`の処理を除き、`signage-screen.tsx`のずれを`polled.offsetMs ?? mountOffsetMs`にする。接続直後のメッセージに時刻は足さない
  - フロントの型チェック・テスト・ビルドが通る
  - _Depends: 11.1_
  - _Requirements: 2.1, 2.2, 4.2, 7.4_

- [x] 11.3 ローカルで実ブラウザで確かめてからコミットする
  - `make signage-dev`でブラウザの`/signage`を開き、DevToolsでping/pongが5秒ごとに流れて再接続しないこと、端末の時計をずらしても時刻がスナップショットの`serverNow`で補正されること、`curl`の通知で表示が切り替わることを確かめる
  - 自分で起動したサーバーを止め、ブラウザを閉じ、確認内容とスクリーンショットのパスが揃ってから、コミットする
  - _Depends: 11.2_
  - _Requirements: 1.1, 2.1, 2.2, 4.2, 7.4_

- [x] 11.4 devへのPRから本番まで出す
  - devへのPRで既存のe2eとPRプレビューを確かめ、devへマージし、`dev.aramakisai.com`で確かめてからmainまで出す。deploy-prodはハブ→サイトの順のまま。旧形式との互換は持たず一度に切り替え、出した後に端末と配信PCを再読み込みする
  - _Depends: 11.3_
  - _Requirements: 2.2, 3.2, 5.2_

- [ ] 11.5 本番で端末を数時間つないでGB-sを見積もりと比べる
  - 本番で端末(`/signage`)を数時間つないだ状態にし、運用ダッシュボードの`quota.do_gbs_day`が、design.mdのPerformance & Scalabilityの見積もり(約3,200GB-s/日以下)の範囲に収まることを確かめる。常時稼働の約10,800GB-s/日に近ければ、休止できていないので原因を調べる
  - 自動応答の受信がDOの要求数に数えられるかも、DOの要求数の値から読み、結果をresearch.mdに記録する。WBS(GitHub Projects #1)の進捗とチェックを更新する
  - _Depends: 11.4_
  - _Requirements: 3.2, 8.1_
