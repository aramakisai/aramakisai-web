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
<!-- Will be generated in /kiro-spec-requirements phase -->
