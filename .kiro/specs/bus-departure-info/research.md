# Research & Design Decisions

## Summary
- **Feature**: `bus-departure-info`
- **Discovery Scope**: Complex Integration(外部オープンデータの取り込み + 既存サイネージ・トップページ・固定ページの改修 + CMS のデータ移行)
- **Key Findings**:
  - 時刻表 GTFS は約 2.3MB の zip で、ブラウザで扱う大きさではない。対象 2 停留所の発車だけを抜き出せば、コミットできる大きさの JSON になる
  - リアルタイム情報はブラウザから直接取得できる(`Access-Control-Allow-Origin: *`、1〜2KB)。更新はおよそ 26〜36 秒ごと
  - 運行日の区分は「平日・土曜・日祝」だけではない。`calendar_dates.txt` による例外(祝日・年末年始・特別ダイヤ)があるため、曜日ではなく GTFS の運行日定義どおりに判定する必要がある

## Research Log

### ODPT のデータセットとアクセス
- **Context**: データ源と取得経路の確定
- **Sources Consulted**:
  - https://ckan.odpt.org/dataset/kan_etsu_transportation_all_lines
  - https://ckan.odpt.org/dataset/odpt_kan_etsu_transportation_all_lines
  - 実際の取得(2026-10-30)
- **Findings**:
  - 時刻表: `https://api-public.odpt.org/api/v4/files/odpt/Kan_etsuTransportation/AllLines.zip?date=YYYYMMDD`。302 で Azure Blob の署名付き URL へ転送される。転送先にも `Access-Control-Allow-Origin: *` が付く
  - データセットには版ごとのリソースが並ぶ。2026-10-30 時点では 20260919 版(有効期間 2026-09-19〜2027-09-18)と 20261116 版(2026-11-16〜2027-11-15)の 2 つ
  - リアルタイム情報: `https://api-public.odpt.org/api/v4/gtfs/realtime/odpt_Kan_etsuTransportation_AllLines_{trip_update|vehicle|alert}`。`Cache-Control: no-store`。OPTIONS は 404 だが、単純な GET なのでプリフライトは発生しない
  - ライセンスはどちらも CC BY 4.0
- **Implications**: 時刻表はビルド前に抜き出してリポジトリに置く。リアルタイム情報はブラウザから直接取りに行く

### 時刻表 GTFS の内容(20260919 版で確認)
- **Context**: 抜き出す条件と表示に使う項目の確定
- **Findings**:
  - 停留所: 群馬大学荒牧 `200273_01`、前橋自動車教習所前 `200722_01`(渋川方面)・`200722_02`(前橋方面)
  - `direction_id`: 1 = 前橋方面、0 = 渋川方面(行先の分布で確認)
  - 対象停留所を発車する便の運行日区分(`service_id`): 平日 172 件、土曜 101 件、日祝 101 件、年末・年始 101 件、特別ダイヤ１ 101 件。2026-11-14(土)は土曜、2026-11-15(日)は日祝。祝日は `calendar_dates.txt` で平日を外し日祝を足す形で表される
  - `pickup_type=1`(乗車不可)の停車が 48 件ある。群馬大学荒牧を終点とする便(22G・22H・22K・22M の一部)がこれに当たる
  - `stop_headsign` が設定されている。便の行先(`trip_headsign`)とは別に、その停留所で掲げる行先がある(例: 便の行先「渋川市内循環右回り」が教習所前では「前橋駅」)
  - 行先の表記は「前橋駅（群馬大学荒牧 経由）」のように、全角括弧の中に経由地が入る
  - 系統は `routes.txt` の `route_long_name`(例: 「22A 前橋渋川線」)の先頭に入っている。`route_short_name` は空
  - 発車時刻の最大は 23:13。24 時を超える時刻は無い
  - `feed_info.txt` の `feed_version` に「※一般のバス利用者への案内利用はバス会社に公開許可を得ましょう。」とある(作成ツール「その筋屋」の付記)
- **Implications**: 抜き出し条件は「対象停留所」かつ「乗車できる停車」。行先は `stop_headsign` を優先し、括弧の中を経由として分ける。運行日は `calendar.txt` と `calendar_dates.txt` で判定する

### リアルタイム情報の内容と更新間隔
- **Context**: 遅れと発車済みの判定、取得間隔の下限
- **Findings**:
  - 便 ID は時刻表の `trip_id` と同じ(例: `平日_18時20分_系統268`)
  - TripUpdates: 1 便につき `stop_time_update` が 1 件で、`stop_sequence` と `arrival.delay`(秒)が入る
  - VehiclePosition: `current_stop_sequence` と `current_status`(2 = IN_TRANSIT_TO)、位置、時刻が入る
  - ヘッダーの `timestamp`(生成時刻)は 2 フィードとも 26〜36 秒ごとに変わる(2026-10-30 20:19〜20:23 に 15 秒間隔で 16 回取得)
  - 2026-10-30(金)19 時台の取得では、荒牧の停留所を通る前橋渋川線 6 便が含まれていた。2026-10-31(土)11 時台の取得では土曜ダイヤの 5 便(22A・22B・22L)が含まれていた。日祝は 2026-11-01 に取得して確認する
- **Implications**: 取得間隔の下限は 30 秒とする。発車済みかどうかは、車両の現在の停車順(`current_stop_sequence`)と対象停留所の停車順を比べて決める

### ODPT の規約とガイドライン
- **Sources Consulted**:
  - https://developer.odpt.org/terms/center_use_rules.html
  - https://developer.odpt.org/terms/data_basic_use_guideline.html
  - https://developer.odpt.org/ja/faq-info#cc-by-credit
- **Findings**:
  - センターはアクセス頻度を制限でき、相当の負荷をかけた利用者の利用を停止できる
  - ガイドラインは次を求める: 動的データの生成時刻の表示、更新間隔に合わせた画面の更新、古い動的データを出さないこと、静的データの取得日時の表示、更新通知から 1 週間以内の静的データ反映、ODPT のデータを使っている旨、正確性を保証しない旨、問い合わせ先
  - ガイドラインの対象は「公共交通オープンデータ基本ライセンスに基づき提供されるデータ」(ガイドライン 1. 概要)。CC BY 4.0 の関越交通のデータは対象外で、センターの利用規約は「当該データに対してデータ提供者が指定したライセンスに則って利用すること」を求める
  - CC BY の表記例は FAQ の「改変して利用する場合」の形式
- **Implications**: 取得は画面が見えている間だけ、30 秒以上の間隔で行う。古い(生成から時間が経った)リアルタイム情報は使わない

### Cloudflare の費用
- **Sources Consulted**: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations
- **Findings**: 静的アセットへのリクエストは Worker を起動せず、無料で回数の制限も無い。`frontend/wrangler.toml` に `run_worker_first` は無い
- **Implications**: 時刻表はクライアント側の JS(静的アセット)に含めるか、ページの描画時にサーバーで使う。時刻表の取得のために API ルートを新設しない

### 既存コードとの統合点
- **Findings**:
  - サイネージ: `signage-screen.tsx` が 1 秒ごとの補正済み時刻(`useCorrectedNow`)で `nextDepartures(BUS_TIMETABLE, now, 1|2)` を計算し、`SignageBusInfo` と `SignageTouchLayer` に渡す。`bus-departures.ts` を import しているのは `bus-timetable-data.ts`・`signage-screen.tsx`・`signage-bus-info.tsx`・`signage-touch-layer.tsx`・`bus-departures.test.ts` だけ
  - 定期取得: `lib/use-polling.ts` が、画面が隠れている間の停止・復帰時の即時取得を持つ
  - ブラウザから外部 API を直接取得している前例は無い。CSP の設定は無い
  - トップページの `AccessSection` はサーバーコンポーネントで、開催中(`live`)フェーズにだけ描画される
  - `/access` は CMS の `pages`(slug `access`)を `(site)/[slug]/page.tsx` で描画している。ナビゲーション(CMS グローバル `navigation`)は `pages` を relationship で参照でき、`link_type` に `path` もある
  - `site_settings` の richText は `lexicalHTMLField` で HTML を DB に保存しているが、`richTextHTMLConverters` を渡していない。`pages` は渡している
  - データをテーブル間でコピーするマイグレーションの前例: `20261013_172130_site_settings_and_cleanup_a.ts`(`INSERT ... SELECT`)
  - `cms-schema-check` はトップレベルの名前付きフィールドだけを見るため、`site_settings`(全項目がタブの中)の変更は検出しない
  - `frontend/package.json` に protobuf・zip・CSV の依存は無い。外部データを取得して生成物をコミットする前例は地図タイル(`frontend/scripts/fetch-map-tiles.ts`、`pnpm exec tsx`)
  - 定期実行(cron)のワークフローは無い。自動で PR を作る前例は `cms-ci.yml` の `release` ジョブ(GitHub App のトークン、既存 PR があれば作らない)

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 時刻表をビルド時に取得 | `next build` の前に ODPT から取得して抜き出す | 生成物をコミットしなくて済む | ODPT が落ちているとデプロイが失敗する。新しい版が出てもデプロイが起きない | 不採用 |
| 時刻表を抜き出してコミット + 定期 PR | スクリプトで抜き出した JSON をコミットし、定期ワークフローが差分を PR にする | 差分をレビューできる。デプロイが ODPT に依存しない | 反映に PR のマージとデプロイが要る | **採用** |
| 時刻表を Worker で配信 | API ルートが ODPT から取得・キャッシュして返す | 常に最新 | 閲覧のたびに Worker が起動する(1.4 に反する) | 不採用 |
| リアルタイム情報をブラウザから直接取得 | 各ブラウザが ODPT を取得する | Worker の起動が無い | ODPT への問い合わせが閲覧者数に比例する | **採用**(2.1)。間隔の下限と非表示時の停止で抑える |
| リアルタイム情報を Worker 経由 | Worker がキャッシュして配る | ODPT への問い合わせが一定 | 閲覧者の取得ごとに Worker が起動する | 不採用(ユーザー判断) |
| protobuf のデコードにライブラリ | `protobufjs` / `gtfs-realtime-bindings` | 全項目を扱える | 数十 KB の依存をクライアントに載せる | 不採用 |
| protobuf のデコードを自前で | 使う項目だけを読む小さなデコーダ | 依存なし、数 KB | 使う項目の追加は自分で書く | **採用** |

## Design Decisions

### Decision: 発車済みの判定を車両の停車順で行う
- **Context**: 要件 5.2(遅れている便は発車するまで表示し続ける)
- **Alternatives Considered**:
  1. 発車予定時刻(時刻表 + 遅れ)を過ぎたら発車済みとする
  2. 車両の現在の停車順が対象停留所より先なら発車済みとする
- **Selected Approach**: 2 を優先し、車両の情報が無いときは TripUpdates の停車順、それも無いときは 1 にする
- **Rationale**: 遅れの値は直前の停留所での推定であり、実際の発車より早く時刻を過ぎることがある
- **Trade-offs**: 車両の情報が途切れると時刻での判定に戻る
- **Follow-up**: 土日の実測で、対象の便が入っているかを確かめる

### Decision: サイネージとトップページで同じ計算を使う
- **Context**: 要件 3 と要件 5 はどちらも方面ごとの次の便を出す
- **Selected Approach**: 次の便の計算(`nextBusDepartures`)を 1 つにし、両方から使う
- **Rationale**: 計算が分かれると、同じ時刻に違う便を出すことになる
- **Trade-offs**: サイネージでも、遅れている便は車両が発車するまで残る(3.2 の「発車予定時刻」は遅れ込みの時刻なので、ほぼ同じ挙動になる)

### Decision: アクセスページの本文とトップの案内文をサイト設定の新しいタブに置く
- **Context**: 要件 4.6〜4.8
- **Selected Approach**: `site_settings` に「アクセス」タブを足し、`pages` の `access` の内容をマイグレーションでコピーしたうえで、`pages` の `access` を削除する。ナビゲーションの参照はパス `/access` に置き換える
- **Rationale**: 専用ページにした後も `pages` に `access` が残ると、編集しても表示に出ない行ができる
- **Trade-offs**: ナビゲーションの `page` 参照を書き換えるマイグレーションが要る

## Risks & Mitigations
- 土日の便がリアルタイム情報に入らない → 時刻表どおりの時刻で案内する(2.3)。実測結果で確定させる
- ODPT がアクセスを制限・停止する → 取得に失敗しても時刻表で案内を続ける(2.4)
- 新しい版の反映が遅れる → 毎日の定期ワークフローで PR を作る
- 関越交通が掲載を認めない → 運用上の確認事項。問い合わせ文面は作成済み

## References
- ODPT データカタログ(関越交通バス): https://ckan.odpt.org/dataset/kan_etsu_transportation_all_lines
- GTFS Realtime Reference: https://gtfs.org/realtime/reference/
- ODPT 開発者ガイドライン: https://developer.odpt.org/terms/data_basic_use_guideline.html
