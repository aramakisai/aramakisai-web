# Requirements Document

## Project Description (Input)
ODPT(公共交通オープンデータセンター)が CC BY 4.0 で公開する関越交通バスの時刻表 GTFS とリアルタイム情報 GTFS-RT を使い、群馬大学荒牧周辺のバス停の発車案内をデジタルサイネージとホームページに表示する。ホームページへの掲載は WBS「既存ご案内ページにバス時刻表を追記」(issue #89: 前橋駅行の分単位時刻表と経由記号の凡例、関越交通HPへのリンク。去年は /2025/welcome/ に掲載。デジタルサイネージでも同じデータを使う)を含む。

## Introduction

会場最寄りのバス停(群馬大学荒牧・前橋自動車教習所前)から出る関越交通バスの情報を、来場者が会場のサイネージとホームページで確認できるようにする。データ源は ODPT が公開する関越交通バスの 2 つのデータセットとする。

- 時刻表: `kan_etsu_transportation_all_lines`(GTFS/GTFS-JP、CC BY 4.0)
- リアルタイム情報: `odpt_kan_etsu_transportation_all_lines`(GTFS-RT、CC BY 4.0)

各画面に載せるものは次のとおり。

- **サイネージ**: 発車案内のデータ源を、リポジトリに同梱している時刻表(2024-06-01 改正・土日祝のみ)から ODPT に切り替え、遅れを反映する
- **アクセスページ(`/access`)**: CMS の固定ページをやめて専用のページに置き換え、時刻表を載せる。今の本文はサイト設定から編集できるようにする
- **トップページ**: アクセスの節に、時刻表どおりの方面ごとの次の便の案内を出す。出典は 1 行の簡易表示とし、前橋駅から次に発車する群馬大学方面の便を 1 行で出す
- **群馬大学行**: 前橋駅から会場へ向かう便を、アクセスページの時刻表とトップページの 1 行表示で出す

リアルタイム情報(遅れ)を使うのはサイネージだけとし、ホームページ(トップページ・アクセスページ)は時刻表だけで表示する。

調査で確かめた事実:

- 時刻表 GTFS には「群馬大学荒牧」(`200273_01`)と「前橋自動車教習所前」(`200722_01`・`200722_02`)の停留所、「22A 前橋渋川線」などの路線が含まれる
- 時刻表 GTFS の運行日区分は「平日」「土曜」「日祝」の 3 つ
- 時刻表 GTFS は版ごとに有効期間を持つ。2026-09-19 版の有効期間は 2026-09-19〜2027-09-18、2026-11-16 版は 2026-11-16〜2027-11-15
- 時刻表 GTFS は約 2.3MB の zip で、展開すると停車時刻のファイル(`stop_times.txt`)だけで約 9.8MB ある
- リアルタイム情報の便 ID は時刻表 GTFS の `trip_id` と同じ形式。2026-10-30(金)19 時台の取得では、荒牧の停留所を通る前橋渋川線 6 便が含まれていた。2026-10-31(土)11 時台の取得では、荒牧の停留所を通る土曜ダイヤの便 5 便(22A・22B・22L)が含まれていた。日祝の便は未確認
- どちらのデータも、ODPT の開発者登録をしなくても `api-public.odpt.org` から取得できた。応答には `Access-Control-Allow-Origin: *` が付いており、ブラウザから直接取得できる。リアルタイム情報の応答は 1〜2KB 程度で、`Cache-Control: no-store`
- ODPT のセンター利用規約は、センターが API へのアクセス頻度を制限できること、センターに相当の負荷をかけた利用者の利用を停止できることを定めている
- ODPT の開発者ガイドラインは、動的データの生成時刻・静的データの取得日時、ODPT のデータを使っていること、データの正確性を保証しないこと、問い合わせ先を利用者に示すよう求めている。静的データは、ODPT が更新を通知してから 1 週間以内に反映するよう求めている。ただしガイドラインの対象は「公共交通オープンデータ基本ライセンスに基づき提供されるデータ」で、CC BY 4.0 で提供される関越交通のデータには及ばない。センターの利用規約は、データ提供者が指定したライセンスに則って利用するよう求めている
- Cloudflare Workers では、静的アセットへのリクエストは Worker を起動せず、無料で回数の制限も無い。`frontend/wrangler.toml` には静的アセットより先に Worker を起動させる設定(`run_worker_first`)が無い

## Boundary Context
- **In scope**:
  - ODPT の時刻表・リアルタイム情報の取得
  - サイネージの発車案内のデータ源を ODPT に切り替えること
  - `/access` の専用ページへの置き換えと時刻表の掲載(issue #89)
  - `/access` の本文とトップページのアクセスの案内文をサイト設定へまとめること
  - トップページのアクセスの節への次の便の案内の追加
  - 前橋駅から会場へ向かう群馬大学行の便の時刻表の掲載
  - 出典・ODPT のガイドラインが求める表示
- **Out of scope**:
  - 関越交通以外の事業者
  - 高速バス
  - 乗換検索・経路案内
  - 車両の位置の地図表示
- **Adjacent expectations**:
  - サイネージの発車案内の画面構成(方面ごとの行、系統・行先・発車時刻・残り分数・発車バス停)は現行の `signage-bus-info.tsx` を引き継ぐ
  - `/access` は開催前フェーズでも公開するパスとして `frontend/src/lib/phase.ts` に登録済み。置き換え後も同じ扱いとする

## Requirements

### Requirement 1: 時刻表の取得
**Objective:** As a 実行委員, I want ダイヤ改正があっても正しい時刻表が使われてほしい, so that 古い時刻を案内しないで済む

#### Acceptance Criteria
1. The Bus Departure Service shall ODPT が公開する関越交通バスの時刻表 GTFS から、群馬大学荒牧と前橋自動車教習所前を発車する便を取り出す
2. The Bus Departure Service shall 表示する日付が有効期間に含まれる版の時刻表 GTFS を使う
3. The Bus Departure Service shall 表示する日付の運行日区分(平日・土曜・日祝)に該当する便だけを対象にする
4. The Bus Departure Service shall 閲覧者・サイネージ端末が時刻表を得るたびに Cloudflare Workers を起動しない形で、時刻表を配る
5. When ODPT が時刻表 GTFS の新しい版を公開する, the Bus Departure Service shall 公開から 1 週間以内に新しい版を反映する
6. The Bus Departure Service shall 行先が群馬大学荒牧の便(前橋自動車教習所前を発車し、次の群馬大学荒牧で終点となる便)を取り出さない。会場付近から帰る来場者は乗らないため

### Requirement 2: リアルタイム情報の反映
**Objective:** As a 来場者, I want バスの遅れを反映した発車予定を知りたい, so that バス停で長く待たずに済む

#### Acceptance Criteria
1. The Bus Departure Service shall サイネージ端末のブラウザから ODPT のリアルタイム情報を直接取得し、Cloudflare Workers を介さない
2. When リアルタイム情報に対象の便の遅れが含まれる, the Bus Departure Service shall 時刻表の発車時刻に遅れを加えた発車予定を求める
3. While 対象の便のリアルタイム情報が無い, the Bus Departure Service shall 時刻表の発車時刻を発車予定とする
4. If リアルタイム情報を取得できない, then the Bus Departure Service shall 時刻表の発車時刻で発車案内を続ける
5. The Bus Departure Service shall 発車予定が遅れを反映したものか時刻表どおりのものかを区別できる形で返す
6. While 画面が表示されていない(ブラウザのタブが裏にある等), the Bus Departure Service shall リアルタイム情報を取得しない
7. The Bus Departure Service shall ODPT にかける負荷を抑えるため、リアルタイム情報を取得する間隔に下限を設ける
8. The Website shall ホームページ(トップページ・アクセスページ)ではリアルタイム情報を取得・使用せず、時刻表だけで表示する

### Requirement 3: サイネージの発車案内
**Objective:** As a 来場者, I want 会場のサイネージで次のバスを知りたい, so that 帰りのバスに間に合うよう動ける

#### Acceptance Criteria
1. The Signage Screen shall 方面(前橋駅方面・渋川駅方面)ごとに、次に発車する便を現行の画面構成で表示する
2. When 便の発車予定時刻を過ぎる, the Signage Screen shall 再読み込みなしで次の便へ表示を進める
3. Where 発車予定に遅れが反映されている, the Signage Screen shall 遅れていることを表示する
4. If 方面の当日の便がすべて発車済み, then the Signage Screen shall その方面に本日の運行が終了したことを表示する

### Requirement 4: アクセスページ
**Objective:** As a 来場予定者, I want 事前にホームページでバスの時刻を確かめたい, so that 来場と帰りの計画を立てられる

#### Acceptance Criteria
1. The Website shall `/access` を、CMS の固定ページではなく、時刻表を組み込んだ専用のページとして表示する
2. The Website shall アクセスページに、前橋駅行の便の発車時刻を時ごとに分を並べた時刻表として掲載する
3. The Website shall 時刻表に、便ごとの経由・行先の違いを表す記号とその凡例を表示する
4. The Website shall 開催日の運行日区分に該当する時刻表を掲載する
5. The Website shall 関越交通の公式サイトへのリンクを表示する
6. The Website shall 現在 CMS の固定ページ `access` にある本文(道順・地図の埋め込みを含む)を、サイト設定で編集した内容としてアクセスページに表示する
7. When 実行委員がサイト設定でアクセスページの本文を変更する, the Website shall 再デプロイなしで変更をアクセスページに反映する
8. The Website shall トップページのアクセスの節の案内文(現在 `frontend/src/lib/venue.ts` の `ACCESS_SUMMARY` に固定)を、アクセスページの本文と同じくサイト設定で編集した内容として表示する
9. The Website shall アクセスページに、要件 5 と同じ方面ごとの次の便の案内(時刻表どおりの発車時刻)を、時刻表の前に表示する

### Requirement 5: トップページの次の便の案内
**Objective:** As a 来場者, I want トップページを開くだけで次のバスを知りたい, so that アクセスページまで探しに行かずに済む

#### Acceptance Criteria
1. The Website shall トップページのアクセスの節に、方面ごとの次の便(系統・行先・時刻表の発車時刻・発車バス停)を表示する
2. When 時刻表の発車時刻を過ぎる, the Website shall 再読み込みなしで次の便へ表示を進める
3. If 方面の当日の便がすべて発車済み, then the Website shall その方面に本日の運行が終了したことを表示する

### Requirement 6: 出典とガイドラインが求める表示
**Objective:** As a 実行委員, I want ライセンスと ODPT のガイドラインの条件を満たして掲載したい, so that データ提供元との約束を守れる

#### Acceptance Criteria
1. The Bus Departure Service shall アクセスページに、ODPT の FAQ が示す「改変して利用する場合」の形式で出典を添える(この【作品・アプリ・データベース等】は、以下の著作物を改変して利用しています。【コンテンツ等の提供者名】、【コンテンツ等の名称】、クリエイティブ・コモンズ・ライセンス　表示4.0国際(https://creativecommons.org/licenses/by/4.0/deed.ja))
2. The Bus Departure Service shall 提供者名を、ODPT のデータカタログの各データセットのページに記載された組織名(関越交通株式会社)とする
3. The Bus Departure Service shall アクセスページに、ODPT のデータを使っていること、データの正確性を保証しないこと、問い合わせ先として実行委員会の問い合わせページ(`/contact`)を示す
4. The Bus Departure Service shall 時刻表のデータを取得した日時を表示する
5. The Signage Screen とトップページの次の便の案内 shall 発車案内の中に 1 行の短い出典「データ: 関越交通(CC BY 4.0)・公共交通オープンデータセンター」を表示し、6.1・6.3・6.4 の全文はアクセスページで示す(CC BY 4.0 が認める、媒体に応じた表示。サイネージは既存の QR から公式サイトへ、トップページはアクセスの節の既存のリンク「アクセス詳細へ」からアクセスページへ誘導する)

### Requirement 7: 群馬大学行の便
**Objective:** As a 来場予定者, I want 前橋駅から会場へ向かうバスの時刻を知りたい, so that 来場の計画を立てられる

#### Acceptance Criteria
1. The Bus Departure Service shall 時刻表 GTFS から、前橋駅 2番のりば(`200718_02`、南橘・群大・渋川方面)を発車し、群馬大学荒牧または前橋自動車教習所前に停車する便を、前橋駅の発車時刻と降車する停留所(群馬大学荒牧に停まる便は群馬大学荒牧、それ以外は前橋自動車教習所前)とともに取り出す
2. The Website shall アクセスページに、開催日の運行日区分に該当する前橋駅発 群馬大学方面の時刻表を、前橋駅の発車時刻と降車する停留所とともに掲載する
3. The Website shall トップページのアクセスの節に、前橋駅から次に発車する群馬大学方面の便を 1 行で表示する

## 未確定事項
- 日祝の便がリアルタイム情報に含まれるか(2026-11-01 に実測予定)
