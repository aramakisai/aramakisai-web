# Requirements Document

## Project Description (Input)
駐車場の空き状況を、人手の入力に頼らず自動で更新する。外部の撮影端末(カメラ)が駐車場を定期的に撮影してCMSへ画像を送り、CMSがカメラの割り当て先の駐車場について生成AIで混雑の度合いを判定して空き状況(`parking_statuses`)を更新し、公開ページ`/parking`に状態と最新の画像を出す。

### 現状
- Payload CMSに`parking_lots`(駐車場。項目は名称のみ)と`parking_statuses`(空き状況。駐車場ごとに1件で、`lot`と`status`: `available`/`crowded`/`full`を持つ)のコレクションがある。
- 空き状況の更新は、実行委員(`executive`ロール)が管理画面で手入力するだけで、外部から書き込む経路はない。`parking_statuses`の作成・削除は`parking_lots`のフックだけが行い、人による作成・削除はaccess control(`HOOK_MANAGED`)で禁じている。
- `parking_statuses`の保存時に`signageNotifyHook`がサイネージへ変更を通知する。
- 公開ページ`/parking`(駐車場空き情報)は`/api/parking`を20秒ごとにポーリングし、`/api/parking`はCMSからの取得に20秒のキャッシュを挟む。開催当日でないときは状態を出さない。更新から30分を過ぎた状態は古い情報として表示する。

### 前提
- 撮影端末(以下カメラ)は、駐車場1箇所につき1台を建物の4階に置き、監視時間(9:00〜17:30、日本時間、8.5時間)に撮影する。SNTPで時刻を合わせ、壁時計の5分境界(:00、:05、…)に揃えて1600x1200のJPEG(約220KB)を1枚撮り、撮影時刻とカメラごとに発行されたデバイス用トークンを付けてHTTPSでPOSTする。カメラは、どの駐車場を撮っているかを知らない。
- カメラはCMSに登録し、実行委員が管理画面でカメラを駐車場に割り当てる。1駐車場に割り当てられるカメラは1台まで。カメラの付け替えは管理画面の操作だけで済ませる。
- 4階からの撮影でナンバープレートや人の顔は判読できないため、画像は加工せずに公開してよい。
- 判定にはGemini APIの無料枠で提供されるGemma 4 26B(30RPM、16K TPM、14.4K RPD)を主に使う。Gemini API上のGemma 4はHTTP 500を高頻度で返す不具合があり、原因はGoogle側で解決していないため、呼び直しと、Gemma 4 31B・Gemini 3.1 Flash Liteへの切り替えで補う。無料枠の上限はモデルごとに数えられる。ESP32-CAMで撮った実際の駐車場の画像で、Gemma 4 26Bが混雑と写り具合を判定できることを確認済み。判定1回は約340トークンで、1分あたりのトークン上限には当たらない。5分枠なら1台あたり1時間に12回、監視時間(9:00〜17:30、両端の撮影を含む)で1日103回の判定になり、1日14,400回の上限からカメラは約139台が上限になる。
- カメラは、CMSの応答に含まれる写りの補正値(露出補正)を次の撮影から使う。色味はカメラの自動調整に任せる。ESP32-CAMのホワイトバランスモード(晴天・曇天・蛍光灯・電球)は、実機ではどれも色かぶりを強めたため使わない。
- 自動判定を主とする。管理画面での手入力は残すが、次の自動判定で上書きされる。

### 目標
- カメラから届いた画像をもとに、割り当て先の駐車場の空き状況が自動で更新されること。
- 公開ページで、駐車場ごとに最新の状態と画像を確認できること。
- 公開ページの画像が、時間帯や天気に関わらず見る人にとって見やすい写りになること。
- 設置時に、駐車場に割り当てる前のカメラの画像を管理画面で見て、向きや写りを確認できること。
- 受信や判定の失敗があっても、人が操作しなくても動き続けること。
- 判定が無料枠の範囲に収まること。

## Introduction
駐車場カメラの画像による空き状況の自動更新機能の要件を定める。CMSの受信処理(Parking Ingest)がカメラからの画像の受け取り・保存・判定・割り当て先の駐車場の空き状況の更新と、カメラへの写りの補正値の応答を担い、公開ページ(Parking Page)とデジタルサイネージの駐車場画面(Signage Parking Screen)が最新の状態と画像を来場者に見せる。無人で動くカメラの稼働状況は、CMSの稼働監視(Camera Watch)が実行委員に知らせる。

## Boundary Context
- **In scope**:
  - CMS: デバイス用トークンを検証する受信エンドポイント、カメラの登録とデバイス用トークンの発行・無効化、カメラの駐車場への割り当て、カメラごとの最新画像の保存、生成AIによる3段階の判定と写り具合の判定、写り具合の判定に基づく補正値の応答、割り当て先の駐車場の`parking_statuses`の自動更新、無料枠に収めるための呼び出しの抑制
  - 公開ページ: `/parking`での最新画像の表示と、自動更新された状態の表示
  - サイネージ: 駐車場画面での最新画像の表示
  - 稼働監視: カメラの端末状態の受信と管理画面での確認、画像が届かないときと復旧したときのDiscordへの通知
- **Out of scope**: カメラの実装と設定、手入力を自動判定より優先させる仕組み、画像の顔やナンバーのぼかし処理、駐車台数の計数、過去の画像や判定の履歴の公開、サイネージの駐車場画面以外の表示の変更
- **Adjacent expectations**: 空き状況が自動で更新されると、既存の`signageNotifyHook`によってサイネージにも反映される。

## Requirements

### Requirement 1: 画像の受信とデバイスの認証
**Objective:** As a 実行委員, I want 登録したカメラからの画像だけを受け付けたい, so that 第三者の画像で公開ページの状態や画像を書き換えられない

#### Acceptance Criteria
1. The Parking Ingest shall カメラからのJPEG画像を、HTTPSのPOSTで受け付けるエンドポイントを提供する
2. The Parking Ingest shall デバイス用トークンをカメラ1台に対応付けて管理し、受け取ったトークンから送信元のカメラを特定する
3. If トークンが無い、または登録されたどのトークンとも一致しない, the Parking Ingest shall 画像を保存せず判定も行わずに、認証の失敗を応答する
4. If 受け取ったデータがJPEG画像でない、または許容する大きさを超える, the Parking Ingest shall 画像を保存せず判定も行わずに、その旨を応答する
5. When 実行委員が管理画面でカメラのデバイス用トークンを発行し直す、または無効にする, the Parking Ingest shall 以降、古いトークンでの受信を拒否する
6. The Parking Ingest shall デバイス用トークンの値を、管理画面の一覧や公開APIの応答に出さない
7. When 画像の保存を終える, the Parking Ingest shall 判定の完了を待たずに、受信の成功をカメラへ応答する
8. When 受信の成功を応答する, the Parking Ingest shall 応答に、送信元のカメラの直近の写り具合の判定から決めた補正値(露出補正、-2〜+2)を含める。色かぶり(`color_cast`)の判定結果は補正値に反映しない
9. If 送信元のカメラに有効な写り具合の判定がまだない, the Parking Ingest shall 応答に補正値を含めない
10. While 送信元のカメラが駐車場に割り当てられていない, the Parking Ingest shall 割り当てられている場合と同じく、画像を受け付けて保存し、補正値を応答する
11. If 撮影時刻が無い、または受信時刻より2分を超えて未来か10分を超えて過去である, the Parking Ingest shall 画像を保存せず判定も行わずに、その旨を応答する
12. If 撮影時刻が監視時間の外である, the Parking Ingest shall 画像を保存せず、写り具合と混雑の判定も行わず、補正値を含めずに受信の成功を応答する

### Requirement 2: カメラの登録と駐車場への割り当て
**Objective:** As a 実行委員, I want カメラを登録して管理画面の操作だけで駐車場に割り当てたい, so that カメラの故障や付け替えのときにカメラの設定を書き換えずに済む

#### Acceptance Criteria
1. The Parking Ingest shall 実行委員が管理画面でカメラを登録・削除し、カメラごとにデバイス用トークンを発行できるようにする
2. The Parking Ingest shall 実行委員が管理画面で、カメラを駐車場に割り当てる、または割り当てを外せるようにする
3. The Parking Ingest shall 1駐車場に割り当てられるカメラを1台までとする
4. If 既に別のカメラが割り当てられている駐車場に、もう1台のカメラを割り当てようとする, the Parking Ingest shall その割り当てを保存せず、その旨を管理画面に示す
5. The Parking Ingest shall 1台のカメラの割り当て先を1駐車場までとする
6. When 駐車場が削除される, the Parking Ingest shall その駐車場に割り当てられていたカメラを削除せず、割り当てだけを外す
7. When カメラが削除される, the Parking Ingest shall そのカメラの画像とデバイス用トークンを合わせて削除する
8. When カメラの割り当てが付け替えられる, the Parking Ingest shall 以降の受信を、新しい割り当て先の駐車場のものとして扱う
9. The Parking Ingest shall 管理画面の駐車場の一覧と編集画面で、割り当てられたカメラの名前を示し、割り当てが無い駐車場はそれと分かるようにする
10. The Parking Ingest shall 管理画面のカメラの一覧で、カメラごとの割り当て先と、最後に受け取った画像の撮影時刻を示す

### Requirement 3: 最新画像の保存
**Objective:** As a 実行委員, I want カメラごとの最新の画像がCMSに残るようにしたい, so that 公開ページと判定が同じ最新の画像をもとにでき、設置時にカメラの向きも確認できる

#### Acceptance Criteria
1. When 認証済みの画像を受け取る, the Parking Ingest shall その画像を送信元のカメラの最新画像として、カメラが付けた撮影時刻と受信時刻とともに保存する
2. When 同じカメラの新しい画像を保存する, the Parking Ingest shall それより前の画像を削除し、カメラごとに最新の1枚だけを持つ
3. The Parking Ingest shall 保存した画像を、駐車場への割り当ての有無に関わらず、実行委員が管理画面で確認できるようにする

### Requirement 4: 生成AIによる混雑の判定
**Objective:** As a 実行委員, I want 画像から駐車場の混雑の度合いを自動で判定させたい, so that 当日に人が見回って入力しなくても空き状況が更新される

#### Acceptance Criteria
1. When 駐車場に割り当てられたカメラの新しい画像を保存する, the Parking Ingest shall その画像をGemini APIに渡し、駐車場の状態を`available`(空き)・`crowded`(混雑)・`full`(満車)のいずれかに判定させる。判定はカーシェア用などの専用区画を除いた通常の区画の埋まり具合で行い、9割程度以上埋まっていれば満車とする
2. The Parking Ingest shall 判定に、Gemini APIの無料枠で提供されるGemma 4 26Bを使い、判定できないときはGemma 4 31B、Gemini 3.1 Flash Liteの順に切り替える
3. If 判定の結果が3つの状態のどれにも当てはまらない、または画像から判断できないという結果である, the Parking Ingest shall 判定を失敗として扱う
4. If Gemini APIの呼び出しがエラー応答またはタイムアウトになる, the Parking Ingest shall 同じモデルで間隔を空けて呼び直し、それでも失敗するか利用上限を超過した場合は次のモデルに切り替え、すべてのモデルで失敗したら判定を失敗として扱う
5. The Parking Ingest shall 撮影時刻を設定された長さ(既定5分)の枠に区切り、同じカメラの判定を1つの枠につき1回までとし、全カメラを合わせた呼び出しを、各モデルの無料枠の1分あたり・1日あたりの上限に収める
6. If 呼び出しを抑えるために判定を見送る, the Parking Ingest shall 画像の保存は行い、空き状況は変えない
7. The Parking Ingest shall Gemini APIのキーをCMSのサーバー側だけで扱い、リポジトリ、公開APIの応答、フロントエンドに含めない
8. The Parking Ingest shall 判定の成否と失敗の理由、写り具合の判定結果を、実行委員が確認できる形でカメラごとに記録する
9. When 新しい画像を判定させる, the Parking Ingest shall 混雑の判定とは別に、画像の写り具合を`ok`(問題なし)・`too_dark`(暗すぎる)・`too_bright`(明るすぎる)・`color_cast`(色かぶり)のいずれかで判定させる
10. The Parking Ingest shall 写り具合の判定結果を、混雑の判定と空き状況の更新に使わない
11. If 写り具合の判定結果が4つのどれにも当てはまらない, the Parking Ingest shall 写り具合の判定だけを失敗として扱い、補正値の根拠にしない
12. While カメラが駐車場に割り当てられていない, the Parking Ingest shall そのカメラの画像について写り具合の判定だけを行い、混雑の判定を求めず、空き状況の更新もしない
13. The Parking Ingest shall 監視時間(既定9:00〜17:30、日本時間、開始と終了の時刻を含む)を設定値として持ち、実行委員が管理画面で変えられるようにする

### Requirement 5: 空き状況の自動更新
**Objective:** As a 実行委員, I want 判定の結果がそのまま空き状況に反映されてほしい, so that 公開ページとサイネージが最新の状態を表示する

#### Acceptance Criteria
1. When 駐車場に割り当てられたカメラの判定に成功する, the Parking Ingest shall 割り当て先の駐車場の`parking_statuses`の`status`を判定結果で更新する
2. When 判定に成功し、結果が直前の状態と同じである, the Parking Ingest shall 状態を変えずに更新時刻だけを新しくする
3. If 判定に失敗する, the Parking Ingest shall 空き状況の状態と更新時刻を変えない
4. If 判定の完了までの間にカメラの割り当てが外される、または別の駐車場に付け替えられる, the Parking Ingest shall その判定結果を元の割り当て先の駐車場の空き状況に反映しない
5. When 実行委員が管理画面で空き状況を手入力で更新したあとに判定が成功する, the Parking Ingest shall 手入力の値を判定結果で上書きする
6. The Parking Ingest shall 実行委員による管理画面での空き状況の手入力を、これまでどおり行えるようにする
7. The Parking Ingest shall `parking_statuses`の作成と削除を、これまでどおり`parking_lots`のフックだけに任せ、受信処理では行わない
8. While 駐車場にカメラが割り当てられていない, the Parking Ingest shall その駐車場を自動判定の対象から外し、空き状況を管理画面の手入力だけで更新されるままにする
9. The Parking Page and Signage Parking Screen shall 空き状況が手入力と自動判定のどちらで更新されたかを区別せずに表示する

### Requirement 6: 公開ページでの画像と状態の表示
**Objective:** As a 来場者, I want 駐車場の状態と一緒に実際の様子の画像を見たい, so that 出かける前や到着前にどの駐車場へ向かうか決められる

#### Acceptance Criteria
1. While 開催当日として扱われている, the Parking Page shall 駐車場ごとに、状態と並べて割り当てられたカメラの最新の画像と、その画像の撮影時刻を表示する
2. While 開催当日として扱われていない, the Parking Page shall 状態と同じく画像も表示せず、`/api/parking`の応答にも画像を含めない
3. Where 駐車場にカメラが割り当てられていない、またはカメラに画像がまだ無い, the Parking Page shall 画像の欄を出さずに、状態だけをこれまでどおり表示する
4. When カメラの割り当てが外される、またはカメラが削除される, the Parking Page shall その駐車場の画像を表示せず、`/api/parking`の応答にも含めない
5. The Parking Page shall 駐車場に割り当てられていないカメラの画像を、表示せず`/api/parking`の応答にも含めない
6. When ページの表示中に新しい画像が保存される, the Parking Page shall 既存の状態のポーリングと同じ周期で、再読み込みせずに画像を新しいものへ差し替える
7. If 画像の撮影時刻から15分以上が過ぎている, the Parking Page shall 画像の撮影時刻に「古い画像の可能性があります」と添えて表示する。この閾値は状態の更新時刻の古さの判定(30分)とは別に扱う
8. The Parking Page shall 画像に、駐車場名を含む代替テキストを付ける
9. The Parking Page shall 画像をぼかしなどで加工せず、撮影されたとおりに表示する
10. The Parking Page shall 写り具合の判定結果に関わらず、最新の画像を表示する
11. The Parking Page shall 画像を、表示用に幅960へ縮小した版で表示し、原寸の画像は管理画面と判定にだけ使う
12. The Parking Page shall 駐車場にカメラが割り当てられていない場合と、割り当て済みで画像がまだ無い場合を区別せず、どちらも画像の無い駐車場として表示し、`/api/parking`の応答でも区別しない
13. Where 駐車場の空き状況が未設定である, the Parking Page shall 画像があっても画像の欄を出さない
14. While 現在時刻が監視時間の外である, the Parking Page shall 画像を表示せず、`/api/parking`の応答にも含めず、画像の無い駐車場と同じ表示にする。空き状況の表示はこれまでどおりとする

### Requirement 7: サイネージの駐車場画面での画像の表示
**Objective:** As a 来場者, I want 会場のサイネージでも駐車場の様子の画像を見たい, so that 会場内からでも帰りに使う駐車場の混み具合を確かめられる

#### Acceptance Criteria
1. While 開催当日として扱われている, the Signage Parking Screen shall 駐車場ごとに、状態と並べて割り当てられたカメラの最新の画像を表示する
2. While 開催当日として扱われていない, the Signage Parking Screen shall 画像を表示しない
3. Where 駐車場にカメラが割り当てられていない、またはカメラに画像がまだ無い, the Signage Parking Screen shall 画像の欄を出さずに、状態だけをこれまでどおり表示する
4. When カメラの割り当てが外される、またはカメラが削除される, the Signage Parking Screen shall その駐車場の画像を表示しない
5. The Signage Parking Screen shall 駐車場に割り当てられていないカメラの画像を表示しない
6. If 画像の撮影時刻から15分以上が過ぎている, the Signage Parking Screen shall 画像に「古い画像の可能性があります」と表示する
7. The Signage Parking Screen shall 写り具合の判定結果に関わらず、最新の画像を表示する
8. The Signage Parking Screen shall 画像を、公開ページと同じ幅960へ縮小した版で表示する
9. The Signage Parking Screen shall 駐車場にカメラが割り当てられていない場合と、割り当て済みで画像がまだ無い場合を区別せず、どちらも画像の無い駐車場として表示する
10. While 現在時刻が監視時間の外である, the Signage Parking Screen shall 画像を表示せず、画像の無い駐車場と同じ表示にする

### Requirement 8: カメラの稼働状況の把握
**Objective:** As a 実行委員, I want 無人で動くカメラの状態を遠隔で把握したい, so that 当日にカメラが止まっても現地へ行く前に気づき、原因の見当をつけられる

#### Acceptance Criteria
1. When 認証済みの受信がある, the Camera Watch shall 受信に付いた端末状態(電波強度、起動からの時間、直前の再起動の理由、直前まで続いた送信の失敗の回数、ファームウェアの版)を、カメラごとに最新値として受信時刻とともに保存する
2. If 端末状態の項目が欠けている、または不正な値である, the Camera Watch shall その項目を値なしとして扱い、画像の受け付けには影響させない
3. The Camera Watch shall 端末状態の最新値と受信時刻を、実行委員が管理画面のカメラの一覧と編集画面で確認できるようにする
4. While 開催初日の7日前から開催最終日までの各日の監視時間中である, When 駐車場に割り当てられたカメラから、最後の画像の撮影時刻(当日まだ画像が無ければ監視時間の開始時刻)から15分以上画像が届かない, the Camera Watch shall Discordに停止を1回通知する
5. When 停止を通知したカメラから画像が再び届く, the Camera Watch shall Discordに復旧を1回通知する
6. The Camera Watch shall 同じ停止について停止の通知を繰り返さない
7. The Camera Watch shall 通知に、カメラ名、割り当て先の駐車場名、最後の画像の撮影時刻、最後に受け取った端末状態(電波強度、送信の失敗の回数、直前の再起動の理由)を含める
8. The Camera Watch shall 通知の対象期間(開催初日の7日前から開催最終日まで)の外、監視時間外、駐車場に割り当てられていないカメラについて、停止を通知しない
9. The Camera Watch shall DiscordのWebhook URLをCMSのサーバー側の秘密値として扱い、リポジトリ、公開APIの応答、フロントエンドに含めない
10. The Camera Watch shall 通知を、既存の監視系の通知と同じDiscordのチャンネルへ送る
