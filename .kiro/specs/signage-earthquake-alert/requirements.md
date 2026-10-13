# Requirements Document

## Introduction

サイネージ画面(`/signage`)に、気象庁が発表する緊急地震速報(警報)を外部の配信元から受けて全画面で上書き表示する要件を定める。警報を受けたら通常のスライドを止めて身を守る行動を促し、続いて届く地震情報(前橋市の観測点の実測震度)に応じて「揺れは収まりました」または「移動せずスタッフの指示を待ってください」と避難場所の案内へ自動で切り替える。表示は実行委員がCMSで解除するまで続ける。あわせて、群馬県に関係する速報・地震情報と表示の変化を、実行委員用のDiscordチャンネルへサイネージより詳しい内容と情報源つきで投稿する。

配信元はCMSではなく、無料の2系統(P2P地震情報・Wolfx)のWebSocket。サーバー側で上流の接続を受け、端末へは既存のサイネージの配信経路(`frontend/workers/signage-hub`のハブ、`frontend/src/lib/signage-channel.ts`の`SignageFeaturePayloads`と`expiresAt`、`frontend/src/lib/use-signage-channel.ts`の端末クライアント)で届ける。上流の接続はWorkers Paidの期間(2026-10-23 9:00〜2026-11-22 0:00、日本時間、終端を含まない)だけ動かす。

## Project Description (Input)
サイネージ画面(`/signage`)に、緊急地震速報(警報)を受けて全画面で上書き表示する。手動で解除するまで通常のスライドを止め、避難誘導の表示を出す。配信元はCMSではなく外部のAPI。

### 配信元
- 無料の2系統で冗長化する。P2P地震情報のWebSocket(`wss://api.p2pquake.net/v2/ws`。code 556=緊急地震速報(警報)、551=地震情報)と、Wolfx(`wss://ws-api.wolfx.jp/jma_eew`等。`isWarn`・`isCancel`・`isTraining`を持ち、地震情報のフィードもある)。
- 同じ報は地震IDと続報番号で重複を除く。
- P2P地震情報は1IPあたりWebSocket 2接続までなので、端末から直接つながず、サーバー側で上流の接続を1系統1本ずつ受けて中継する。

### 対象
- 警報のみ。予報は扱わない。
- 訓練・テストの報は「訓練」と明示して区別する。取消報は取消として扱う。

### 段階(自動で切り替える)
1. 警報を受けたとき: 「地震です。落ち着いて身を守ってください」の系統の表示(頭を守る・窓や吊り下げ物から離れる・出口に走らない)。予想震度と到達までの秒数は出さない。続報で表示を変えない(気象庁の緊急地震速報の利活用ガイドライン https://www.jma.go.jp/jma/kishou/know/jishin/eew/katsuyou/guideline/guideline.pdf の推奨)。
2. 地震情報(観測震度)を受け、前橋市の観測点の実測震度が閾値未満のとき: 「揺れは収まりました」の表示で待機する。
3. 閾値以上のとき: 「移動せずスタッフの指示を待ってください」と避難場所の案内。閾値は前橋の実測震度5強(根拠: 群馬大学の安否確認の基準 https://www.gunma-u.ac.jp/studentlife/stu010/g173175 。避難行動の公的な閾値は存在しない)。

### 解除と編集
- 解除は手動のみ。操作はCMS管理画面の、既存のサイネージ固定表示の操作と同じ場所で行う。
- 避難誘導の内容(文言・避難場所・地図画像)は専用の編集画面を作らず、既存のサイネージのスライドとグループの仕組みで、CMSの「緊急地震速報」用のスライドとして運用側が後から入れる。
- 警報音は鳴らさない。

### 表示上の法的な制約
- 受信した値を加工せずに転送して表示する。震度や到達時刻を自前で計算しない(気象業務法。予報業務許可が不要な範囲 https://www.jma.go.jp/jma/kishou/minkan/q_a_s.html )。
- サイネージの表示には「気象庁発表の転送・参考情報(公式の警報ではない)」を常に明示する(Wolfxの規約が公式の警報としての提示を禁止している)。実行委員向けのDiscordの通知には付けない。

### 配信経路
- 端末へのpushの経路(DOとWebSocket Hibernationのハブ、端末のクライアント、再接続と追いつき、時刻補正、他機能からの`publish`の口、メッセージの有効期限の仕組み)は既存のコード(`frontend/workers/signage-hub`、`frontend/src/lib/signage-channel.ts`、`frontend/src/lib/use-signage-channel.ts`)にある。本specはその上に乗り、上流のWebSocket接続と中継、速報の中身と表示を持つ(速報の表示中の状態に有効期限は持たせない)。
- 上流の接続はハブとは別のDOクラスに置く(外向きのWebSocketはHibernationされず、デプロイで切れるため、alarm等で再接続を見張る)。
- pinの応答・`getPinState`・`/api/signage/pin`・サイトのWorkerの入口・`frontend/wrangler.toml`のハブのbindingは変更しない。

### 稼働期間
- 上流の接続はWorkers Paidの期間(2026-10-23〜11-22)だけ動かす。常時起動のDOは128MB固定・実時間の課金で1日約10,800GB-sになり、Freeの上限1日13,000GB-sをハブの分と合わせて超えるため。Freeに戻す前に止める(WBS記載済み)。

### 表示
- オーバーレイはサイネージのキャンバス(1920×1080の横、1080×1920の縦)の最前面に全画面で出し、テロップ・左カラム等の常設の帯も覆う。

## Boundary Context

- **In scope**: 上流2系統(P2P地震情報・Wolfx)へのサーバー側の接続と再接続、受信した報の選別・重複除去・段階の判定、既存の配信経路への中継、サイネージ画面の全画面の速報表示、CMSでの解除の操作と「緊急地震速報」用のスライド・グループによる避難誘導の内容の用意、解除を上流の接続を持つDOからハブへ伝える口、上流の接続の稼働期間の制御、実行委員用のDiscordチャンネルへの通知、開発時の試験手段
- **Out of scope**: 緊急地震速報(予報)、津波・気象など地震以外の情報、警報音、端末の機材とブラウザの設定、公式サイト(サイネージ以外のページ)への速報の表示、配信経路そのもの(ハブ・端末クライアント・再接続・時刻補正・`publish`・有効期限の判定の仕組み)の変更、既存の運用通知(`aramakisai-infra`の`DISCORD_OPS_WEBHOOK_URL`による通知)の変更
- **Adjacent expectations**: 端末への配信は既存のハブの`publish`と`SignageFeaturePayloads`に機能を足す形で行い、pinの応答・`getPinState`・`/api/signage/pin`・サイトのWorkerの入口(`frontend/workers/site-entry.ts`)・`frontend/wrangler.toml`のハブのbindingは変更しない。CMSの解除の操作は、既存の固定表示の操作と同じ場所(サイネージのスライドの一覧の上部)に置く。Workers Paidの契約期間はWBSの「Cloudflare Workers を Paid に切り替える (開催期間のみ)」に従う

## Requirements

### Requirement 1: 速報の受信と選別
**Objective:** As a 実行委員, I want 緊急地震速報(警報)を2つの配信元から確実に受けたい, so that 片方の配信元が止まっていても会場の端末に警報を出せる

#### Acceptance Criteria
1. While 稼働期間(Requirement 10)である, the Earthquake Alert Relay shall P2P地震情報(`wss://api.p2pquake.net/v2/ws`)とWolfx(緊急地震速報と地震情報のフィード)の両方に、サーバー側から1系統につき1本ずつ接続を保つ
2. The Earthquake Alert Relay shall 上流への接続の数を、端末の台数に依らず1系統につき1本にする(端末から上流へ直接接続させない)
3. When 緊急地震速報(警報)を受信する, the Earthquake Alert Relay shall 受信した報を表示の段階の判定に使う
4. The Earthquake Alert Relay shall 緊急地震速報(予報)と、警報でない報を表示に使わない
5. When 2系統から同じ報(同じ地震ID・続報番号・取消か否か)を受信する, the Earthquake Alert Relay shall 情報源の優先(Requirement 13)に従って、後から受けた報で先の内容を置き換えるか捨てるかを決め、段階の判定を重複して行わない
6. If 発表から一定時間を過ぎた報、または上流への接続直後に送られてくる過去の報を受信する, then the Earthquake Alert Relay shall その報で新たに速報の表示を始めない
7. If 受信した報が解釈できない形である, then the Earthquake Alert Relay shall その報を捨て、上流への接続を保つ
8. If 警報の対象地域に群馬県が含まれない, then the Earthquake Alert Relay shall その警報を表示に使わない

### Requirement 2: 警報を受けたときの表示
**Objective:** As a 来場者, I want 強い揺れが来る前に何をすればよいかを画面で知りたい, so that 落ち着いて身を守れる

#### Acceptance Criteria
1. When 緊急地震速報(警報)を受信する, the Signage Page shall 全端末(配信PCを含む)で、身を守る行動を促す表示(以下、段階1)を全画面で出す
2. The Signage Page shall 段階1で、頭を守る・窓や吊り下げ物から離れる・出口に走らない、の行動を示す
3. The Signage Page shall 段階1で、予想震度・予想到達時刻・到達までの秒数を表示しない
4. While 段階1を表示している, when 同じ地震の続報(最終報を含む)を受信する, the Signage Page shall 段階と行動の表示を変えない(固定の帯の情報源の表示の置き換え(Requirement 13)を除く)
5. The Earthquake Alert Relay shall 上流から警報を受信してからおよそ2秒以内に、接続中の全端末で段階1を表示させる
6. The Signage Page shall 速報の表示で警報音などの音を鳴らさない
7. When 段階2または段階3を表示中に、別の地震の緊急地震速報(警報)を受信する, the Signage Page shall 段階1の表示に切り替える

### Requirement 3: 地震情報による段階の切り替え
**Objective:** As a 来場者, I want 揺れの後に次に何をすればよいかを画面で知りたい, so that 安全な場所で指示を待てる

#### Acceptance Criteria
1. While 速報を表示している, when 表示中の警報の地震に対応する地震情報(観測震度)を受信する, the Earthquake Alert Relay shall 前橋市の観測点の実測震度を受信した値のまま閾値と比べ、表示の段階を決める
2. The Earthquake Alert Relay shall 段階を決める閾値を実測震度5強とする
3. When 前橋市の観測点の実測震度が閾値未満である, the Signage Page shall 「揺れは収まりました」の系統の表示(以下、段階2)に切り替え、そのまま待機する
4. When 前橋市の観測点の実測震度が閾値以上である, the Signage Page shall 「移動せずスタッフの指示を待ってください」の系統の表示と避難場所の案内(以下、段階3)に切り替える
5. When 2系統から同じ地震の地震情報を受信する, the Earthquake Alert Relay shall 情報源の優先(Requirement 13)に従って表示に使う地震情報を決め、段階の判定を重複して行わない
6. The Earthquake Alert Relay shall 前橋市内に観測点が複数あるときは、その実測震度の最大値を閾値と比べ、地震情報に前橋市が載らないときは閾値未満として段階2に進める
7. While 段階3を表示している, when 同じ地震のより小さな震度の地震情報(訂正など)を受信する, the Signage Page shall 段階2に戻さず段階3を保つ
8. When 緊急地震速報(警報)を受けていない地震で、前橋市の実測震度が閾値以上の地震情報を受信する, the Signage Page shall 段階3を表示する
9. The Signage Page shall 段階2・段階3で、受信した地震情報の値(発生時刻・震源・前橋市の実測震度。前橋市の観測点の震度を持たない地震情報では最大震度)と、その情報源(P2P地震情報かWolfxか)を加工せずに表示する
10. The Earthquake Alert Relay shall 段階3(警報を受けていない地震の段階3(3.8)を含む)を、前橋市の観測点の震度を持つ地震情報(P2P地震情報)だけで決め、前橋市の観測点の震度を持たない地震情報(Wolfxの地震情報)では、最大震度が5弱未満のときだけ段階2に進める
11. If 受信した地震情報の値から前橋市の実測震度が閾値以上か未満かを決められない(前橋市の観測点の震度が5弱以上と推定されるだけで実測の値が無い、前橋市の観測点の震度を持たない地震情報で最大震度が5弱以上または不明である), then the Earthquake Alert Relay shall 段階を変えない
12. While 前橋市の観測点の震度を持つ地震情報を受信できない(P2P地震情報が止まっている), the Earthquake Alert Relay shall 段階3へ自動で切り替えず、段階2へ進める地震情報も無ければ段階1のまま実行委員の解除(Requirement 6)を待つ

### Requirement 4: 取消報と訓練報
**Objective:** As a 来場者, I want 取消や訓練の報を本物の警報と取り違えたくない, so that 不要な混乱を避けられる

#### Acceptance Criteria
1. While 段階1または段階2を表示している, when 表示中の警報の地震の取消報を受信する, the Signage Page shall 速報の表示を、警報が取り消されたことを示す表示に切り替える
2. While 取消を示す表示をしている, the Signage Page shall 実行委員が解除するまで(Requirement 6)、その表示を続ける
3. If 速報を表示していないときに取消報を受信する, then the Signage Page shall 表示を変えない
4. When 訓練またはテストの報(Wolfxの`isTraining`、P2P地震情報の試験の報等)を受信する, the Signage Page shall 本物の報と同じ段階の表示を出し、「訓練」であることを全段階で本物の報と見分けられる形で明示する
5. If 本物の報の表示中に訓練またはテストの報を受信する, then the Signage Page shall 本物の報の表示を訓練の報で置き換えない
6. While 段階3を表示している, when 表示中の警報の地震の取消報を受信する, the Signage Page shall 取消報を無視して段階3を保つ

### Requirement 5: 全画面の上書き表示と表示内容の制約
**Objective:** As a 来場者, I want 速報の表示が他の案内に埋もれずに読めてほしい, so that 一目で状況が分かる

#### Acceptance Criteria
1. The Signage Page shall 速報の表示を、サイネージのキャンバス(1920×1080の横、1080×1920の縦)の最前面に全画面で出し、メイン領域のスライド・テロップ・左カラム・バス案内など常設の帯をすべて覆う
2. While 速報を表示している, the Signage Page shall 通常のスライドの切り替えとテロップの表示を画面に出さない
3. The Signage Page shall 速報の表示中に、「気象庁が発表した情報を転送した参考情報であり、公式の警報ではない」旨を常に表示する
4. The Earthquake Alert Relay shall 受信した値を加工せずに表示に使い、震度・震源・到達時刻を自ら計算・推定しない
5. The Signage Page shall 横長・縦長のどちらの画面でも、速報の表示の文言と避難場所の案内を切れずに読める形で表示する
6. When 端末が起動した直後、または配信経路への接続が回復した直後である, the Signage Page shall 速報の表示中であれば、数秒以内に現在の段階の表示を出す

### Requirement 6: 手動の解除と通常表示への復帰
**Objective:** As a 実行委員, I want 安全を確かめてから自分の判断で速報の表示を解除したい, so that 状況が落ち着く前に通常の案内へ戻ってしまうことがない

#### Acceptance Criteria
1. The Earthquake Alert Relay shall 速報の表示を、実行委員の解除の操作によってのみ終わらせ、時間の経過・続報・取消報・地震情報で自動的に終わらせない
2. The CMS shall 速報の解除の操作を、サイネージの固定表示の操作と同じ場所(スライドの一覧の上部)に置く
3. While 速報を表示している, the CMS shall 解除の操作の場所に、表示中であること・現在の段階・訓練か取消かの別・受信した時刻を表示する
4. When 実行委員が解除を保存する, the Signage Page shall 保存からおよそ3秒以内に全端末で速報の表示を消し、通常の表示に戻る
5. When 通常の表示に戻る, the Signage Page shall 全端末で、配信元の時刻に合わせた同じスライドから切り替えを再開し、固定表示とグループの表示状態はその時点のCMSの設定に従う
6. When 解除の後に、解除した地震と同じ地震の緊急地震速報の続報・取消報を受信する, the Signage Page shall 速報の表示を再び出さない
7. When 段階3の判定の前に解除した後、同じ地震の地震情報で前橋市の実測震度が閾値以上と分かる, the Signage Page shall 段階3の表示を再び出す(6.6の再表示の抑止は続報・取消報に限る)
8. The CMS shall 解除の操作を、固定表示を操作できる実行委員に限って行えるようにする

### Requirement 7: 避難誘導の内容の用意(既存のスライドとグループの利用)
**Objective:** As a 実行委員, I want 各段階の文言と避難場所の案内を既存のスライド編集で自分で入れたい, so that 専用の画面を覚えずに会場の実情に合わせた案内を開発者を介さずに用意できる

#### Acceptance Criteria
1. The CMS shall 「緊急地震速報」用のサイネージのグループを備え、避難誘導の内容(文言・避難場所・地図画像)を、既存のサイネージのスライドの編集でそのグループのスライドとして作れるようにする
2. The CMS shall 段階1・段階2・段階3・取消のそれぞれに、緊急地震速報用のグループのどのスライドを出すかの対応付けを設定できるようにする
3. While 速報を表示している, the Signage Page shall 現在の段階に対応付けたスライドを表示する
4. The Signage Page shall 緊急地震速報用のグループのスライドを、「すべて」のグループが表示中でも、通常の巡回・固定表示の選択肢に混ぜない
5. The Signage Page shall 段階の表示(段階1〜3・取消)、受信値と情報源(3.9・13.6)、「公式の警報ではない」旨(5.3)、「訓練」の明示(4.4)を、スライドの上に重ねる固定の帯として出し、スライドの編集で消せない形にする
6. If 現在の段階に対応するスライドが無い、またはスライドの内容が空である, then the Signage Page shall あらかじめ定めた既定の文言(段階1は「地震です。落ち着いて身を守ってください」の系統、段階2は「揺れは収まりました」の系統、段階3は「移動せずスタッフの指示を待ってください」の系統)を表示し、空の画面を出さない
7. When 実行委員が緊急地震速報用のスライドまたは対応付けを保存する, the Signage Page shall 速報の表示中でも、保存から数秒以内に全端末で更新後の内容を表示する

### Requirement 8: 配信経路への中継と有効期限
**Objective:** As a 開発者, I want 速報の状態を既存のサイネージの配信経路で全端末へ届けたい, so that 端末の接続・再接続・追いつきを作り直さずに済む

#### Acceptance Criteria
1. The Earthquake Alert Relay shall 速報の状態(表示の有無・段階・訓練か取消かの別・表示に使う受信した値)を、既存のハブの`publish`で全端末へ送る
2. The Earthquake Alert Relay shall pinの応答・`getPinState`・`/api/signage/pin`・`/api/signage/notify`・サイトのWorkerの入口・`frontend/wrangler.toml`のハブのbindingを変更せずに中継する
3. The Earthquake Alert Relay shall 上流の接続を、端末の接続を受け持つハブとは別のDurable Objectのクラスに置く
4. The Earthquake Alert Relay shall 速報の表示中の状態のメッセージに有効期限を持たせず(`expiresAt`をnull)、手動の解除まで端末とハブの保持に残す
5. When 実行委員がCMSで解除する, the Earthquake Alert Relay shall 上流の接続を持つDurable Objectが持つ解除専用の口でその操作を受け、そこからハブの`publish`で速報を表示しない状態のメッセージを送り、ハブの保持の速報の状態を置き換える
6. If 新しい機能のメッセージを解釈できない旧版の画面が配信経路に接続している, then the Signage Page shall 速報の表示以外の通常の表示を乱さない

### Requirement 9: 上流の切断と停止への対処
**Objective:** As a 実行委員, I want 配信元との接続が切れても気付かないまま警報を取りこぼしたくない, so that 開催中に受信できない状態を放置しない

#### Acceptance Criteria
1. If 上流への接続が切れる, then the Earthquake Alert Relay shall 自動で接続し直し、失敗が続く間は間隔を延ばしながら再試行する
2. If 上流への接続が開いたまま一定時間何も受信しない(半開きの接続), then the Earthquake Alert Relay shall その接続を切断して接続し直す
3. When デプロイや実行環境の都合で上流の接続を持つDurable Objectが再起動する, the Earthquake Alert Relay shall 稼働期間内であれば、利用者の操作なしに上流へ接続し直す
4. While 片方の系統だけが接続している, the Earthquake Alert Relay shall 接続している系統だけで受信と表示を続ける
5. The Earthquake Alert Relay shall 系統ごとの接続の状態(接続中か、最後に受信した時刻)を、CMS管理画面で実行委員が確かめられるようにする
6. If 両系統とも受信できない状態が続く, then the CMS shall 受信できないことをCMS管理画面にだけ表示し、端末の画面には出さない(受信できないと判断するまでの時間はdesignで決める)
7. The Earthquake Alert Relay shall 上流の受信状態を端末へ配信しない
8. If 上流の接続の失敗が続く, then the Earthquake Alert Relay shall 上流への接続の試行と配信経路への送信を、失敗していないときより増やさない(再試行の間隔の上限を持つ)

### Requirement 10: 稼働期間と費用
**Objective:** As a 実行委員, I want 上流の接続をWorkers Paidの期間だけ動かしたい, so that Freeの日次上限を超えてサイネージの配信経路ごと止まることを防げる

#### Acceptance Criteria
1. While 稼働期間(2026-10-23 9:00〜2026-11-22 0:00、日本時間、終端を含まない。Workers Paidの契約期間の内側)である, the Earthquake Alert Relay shall 上流への接続を保つ
2. While 稼働期間の外である, the Earthquake Alert Relay shall 上流へ接続せず、上流の接続を持つDurable Objectを起動したままにしない
3. The Earthquake Alert Relay shall Workers PaidからFreeへ戻る前に上流の接続を止め、Freeの期間にDurable Objectの実行時間の日次上限(13,000GB-s)を超えないようにする
4. The Earthquake Alert Relay shall 有料プランの基本料金に含まれないCloudflareのサービスを新たに使わない
5. While 上流の接続を止めている, the Signage Page shall 通常の表示を続け、速報の受信を止めていることによる表示の変化を出さない
6. The Earthquake Alert Relay shall 上流の接続の開始と停止を、設定した稼働期間(2026-10-23 9:00〜2026-11-22 0:00、日本時間)により日付で自動的に行い、手動の操作を要さない

### Requirement 11: 試験の手段
**Objective:** As a 開発者, I want 開催前に各段階の表示を確かめたい, so that 本番の運用前に速報の表示を検証できる

#### Acceptance Criteria
1. The Earthquake Alert Relay shall 上流の接続先を設定で指定でき、本番の配信元のほか、P2P地震情報のサンドボックス(`wss://api-realtime-sandbox.p2pquake.net/v2/ws`)等を指定して試験できるようにする
2. The Earthquake Alert Relay shall 試験報を本番の端末から隔離する仕組み(試験用のハブ等)を設けず、試験は開催前に行い、本番のハブ・端末に試験報(訓練表示)が届いてよいものとする
3. The Earthquake Alert Relay shall 段階1・段階2・段階3・取消・訓練の各表示を、上流の報を待たずに開発環境で再現して確かめられるようにする
4. The Earthquake Alert Relay shall 2系統からの同じ報の重複除去、予報・古い報の除外、段階の判定、解除後の再表示の抑止を、自動テストで確かめられるようにする
5. While 上流の接続先が本番の配信元でない(P2P地震情報のサンドボックス`wss://api-realtime-sandbox.p2pquake.net/v2/ws`など、試験用に設定した接続先である), the Earthquake Alert Relay shall その系統を試験モードとして動かし、古い報の除外(1.6)と群馬県が対象地域に含まれない警報の除外(1.8)を適用せず、受信したすべての報を訓練報として扱って「訓練」の明示(4.4)を付ける
6. While 上流の接続先が本番の配信元である, the Earthquake Alert Relay shall その系統を試験モードにしない
7. The Earthquake Alert Relay shall 公式のサンドボックスを持たないWolfxの系統について、保存したJSON(訓練・取消の報を手で作ったものを含む)を流して、受信から表示までを確かめられるようにする

### Requirement 12: 実行委員向けのDiscord通知
**Objective:** As a 実行委員, I want サイネージより詳しい速報の内容と情報源をDiscordで確かめたい, so that 会場での判断と来場者への案内に要る情報を手元で得られる

#### Acceptance Criteria
1. When 対象地域に群馬県を含む緊急地震速報(警報)(続報・最終報・取消報・訓練報を含む)を受信する, the Earthquake Alert Relay shall 実行委員用のDiscordチャンネルへその報の内容を投稿する
2. The Earthquake Alert Relay shall 緊急地震速報(予報)と、対象地域に群馬県を含まない警報を投稿しない(群馬県を含む警報を投稿した地震の続報・取消報は投稿する)
3. When 群馬県内の観測点を含む地震情報(観測震度)を受信する, the Earthquake Alert Relay shall その地震情報の内容を投稿する
4. When サイネージの速報の表示の段階が変わる, the Earthquake Alert Relay shall 変わった後の段階(段階1〜3・取消、訓練の別)を投稿する
5. When 実行委員がCMSで速報の表示を解除する, the Earthquake Alert Relay shall 解除したことと、解除した実行委員を投稿する
6. When 上流の系統が受信できない状態になる、または受信できる状態に戻る, the Earthquake Alert Relay shall その系統と状態の変化を投稿する
7. The Earthquake Alert Relay shall 緊急地震速報の投稿に、種別(警報・続報・取消・訓練)と続報番号、震源地・マグニチュード・深さ・発生時刻・発表時刻、地域ごとの予想震度と到達予想時刻(群馬県南部を先頭)、情報源(P2P地震情報かWolfxか)と受信した時刻を載せる
8. The Earthquake Alert Relay shall 地震情報の投稿に、震源地・マグニチュード・深さ・発生時刻・発表時刻、前橋市の観測点の実測震度、情報源と受信した時刻を載せる
9. The Earthquake Alert Relay shall 投稿に載せる値を受信した値のまま使い、震度・到達時刻を自ら計算・推定しない
10. The Earthquake Alert Relay shall 投稿に「公式の警報ではない」旨を付けない(実行委員向けの通知であり、来場者には見せない)
11. When 2系統から同じ報を受信する, the Earthquake Alert Relay shall その報を1回だけ投稿し、情報源の優先(Requirement 13)による置き換えは先の投稿の編集で行う
12. If 発表から一定時間を過ぎた報、または上流への接続直後に送られてくる過去の報を受信する(1.6), then the Earthquake Alert Relay shall その報を投稿しない
13. If Discordへの投稿に失敗する, then the Earthquake Alert Relay shall サイネージの表示と端末への配信を遅らせず止めず、限られた回数だけ投稿し直し、失敗したことをCMS管理画面で実行委員が確かめられるようにする
14. The Earthquake Alert Relay shall 投稿先を既存の運用通知とは別の実行委員用のチャンネルとし、WebhookのURLを秘密として扱い、端末・CMS管理画面・ログに出さない
15. While 稼働期間(Requirement 10)の外である, the Earthquake Alert Relay shall 報と受信状態を投稿しない
16. When 訓練またはテストの報、または試験モードの系統(11.5)の報を投稿する, the Earthquake Alert Relay shall 投稿に「訓練」であることを本物の報と見分けられる形で明示する
17. The Earthquake Alert Relay shall 試験のときの投稿を、本番と同じチャンネルで本番の投稿と区別できる文面にする

### Requirement 13: 情報源の優先と置き換え
**Objective:** As a 実行委員, I want 情報の粒度が細かいP2P地震情報の内容を優先して見たい, so that 先に届いたWolfxの内容のままにならず、より詳しい内容で状況を判断できる

#### Acceptance Criteria
1. When 同じ報(同じ地震ID・続報番号・取消か否か)をWolfxから先に受信する, the Earthquake Alert Relay shall まずWolfxの内容でサイネージの表示とDiscordへの投稿を行う
2. When Wolfxの内容を出した報と同じ報をP2P地震情報から受信する, the Earthquake Alert Relay shall サイネージの固定の帯の受信値と情報源の表示をP2P地震情報の内容に自動で置き換え、Discordでは新たに投稿せず先の投稿を編集してP2P地震情報の内容に置き換える
3. The Earthquake Alert Relay shall 緊急地震速報の置き換えで表示の段階を変えない(2.4)
4. When P2P地震情報の内容を出した報と同じ報をWolfxから受信する, the Earthquake Alert Relay shall その報を捨て、P2P地震情報の内容をWolfxの内容で上書きしない
5. When 先に処理した報より続報番号が新しい報を受信する, the Earthquake Alert Relay shall 系統に依らず新しい報を優先し、その後に届いた続報番号が古い報を捨て、新しい続報番号の報にも13.1・13.2・13.4を適用する
6. The Signage Page shall 速報の表示中、固定の帯に、表示の根拠の報の情報源(P2P地震情報かWolfxか)を表示する
7. When 表示の根拠がWolfxの地震情報である地震について、同じ地震のP2P地震情報の地震情報を受信する, the Earthquake Alert Relay shall 固定の帯の受信値と情報源をP2P地震情報の内容に置き換え、段階をその地震情報で判定する(3.10)
8. When P2P地震情報の地震情報を表示の根拠にした地震について、同じ地震のWolfxの地震情報を受信する, the Earthquake Alert Relay shall そのWolfxの地震情報を捨てる
