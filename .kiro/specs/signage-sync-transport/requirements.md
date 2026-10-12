# Requirements Document

## Project Description (Input)
デジタルサイネージの端末と、サーバーとのあいだの確認通信の方式を見直す。

### 現状
- 各端末は3秒ごとに`/api/signage/pin`(Next.js、Cloudflare Workers上)に問い合わせる。
- このエンドポイントは、毎回Payload CMSにキャッシュなしで3回問い合わせる(設定・グループ一覧・有効なスライドのID)。
- 返すのは、固定表示とグループの表示状態(`visibleSlideIds`)。
- スナップショット(`/api/signage`)は約35秒ごとに取得する。

### 課題
- CMSへの問い合わせが、端末の台数に比例して増える(1台あたり約1回/秒)。
- Workersの無料枠(1日10万リクエスト)を、端末4台以上で超える(3秒間隔で1台あたり28,800回/日)。

### 検討する選択肢
- Cloudflare側の共有キャッシュ(短いTTL)
- push(WebSocket・SSE・Durable Objectsなど)
- 条件付きリクエスト(ETag/304)
- 問い合わせの統合

### 目標
- 固定表示とグループ切替を数秒以内に反映すること。
- 全端末が同時刻に同じスライドを出す同期を保つこと。
- CMSの負荷とWorkersのリクエスト数が端末の台数に比例しない、または許容範囲に収まること。

## Requirements

### Requirement 1: 固定表示とグループ切替の反映
**Objective:** As a 実行委員, I want CMSで固定表示やグループの表示を切り替えたら、すぐに全端末へ反映されてほしい, so that 閉祭後や緊急時に、端末を操作しに行かずに案内を切り替えられる

#### Acceptance Criteria
1. When 実行委員が固定表示の選択または解除を保存する, the Signage Page shall 保存からおよそ3秒以内に、全端末の表示を切り替える
2. When 実行委員がグループの表示の切り替え、グループの所属スライドの変更、またはグループの削除を保存する, the Signage Page shall 表示対象から外れたスライドを保存からおよそ3秒以内に外し、表示対象に加わったスライドを保存から数秒以内に表示する
3. When スライドの無効化や削除によって、固定表示がCMSで自動的に解除される, the Signage Page shall 実行委員が解除を保存した場合と同じ時間内に、表示を切り替える
4. The Signage Page shall 固定表示とグループの表示状態の反映を、テロップやスライドの中身など他のデータの更新の反映を待たずに行う
5. When 非表示だったサイネージ画面が表示状態に戻る、または通信が途絶えた後に回復する, the Signage Page shall 回復から数秒以内に、最新の固定表示とグループの表示状態に追いつく

### Requirement 2: 全端末の同期
**Objective:** As a 来場者, I want 会場のどの端末でも同じ時刻に同じスライドが出ていてほしい, so that 複数の画面が並ぶ場所でもばらばらに見えない

#### Acceptance Criteria
1. The Signage Page shall 同じ内容を表示している全端末(配信PCを含む)で、画面の大きさ・向き・表示を始めた時刻に関わらず、同じ時刻に同じスライドを表示する
2. The Signage Page shall 端末の時計のずれに依らず、配信元の時刻に合わせた現在時刻で、時計の表示とスライド・テロップの切り替えを行う
3. While 固定表示またはグループの表示状態の変更が各端末へ反映される途中である, the Signage Page shall 端末間の表示の食い違いを、Requirement 1で定めた反映時間の範囲内に収める
4. When 端末が起動した直後、または通信の回復直後である, the Signage Page shall 他の端末と同じスライドを表示する状態に、数秒以内に揃える

### Requirement 3: 端末の台数に対する負荷
**Objective:** As a 実行委員, I want 端末を増やしても公式サイトやCMSが止まらないようにしたい, so that 開催中に必要な台数のサイネージを置ける

#### Acceptance Criteria
1. The Signage Page shall 固定表示とグループの表示状態の確認のためにCMSへ届く問い合わせの数を、端末の台数に比例させない
2. While Workersを有料プランで契約している開催期間(2026-10-23〜11-22頃)である, the Signage Page shall 10台未満の端末(配信PCを含む)を開催期間中に終日表示し続けたときのWorkersのリクエスト数とCPU時間を、公式サイトの来場者のアクセスと合わせて、有料プランに含まれる量(月1,000万リクエスト・3,000万CPU ms)に収める
3. The Signage Page shall 有料プランの基本料金に含まれないCloudflareのサービスを新たに使わずに、反映と同期を行う
4. If CMSへの問い合わせに失敗し続ける, then the Signage Page shall 端末からの要求やCMSへの問い合わせを、失敗していないときより増やさない

### Requirement 4: 障害時の表示
**Objective:** As a 来場者, I want 通信やCMSに障害があっても画面が乱れないでほしい, so that いつでも案内を読める

#### Acceptance Criteria
1. If 固定表示またはグループの表示状態の確認に失敗する, then the Signage Page shall 直前の状態のまま表示を続け、画面にエラーを表示しない
2. If 配信元の時刻を取得できない, then the Signage Page shall 直前に取得した時刻のずれを使って、表示と切り替えを続ける
3. When 確認が再び成功する, the Signage Page shall 再読み込みなしに、最新の状態の表示に戻る

### Requirement 5: 既存の振る舞いの維持
**Objective:** As a 実行委員, I want 通信方式を変えても、サイネージのこれまでの表示と保護が変わらないでほしい, so that 運用手順を変えずに済む

#### Acceptance Criteria
1. The Signage Page shall 表示対象でないスライドの中身を、サイネージ画面へ配信しない
2. The Signage Page shall 画面とAPIへの要求を、認証を通った端末・配信PCからのものだけ受け付け、認証を通っていない要求ではWorkerを起動させない
3. The Signage Page shall テロップ・スライドの中身など、固定表示とグループの表示状態以外の更新を、これまでどおり数十秒以内に表示へ反映する
4. The Signage Page shall 実行委員による固定表示とグループの操作の手順と画面を、変えずに使えるようにする

