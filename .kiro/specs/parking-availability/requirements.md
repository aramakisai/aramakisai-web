# Requirements Document

## Project Description (Input)

来場者向けに駐車場の空き情報を表示する機能を実装する。

### 外観

- 駐車場ごとの空き情報を一覧表示する

### 機能

- Google Forms / Discord その他の投稿システムから空き情報を更新する
- 表示をリアルタイムに更新する

### 技術的懸念

Cloudflare Workers 上で動くフロントエンドがリアルタイム更新に対応できるか未検証。実装着手前に、更新の伝達方式を確定させる技術検証を行う。

検証すべき選択肢:

- ポーリング (数十秒間隔での再取得)
- Server-Sent Events / WebSocket (Durable Objects が必要になる可能性)
- Cloudflare KV や Durable Objects を経由した状態保持

### 関連 spec

他の spec との依存はない。単独で着手できる。ただし更新方式の技術検証が先行する。

`digital-signage` がリアルタイム更新の仕組みを必要とするため、本 spec で採用した方式を再利用できる可能性がある。

### 未確定事項

- 空き情報の入力経路 (Google Forms、Discord Bot、Payload の管理画面のいずれか)
- 空き情報を Payload のコレクションとして持つか、別のストア (KV など) に置くか
- 「リアルタイム」の許容遅延 (数秒か、1 分程度か)
- 駐車場マスタを `campus-map` の Map Areas と共有するか、独立したコレクションにするか

## Introduction

来場者が来場前・来場中に、駐車場ごとの空き状況をスマートフォンで確認できるようにする。運営スタッフが現場から更新した内容が、数十秒以内に来場者の画面へ反映される。

## 事前調査の結果 (要件の根拠)

- **現行の取得方式**: `frontend/src/lib/cms.ts` の公開 GET は Workers の Cache API に `s-maxage=60` で保持される。Cache API の内容はデータセンター間で複製されず、`cache.delete` も呼び出したデータセンターにしか効かない (Cloudflare 公式 Cache API ドキュメント)。したがって「更新時に即パージ」は成立せず、反映遅延は TTL の長さで決まる。`timetable` ページは `force-dynamic`、`layout.tsx` は `revalidate = 60`。
- **権限**: `cms/src/access/roles.ts` のロールは `executive` と `student_exhibitor` のみ。`policy.ts` の `canUpdate` は未知のコレクションに対し実行委員のみ true。公開読み取りは `PUBLISHED_FILTER` に無いコレクションなら未認証でも全件可。学生団体は管理画面でも `EXHIBITOR_VISIBLE` 以外は見えない。Authentik OIDC でログインする。
- **マップ資産**: `map_areas` は GeoJSON 図形・色・AED・トイレ・表示順を持つ構内マップ用。`map_points` は種別 (ごみステーション/受付) と緯度経度のみ。駐車場は台数・状態という性質の異なる属性を持つ。
- **更新方式の比較 (公式ドキュメント)**:
  - Workers KV はグローバルに最大 60 秒以上の遅延があり、同一キーへの高頻度書き込みに不向き。許容遅延の目安 (数十秒) に対して不適。
  - SSE/WebSocket は Durable Objects (Hibernation WebSocket API) が必要。接続数に応じた課金・運用が発生し、数十秒許容の用途には過剰。
  - クライアント側ポーリングは追加インフラ不要で、既存の CMS + エッジキャッシュ構成のまま許容遅延を満たせる。
- **事例調査**: 学園祭の駐車場空き情報の入力経路について、公開された運用事例は検索で確認できなかった。入力経路は事例ではなく、現行の認証・権限基盤との整合性を根拠に推奨する。
- **digital-signage との共用**: digital-signage は「コレクション更新で画面更新」を要求しており、同じポーリング方式 (対象コレクションを短い TTL で再取得) をそのまま使える。

## Boundary Context

- **In scope**: 駐車場ごとの空き状況の一覧表示、スタッフによる更新、更新の来場者画面への反映、駐車場データの保存。
- **Out of scope**: 駐車台数の管理・自動計測、予約、経路案内、PUSH 通知、更新履歴の分析。
- **Adjacent expectations**: 構内マップ上への駐車場表示は本 spec の範囲外 (マスタは独立コレクションで確定済み)。digital-signage は本 spec の更新方式を再利用できること。

## 確定事項

- **入力経路**: Payload 管理画面。
- **更新者**: 実行委員のみ。学生団体ロールは更新しない。ロール拡張は行わない。
- **空き状況の表現**: 3 段階 (空き / 混雑 / 満車) を必須とする。台数は扱わない。
- **保存先**: Payload の新規コレクション `parking_lots`。
- **駐車場マスタ**: `map_areas` と共有せず独立コレクション。
- **公開の切替**: 開催当日以外は使わないため、実行委員が管理画面で公開/非公開を切り替える (既定は非公開)。本番以外の環境 (PR プレビュー・ローカル) では切替に関わらず表示し、動作確認できるようにする。
- **古い情報の扱い**: 最終更新から 30 分を超えた駐車場に「情報が古い可能性」を表示する。
- **更新方式**: クライアント側ポーリング。エッジキャッシュ TTL 20 秒、クライアントの再取得間隔 20 秒 (根拠は次節)。

## 間隔の根拠 (CMS 負荷の概算)

**CMS の処理能力 (`aramakisai-infra/gitops/manifests/prod/cms/`)**
- Deployment は replicas 1、requests は CPU 250m / メモリ 256Mi、limits は CPU 2000m / メモリ 512Mi。DB (CloudNativePG) も instances 1。
- 単一ノードの空きメモリは 1.2Gi 程度で、更新は Recreate (旧 pod 停止後に新 pod 起動) で行う。冗長性はない。
- 公開 REST 1 件あたりの処理時間は未計測。保守的に CPU 50ms/件と仮置きすると、requests 相当 (250m) で約 5 req/s、limits 相当で約 40 req/s。

**CMS への到達リクエスト数の式**
- クライアントのポーリングは Workers の `/api` 相当のルートに向け、CMS へは直接向けない。
- `frontend/src/lib/cms.ts` の Cache API はデータセンター単位で、内容は複製されない。よって CMS に届くのは、キャッシュを持つ拠点が TTL ごとに 1 回取りに来る分で、来場者数には比例しない。
- 概算式: `CMS 到達 req/s ≈ 拠点数 N × 同時ミス係数 k ÷ TTL`
- 前提: 国内来場者の経由拠点 N = 5 (広めに見積もり)。同一拠点内で TTL 切れ直後に複数 isolate が同時に取りに行く重複 k = 3。取得対象は `parking_lots` 1 URL。
- TTL 20 秒で 5 × 3 ÷ 20 = 0.75 req/s。requests 相当の処理能力 (約 5 req/s) の 15%、limits 相当の 2% 未満。TTL 10 秒でも 1.5 req/s で収まるが、遅延短縮の効果に対して負荷が倍になるため採らない。
- 他ページの取得 (TTL 60 秒) とは別 URL で、この負荷は加算になる。それでも余裕がある。

**遅延の見積もり**
- 反映までの最悪値 ≒ TTL + クライアント間隔 + 往復 = 20 + 20 + 数秒 ≒ 約 45 秒、平均は約 20 秒。
- 許容は「1 分は嫌、厳密でない」のため 60 秒未満を満たす。TTL 30 秒 + 間隔 30 秒では最悪値が 60 秒を超えるため採らない。
- TTL と間隔を 20 秒より長くしても CMS 負荷の減少は 0.75 req/s 未満で、削る意味が小さい。

**CMS 以外のコスト (要確認)**
- 同時閲覧が 500 件ならポーリングで Workers に約 25 req/s (約 90,000 req/時)。CMS 負荷は変わらないが、Workers のリクエスト課金枠はクライアント数に比例する。契約プランの枠内かを設計フェーズで確認する。
- 非表示タブでは停止するため、実際の負荷はこれより小さい。

**事前調査の事実 (更新方式の比較)**
- Workers KV は他拠点への反映に 60 秒以上かかり得る (公式 KV ドキュメント)。許容遅延に合わない。
- SSE/WebSocket は Durable Objects (Hibernation WebSocket) が必要で、数十秒許容の用途には過剰。
- 現行の公開 GET は `cms.ts` で Cache API に `s-maxage=60`。Cache API は拠点間で複製されず、`cache.delete` も当該拠点にしか効かない (公式 Cache API ドキュメント)。したがって即時パージではなく TTL で遅延が決まる。
- digital-signage は同じポーリング方式 (対象コレクションを短い TTL で再取得) を流用できる。
- 学園祭の駐車場空き情報の入力経路について、公開された運用事例は確認できなかった。

## 決定が必要な事項

| # | 事項 | 推奨案 | 根拠 |
|---|------|--------|------|
| D1 | Workers のリクエスト枠 | 確定: 現在は Free。開催月だけ Paid に切り替える (予算上限 $10) | ポーリングはクライアント数に比例する。CMS 負荷とは別の論点 |

## Requirements

### Requirement 1: 駐車場空き情報の一覧表示
**Objective:** As a 来場者, I want 駐車場ごとの空き状況を一覧で見たい, so that 来場前・来場中に停められる駐車場を判断できる

#### Acceptance Criteria
1. When 来場者が駐車場空き情報ページを開く, the Parking Page shall 登録済みの全駐車場を表示順に一覧表示する
2. The Parking Page shall 各駐車場について名称・空き状況・最終更新時刻を表示する
3. The Parking Page shall 空き状況を色だけに依存せず文字ラベルでも判別できるように表示する
4. If 駐車場が 1 件も登録されていない, then the Parking Page shall 情報がない旨を表示する
5. The Parking Page shall スマートフォンの画面幅で横スクロールなしに閲覧できる

### Requirement 2: 空き情報の更新
**Objective:** As a 実行委員, I want 現場からスマートフォンで空き状況を更新したい, so that 来場者へ最新の状況を伝えられる

#### Acceptance Criteria
1. When 実行委員が駐車場の空き状況を保存する, the CMS shall 更新後の値と更新時刻を記録する
2. The CMS shall 空き状況を 空き / 混雑 / 満車 のいずれかとして必須で保持する
3. If 未認証のユーザー、または更新権限のないロールが駐車場の更新を試みる, then the CMS shall その更新を拒否する
4. The CMS shall 実行委員のみが駐車場の作成・更新・削除を行えるようにし、学生団体ロールには管理画面でも駐車場を表示せず、ロール定義は変更しない
5. The CMS shall 駐車場の公開読み取りを未認証でも許可する
6. The CMS shall スマートフォンの管理画面から 1 件の駐車場を開いて空き状況を変更し保存できる

### Requirement 3: 更新の反映
**Objective:** As a 来場者, I want ページを開いたままでも最新の空き状況に更新されてほしい, so that 再読み込みせずに判断できる

#### Acceptance Criteria
1. While 駐車場空き情報ページが表示されている, the Parking Page shall 20 秒間隔で最新の空き情報を再取得して表示を更新する
2. When 実行委員が空き状況を更新する, the Parking Service shall 更新から 60 秒以内に来場者の表示へ反映する (目安は約 45 秒以内、平均約 20 秒)
3. While ブラウザのタブが非表示である, the Parking Page shall 再取得を停止する
4. When タブが再び表示される, the Parking Page shall 直ちに最新の空き情報を再取得する
5. If 再取得に失敗する, then the Parking Page shall 直前に取得した内容と、最終取得時刻を保ったまま表示し、次回の間隔で再試行する
6. If 最終更新から 30 分を超えた駐車場がある, then the Parking Page shall 情報が古い可能性を表示する
7. The Parking Service shall 駐車場データの取得結果を 20 秒間エッジにキャッシュし、CMS オリジンへの到達リクエスト数が来場者数に比例しないようにする
8. The Parking Service shall 再取得を CMS に直接向けず、frontend 側のルートを経由させる

### Requirement 4: 更新方式の再利用性
**Objective:** As a 開発者, I want 更新の伝達方式を他機能が流用できる形にしたい, so that digital-signage で同じ仕組みを使える

#### Acceptance Criteria
1. The Parking Service shall 更新の伝達に、Durable Objects・KV・常時接続を必要としない方式を用いる
2. The Parking Service shall 再取得の間隔 (20 秒) とキャッシュの有効期間 (20 秒) を、駐車場の機能に依存しない設定値として扱う
3. The Parking Service shall 駐車場ページと同じ再取得の仕組みを、別ページから対象コレクションを変えて利用できるようにする

### Requirement 5: 運用上の制約
**Objective:** As a 実行委員, I want 既存の運用手順に沿って導入したい, so that 本番の CMS に影響を与えずに公開できる

#### Acceptance Criteria
1. When 駐車場のコレクションを追加する, the CMS shall マイグレーションを経て DB に反映する
2. The Parking Page shall Edge Runtime で動作する
3. If 公開フェーズが live 前である, then the Parking Page shall 既存の公開フェーズの制御に従って表示可否を決める
4. The CMS shall 駐車場の更新が未認証の公開 API から行えないことを自動テストで検証する

### Requirement 6: 公開の切替
**Objective:** As a 実行委員, I want 開催当日だけ駐車場空き情報を公開したい, so that 使わない期間に古い情報を見せず、リクエストも発生させない

#### Acceptance Criteria
1. The CMS shall 実行委員が管理画面で駐車場空き情報の公開/非公開を切り替えられる設定を持ち、既定を非公開とする
2. While 非公開である, the Parking Page shall 一覧を表示せず公開していない旨を表示し、再取得を行わない
3. While 非公開である, the Parking Service shall 駐車場データを返さない
4. When 表示中に非公開へ切り替わる, the Parking Page shall 次回の再取得で非公開の表示に切り替え、以降の再取得を停止する
5. Where フェーズオーバーライドが有効な環境 (PR プレビュー・ローカル開発), the Parking Page shall 切替の設定に関わらず公開時と同じ表示をする
6. The Parking Page shall 切替の変更を再デプロイなしで反映する
