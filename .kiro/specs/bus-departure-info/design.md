# Design Document

## Overview

**Purpose**: 会場最寄りのバス停(群馬大学荒牧・前橋自動車教習所前)を発車する関越交通バスの時刻と遅れを、来場者がサイネージ・アクセスページ・トップページで確認できるようにする。

**Users**: 来場者は会場のサイネージとトップページで次の便を、来場予定者はアクセスページで時刻表を見る。実行委員はアクセスの文言を CMS のサイト設定で編集する。

**Impact**:
- サイネージの発車案内のデータ源を、同梱の時刻表(2024-06-01 改正・土日祝)から ODPT の時刻表 GTFS とリアルタイム情報に切り替える
- `/access` を CMS の固定ページから専用ページに置き換える
- トップページの案内文(`ACCESS_SUMMARY`)とアクセスページの本文を、サイト設定の「アクセス」タブにまとめる

### Goals
- ODPT の時刻表から、対象停留所を発車する便を運行日どおりに取り出す(1.1〜1.3)
- 閲覧のたびに Cloudflare Workers を起動しない(1.4、2.1)
- 遅れている便は発車するまで案内に残す(5.2)
- ライセンスと ODPT のガイドラインが求める表示を全画面に出す(要件 6)

### Non-Goals
- 関越交通以外の事業者、高速バス、乗換案内、車両位置の地図表示
- 運行情報(Alert フィード)の表示
- 本番での開催前フェーズのトップページへの表示(`AccessSection` は開催中だけ描画される現行の構成を変えない)。PR のプレビュー URL とローカルでは、既存のフェーズ上書き(`NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE`、`phase-toggle.tsx`)で開催中にすれば開催前でも表示・確認できる。発車案内はその日の実際の便を使うため、開催日以外でも実データで確認できる

## Boundary Commitments

### This Spec Owns
- 時刻表の抜き出しスクリプトと、その生成物(`frontend/src/data/bus-timetable.json`)
- 時刻表の定期更新ワークフロー
- 運行日の判定、次の便の計算、GTFS-RT のデコード、リアルタイム情報の取得
- 発車案内の表示部品(サイネージ・トップページ共通)、時刻表の表示部品、出典表示の部品
- `/access` の専用ページ
- `site_settings` の「アクセス」タブと、`pages` の `access` からの移行

### Out of Boundary
- サイネージの画面全体の配置・同期(`digital-signage` / `signage-sync-transport` の範囲)。本 spec は `SignageBusInfo` の中身だけを変える
- フェーズ切替の仕組み(`frontend/src/lib/phase.ts` の公開パス一覧は変更しない)
- 関越交通への掲載許可の取得(運用作業)

### Allowed Dependencies
- ODPT の公開エンドポイント(`api-public.odpt.org`、`ckan.odpt.org`)
- 既存の `lib/use-polling.ts`、`lib/signage-time.ts`、`lib/use-now.ts`、`lib/cms.ts`、`lib/event-day.ts`(JST の日付計算)
- 新しい devDependencies: `fflate`(zip 展開)、`csv-parse`(CSV)。スクリプトだけが使い、クライアントには載せない

### Revalidation Triggers
- `bus-timetable.json` の形の変更 → サイネージ・トップページ・アクセスページの全部を確かめる
- ODPT のエンドポイントやフィードの形の変更 → 抜き出しスクリプトと GTFS-RT のデコーダを確かめる
- `site_settings` の「アクセス」タブの項目の変更 → トップページとアクセスページを確かめる

## Architecture

### Existing Architecture Analysis
- サイネージは `signage-screen.tsx`(クライアント)が補正済み時刻で毎秒 `nextDepartures(BUS_TIMETABLE, now, 1|2)` を計算する。`BUS_TIMETABLE` は手で書き起こした TS の定数
- `/access` は `(site)/[slug]/page.tsx` が CMS の `pages` を描画している
- トップページの `AccessSection` はサーバーコンポーネントで、`lib/venue.ts` の定数を表示する
- 定期取得は `use-polling.ts` が、画面が隠れている間の停止を持つ

### Architecture Pattern & Boundary Map

```mermaid
graph LR
  subgraph ODPT
    CKAN[ckan.odpt.org]
    GTFS[時刻表 GTFS zip]
    RT[GTFS-RT trip_update / vehicle]
  end
  subgraph GitHub Actions
    Cron[bus-timetable-update 毎日]
  end
  subgraph Repo
    Script[fetch-bus-timetable.ts]
    Json[bus-timetable.json]
  end
  subgraph Browser
    Hook[useBusRealtime]
    Calc[nextBusDepartures]
    Board[BusDepartureBoard]
    Sign[SignageBusInfo]
  end
  subgraph Worker
    Access[access page]
    Top[AccessSection]
  end
  CMS[site_settings アクセスタブ]

  Cron --> Script
  Script --> CKAN
  Script --> GTFS
  Script --> Json
  Json --> Calc
  Json --> Access
  Hook --> RT
  Hook --> Calc
  Calc --> Board
  Calc --> Sign
  Top --> Board
  CMS --> Access
  CMS --> Top
```

**Architecture Integration**:
- Selected pattern: 時刻表は「抜き出して JSON をコミット」、リアルタイム情報は「ブラウザから直接取得」。理由は research.md の比較表
- 既存パターンの踏襲: 定期取得は `use-polling.ts`、時刻は `useCorrectedNow`(サイネージ)と `useNow`(トップページ)、CMS の取得は `cms.findGlobal`、スクリプトは `pnpm exec tsx scripts/...`
- New components rationale: 下記 Components 表

### Technology Stack

| Layer | Choice / Version | Role in Feature | Notes |
|-------|------------------|-----------------|-------|
| Frontend | Next.js(既存)、React クライアントコンポーネント | 発車案内・時刻表・出典 | 新しい実行時依存は無し |
| Script | tsx(既存)、`fflate`、`csv-parse`(devDependencies に追加) | GTFS zip の展開と CSV の読み取り | クライアントには載らない |
| CMS | Payload(既存) | `site_settings` にアクセスタブ、データ移行 | `lexicalHTMLField` に `richTextHTMLConverters` を渡す |
| CI | GitHub Actions、既存の GitHub App のトークン | 毎日の時刻表更新 PR | App のトークンで作った PR は `frontend-ci` を起動する |
| External | ODPT `api-public.odpt.org` | 時刻表・リアルタイム情報 | 登録不要、CORS `*` |

## File Structure Plan

### Directory Structure
```
frontend/
├── scripts/
│   ├── fetch-bus-timetable.ts        # ODPT から全版の GTFS を取得し、対象の発車を抜き出して JSON を書く
│   └── fetch-bus-timetable.test.ts   # 抜き出し規則(停留所・乗車可否・行先・経由・方面・運行日)のテスト
├── src/
│   ├── data/
│   │   └── bus-timetable.json        # 生成物。コミットする
│   ├── lib/
│   │   ├── bus-timetable.ts          # JSON の型、版の選択、運行日の判定、日付の発車一覧
│   │   ├── bus-departures.ts         # 次の便の計算(既存ファイルを置き換え)
│   │   ├── gtfs-realtime.ts          # 使う項目だけを読む GTFS-RT デコーダ
│   │   ├── use-bus-realtime.ts       # リアルタイム情報の定期取得フック
│   │   └── access-settings.ts        # site_settings のアクセスタブの取得
│   └── components/
│       ├── bus/
│       │   ├── bus-departure-board.tsx   # トップページの次の便(クライアント)
│       │   ├── bus-timetable-table.tsx   # アクセスページの時刻表(サーバー)
│       │   └── bus-data-notice.tsx       # 出典・免責・問い合わせ先・取得日時
│       └── signage/
│           └── signage-bus-info.tsx      # 遅れ表示と出典を追加(既存)
│   └── app/(site)/access/page.tsx        # /access の専用ページ
.github/workflows/bus-timetable-update.yml # 毎日の更新 PR
cms/src/globals/site-settings.ts          # アクセスタブを追加(既存)
cms/src/migrations/<日時>_site_settings_access.ts        # A: 列の追加と pages からのコピー
cms/src/migrations/<日時>_drop_access_page.ts            # B: ナビゲーションの書き換えと pages の access の削除(フロントのデプロイ後)
```

### Modified Files
- `frontend/src/lib/bus-departures.ts` — 型と `nextDepartures` を、リアルタイム情報を受け取る `nextBusDepartures` に置き換える
- `frontend/src/lib/bus-timetable-data.ts` — 削除する
- `frontend/src/components/signage/signage-screen.tsx` — `useBusRealtime` を呼び、`nextBusDepartures` に補正済み時刻とリアルタイム情報を渡す
- `frontend/src/components/signage/signage-bus-info.tsx` — 遅れの表示と `BusDataNotice`(サイネージ用の小さい表記)を足す
- `frontend/src/components/access-section.tsx` — `ACCESS_SUMMARY` をサイト設定の値に置き換え、`BusDepartureBoard` を置く
- `frontend/src/app/(site)/page.tsx` — `AccessSection` にサイト設定の値を渡す
- `frontend/src/lib/venue.ts` — `ACCESS_SUMMARY` を削除する
- `frontend/src/app/sitemap.ts`(`OWN_HANDLING_ROUTES`)、`frontend/src/lib/crawl-targets.ts`(`SITEMAP_CODE_ROUTES`) — `/access` を専用ルートとして登録する
- `frontend/src/cms-types.ts` — 型の再生成
- `cms/src/globals/site-settings.test.ts` — タブと項目の一覧を更新する
- `frontend/package.json` — devDependencies に `fflate`、`csv-parse`、scripts に `bus:timetable`

UI の見た目(遅れの表示、出典の配置、時刻表の表組み、トップページの発車案内)は、実装の前に Figma で確定させる。

## System Flows

### 時刻表の更新

```mermaid
sequenceDiagram
  participant GA as bus-timetable-update
  participant S as fetch-bus-timetable
  participant C as ckan.odpt.org
  participant O as api-public.odpt.org
  GA->>S: 毎日 1 回実行
  S->>C: データセットページ (HTML) から版の日付を取得
  loop 版ごと
    S->>O: AllLines.zip?date=YYYYMMDD
    O-->>S: 302 → zip
    S->>S: feed_info.txt から有効期間を読む
  end
  S->>S: 抜き出して bus-timetable.json を書く
  GA->>GA: 差分があれば dev 向け PR を作る(既存 PR があれば更新)
```

- 有効期間が今日より前に終わった版は書き出さない
- 取得に失敗したらワークフローを失敗させ、JSON は書き換えない

### 次の便の決定

```mermaid
flowchart TD
  A[今日の発車一覧] --> B{車両の情報あり}
  B -- yes --> C{current_stop_sequence が対象停留所の停車順より大きい}
  C -- yes --> X[発車済み]
  C -- no --> K[案内に残す]
  B -- no --> D{TripUpdate あり}
  D -- yes --> E{stop_sequence が対象停留所の停車順より大きい}
  E -- yes --> X
  E -- no --> F[発車予定 = 時刻表 + delay]
  D -- no --> G[発車予定 = 時刻表]
  F --> H{現在時刻 >= 発車予定}
  G --> H
  H -- yes --> X
  H -- no --> K
```

- 車両の情報がある便は、時刻を過ぎていても車両が対象停留所を出るまで残す(5.2)
- リアルタイム情報の生成時刻が現在から 5 分より前なら、そのフィード全体を使わない(ガイドラインの「古い動的データを出さない」)

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1 | 対象停留所の便の抜き出し | fetch-bus-timetable | BusTimetableFile | 時刻表の更新 |
| 1.2 | 有効期間の版を使う | bus-timetable | `selectVersion` | — |
| 1.3 | 運行日区分 | fetch-bus-timetable、bus-timetable | `activeServiceIds` | — |
| 1.4 | Worker を起動せず配る | bus-timetable.json(クライアントの JS に同梱/サーバー描画で使用) | — | — |
| 1.5 | 1 週間以内の反映 | bus-timetable-update | Batch | 時刻表の更新 |
| 2.1 | ブラウザから直接取得 | use-bus-realtime | `useBusRealtime` | — |
| 2.2〜2.5 | 遅れの反映・無いとき・失敗時・区別 | bus-departures | `nextBusDepartures` | 次の便の決定 |
| 2.6 | 非表示中は取得しない | use-bus-realtime(use-polling) | — | — |
| 2.7 | 取得間隔の下限 | use-bus-realtime | `BUS_REALTIME_INTERVAL_MS = 30_000` | — |
| 3.1〜3.4 | サイネージの発車案内 | SignageBusInfo、signage-screen | `DirectionBoard` | 次の便の決定 |
| 4.1 | `/access` 専用ページ | access page | — | — |
| 4.2〜4.4 | 時刻表・記号と凡例・開催日の区分 | BusTimetableTable | `timetableForDate` | — |
| 4.5 | 関越交通へのリンク | access page | — | — |
| 4.6〜4.8 | サイト設定のアクセスタブ | site_settings、access-settings、AccessSection | `AccessSettings` | — |
| 5.1〜5.5 | トップページの次の便 | BusDepartureBoard | `DirectionBoard` | 次の便の決定 |
| 6.1〜6.5 | 出典・免責・問い合わせ先・生成時刻・取得日時 | BusDataNotice | `BusDataNoticeProps` | — |

## Components and Interfaces

| Component | Domain/Layer | Intent | Req Coverage | Key Dependencies | Contracts |
|-----------|--------------|--------|--------------|------------------|-----------|
| fetch-bus-timetable | Script | ODPT から抜き出して JSON を書く | 1.1, 1.3, 1.5 | ODPT (P0), fflate, csv-parse | Batch |
| bus-timetable-update | CI | 毎日スクリプトを実行し PR を作る | 1.5 | GitHub App トークン (P0) | Batch |
| bus-timetable | Lib | 版の選択・運行日・日付の発車一覧 | 1.2, 1.3, 4.4 | bus-timetable.json (P0), event-day | Service |
| gtfs-realtime | Lib | GTFS-RT の必要項目のデコード | 2.2 | — | Service |
| use-bus-realtime | Hook | リアルタイム情報の定期取得 | 2.1, 2.4, 2.6, 2.7 | use-polling (P0), gtfs-realtime | State |
| bus-departures | Lib | 方面ごとの次の便 | 2.2〜2.5, 3.1, 3.2, 3.4, 5.1, 5.2, 5.4, 5.5 | bus-timetable (P0) | Service |
| SignageBusInfo | UI | サイネージの発車案内 | 3.1〜3.4, 6.* | bus-departures | — |
| BusDepartureBoard | UI(client) | トップページの次の便 | 5.*, 6.* | use-bus-realtime, useNow | — |
| BusTimetableTable | UI(server) | アクセスページの時刻表 | 4.2〜4.4 | bus-timetable | — |
| BusDataNotice | UI | 出典・免責・問い合わせ先・時刻 | 6.1〜6.5 | — | — |
| access page | Route | `/access` | 4.1, 4.5, 4.6, 4.7 | access-settings, BusTimetableTable | — |
| site_settings アクセスタブ + migration | CMS | 文言の編集と移行 | 4.6〜4.8 | pages, navigation | Batch |

### Script / CI

#### fetch-bus-timetable

| Field | Detail |
|-------|--------|
| Intent | ODPT の全版の時刻表から対象の発車を抜き出して `bus-timetable.json` を書く |
| Requirements | 1.1, 1.3, 1.5 |

**Responsibilities & Constraints**
- 版の日付は `https://ckan.odpt.org/dataset/kan_etsu_transportation_all_lines` の HTML にあるリソース名 `関越交通バス-YYYYMMDD` から得る。ckan.odpt.org の API (`/api/3/action/package_show` 等) は 301 で `/dataset` へ転送され JSON を返さないため
- zip は `https://api-public.odpt.org/api/v4/files/odpt/Kan_etsuTransportation/AllLines.zip?date=YYYYMMDD` から取得する
- 版の有効期間は zip 内の `feed_info.txt` の `feed_start_date`・`feed_end_date` を使う
- HTML から版を 1 つも読み取れない、`feed_info.txt` に有効期間が無いときは失敗して JSON を書かない(ページの書式変更を黙って見逃さないため)
- 抜き出し規則:
  - 停留所 `200273_01`(群馬大学荒牧)、`200722_01`・`200722_02`(前橋自動車教習所前)
  - `pickup_type` が `1` の停車を除く
  - 行先は `stop_headsign`、空なら `trip_headsign`。全角括弧の中を経由として分ける
  - 方面は `direction_id` 1 = `maebashi`、0 = `shibukawa`
  - 系統は `route_long_name` の先頭の空白までの文字列(例: `22A`)
- 対象の発車を持つ `service_id` についてだけ、`calendar.txt` の曜日・期間と `calendar_dates.txt` の例外を書き出す
- 停留所 ID・方面の対応が想定と違う(対象停留所が見つからない、`direction_id` が 0/1 以外)ときは失敗して JSON を書かない
- 出力は決定的にする(並び順を固定し、取得日時は版の内容が変わったときだけ更新する)。毎日の実行で差分が出ないようにするため

**Contracts**: Batch [x]

##### Batch / Job Contract
- Trigger: `pnpm --filter frontend bus:timetable`(手動)、`bus-timetable-update.yml`(毎日 05:00 JST と `workflow_dispatch`)
- Input / validation: CKAN のデータセットページ (HTML)、各版の zip
- Output / destination: `frontend/src/data/bus-timetable.json`
- Idempotency & recovery: 同じ入力から同じ出力を作る。失敗時は既存の JSON を変えない

#### bus-timetable-update

- 毎日実行し、`bus-timetable.json` に差分があれば `chore/bus-timetable-update` ブランチに commit して dev 向けの PR を作る。同じブランチの PR が開いていれば push で更新する
- PR の作成には `cms-ci.yml` の `release` ジョブと同じ GitHub App のトークンを使う。`GITHUB_TOKEN` で作った PR では `frontend-ci` が起動しないため
- PR 本文には、追加・削除された版と有効期間を書く

### Lib

#### bus-timetable

| Field | Detail |
|-------|--------|
| Intent | 日付から版と運行日を決め、その日の発車一覧を返す |
| Requirements | 1.2, 1.3, 4.4 |

**Contracts**: Service [x]

##### Service Interface
```typescript
type BusStop = 'gunma_univ_aramaki' | 'driving_school';
type BusDirection = 'maebashi' | 'shibukawa';

interface BusTimetableFile {
  fetchedAt: string;              // ISO 8601。版の内容が変わったときの取得日時
  versions: BusTimetableVersion[];
}

interface BusTimetableVersion {
  version: string;                // 例: '20260919'
  validFrom: string;              // 'YYYY-MM-DD'
  validTo: string;                // 'YYYY-MM-DD'
  services: BusService[];
  departures: BusScheduledDeparture[];
}

interface BusService {
  id: string;                     // 例: '土曜'
  weekdays: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // 月〜日
  startDate: string;
  endDate: string;
  added: readonly string[];       // 'YYYY-MM-DD'
  removed: readonly string[];
}

interface BusScheduledDeparture {
  tripId: string;
  serviceId: string;
  route: string;                  // '22A'
  destination: string;            // '前橋駅'
  via: string | null;             // '群馬大学荒牧'
  direction: BusDirection;
  stop: BusStop;
  stopSequence: number;
  time: string;                   // 'HH:MM'
}

function selectVersion(file: BusTimetableFile, date: string): BusTimetableVersion | null;
function activeServiceIds(version: BusTimetableVersion, date: string): ReadonlySet<string>;
function departuresOn(file: BusTimetableFile, date: string): readonly BusScheduledDeparture[];
```
- Preconditions: `date` は JST の 'YYYY-MM-DD'
- Postconditions: `selectVersion` は `validFrom <= date <= validTo` の版のうち `validFrom` が最も新しいものを返す。無ければ null で、`departuresOn` は空配列
- Invariants: `activeServiceIds` は「曜日と期間で有効」に `added` を足し `removed` を引いた集合

#### gtfs-realtime

| Field | Detail |
|-------|--------|
| Intent | GTFS-RT の FeedMessage から使う項目だけを読む |
| Requirements | 2.2 |

**Contracts**: Service [x]

##### Service Interface
```typescript
interface RealtimeTripUpdate {
  tripId: string;
  stopSequence: number;
  delaySeconds: number;           // arrival.delay、無ければ departure.delay、どちらも無ければ 0
}

interface RealtimeVehicle {
  tripId: string;
  currentStopSequence: number;
  status: 'incoming_at' | 'stopped_at' | 'in_transit_to';
}

interface RealtimeFeed<T> {
  generatedAt: number;            // header.timestamp(epoch 秒)
  entities: readonly T[];
}

function decodeTripUpdates(bytes: Uint8Array): RealtimeFeed<RealtimeTripUpdate>;
function decodeVehicles(bytes: Uint8Array): RealtimeFeed<RealtimeVehicle>;
```
- 読む項目: FeedMessage.header(1).timestamp(3)、entity(2).trip_update(3).trip(1).trip_id(1)、stop_time_update(2).stop_sequence(1)/arrival(2).delay(1)/departure(3).delay(1)、entity.vehicle(4).trip(1).trip_id(1)、current_stop_sequence(3)、current_status(4)
- 知らない項目は読み飛ばす。`delay` は int32 で負の値(10 バイトの varint)を正しく読む
- 壊れた入力では例外を投げる(呼び出し側で取得失敗と同じ扱いにする)

#### use-bus-realtime

| Field | Detail |
|-------|--------|
| Intent | 2 つのフィードを定期取得してデコード結果を返す |
| Requirements | 2.1, 2.4, 2.6, 2.7 |

**Contracts**: State [x]

##### State Management
```typescript
const BUS_REALTIME_INTERVAL_MS = 30_000;

interface BusRealtime {
  tripUpdates: ReadonlyMap<string, RealtimeTripUpdate>;
  vehicles: ReadonlyMap<string, RealtimeVehicle>;
  generatedAt: number | null;     // 2 フィードの古い方。どちらも無ければ null
}

function useBusRealtime(): BusRealtime | null; // 一度も取得できていなければ null
```
- `use-polling.ts` で 30 秒ごとに `trip_update` と `vehicle` を並行して取得する。画面が隠れている間は取得しない
- 取得・デコードに失敗したフィードは、前回の値を捨てて空として扱う(古い動的データを出さない)
- 30 秒より短い間隔を指定できる引数は持たない

#### bus-departures

| Field | Detail |
|-------|--------|
| Intent | 発車一覧・リアルタイム情報・現在時刻から、方面ごとの次の便を返す |
| Requirements | 2.2〜2.5, 3.1, 3.2, 3.4, 5.1, 5.2, 5.4, 5.5 |

**Contracts**: Service [x]

##### Service Interface
```typescript
interface NextDeparture {
  route: string;
  destination: string;
  via: string | null;
  stopName: string;               // '群馬大学荒牧' | '前橋自動車教習所前'
  scheduledAt: string;            // 'HH:MM'
  expectedAt: string;             // 'HH:MM'。遅れが無ければ scheduledAt と同じ
  delayMinutes: number;           // 0 以上。早着の負の値は 0 にする
  source: 'realtime' | 'schedule';
  minutesLeft: number;            // expectedAt までの分(切り上げ、0 以上)
}

interface DirectionBoard {
  direction: BusDirection;
  departures: readonly NextDeparture[];
}

function nextBusDepartures(
  departures: readonly BusScheduledDeparture[],
  realtime: BusRealtime | null,
  now: Date,
  perDirection: number,
): readonly DirectionBoard[];
```
- 発車済みの判定は「次の便の決定」のフローどおり
- 同じ便が 2 停留所に停まるときは、発車済みでない最初の停車を採る(現行の挙動を引き継ぐ)
- `realtime.generatedAt` が `now` より 5 分以上前なら、`realtime` を null として扱う
- 方面の順は前橋駅方面、渋川駅方面(現行どおり)
- `minutesLeft` は、遅れて発車予定を過ぎた便では 0 になる。表示側は 0 を「まもなく」と出す

### UI

- **発車案内の表組み(SignageBusInfo・BusDepartureBoard 共通)**: 駅の発車標と同じ表にする。見出し → 列見出し「発車時刻」「系統」「行先・のりば」「発車まで」 → 便の行 → 出典
  - 便は 2 段。1 段目(同じ文字サイズ)は 発車時刻(Bold、「00:00」幅の固定幅・左揃え)・系統チップ(固定幅・中央揃え)・行先(Bold、最長 9 文字ぶんの固定幅・左揃え)・発車まで(Bold・警告色・右揃え。「N分」「まもなく」)。2 段目(小さいサイズ、灰色)は行先の列から のりばの正式名称「群馬大学荒牧 発」「前橋自動車教習所前 発」、発車までの列の右端に遅れのときだけ「約N分遅れ」(警告色)
  - 発車時刻は定刻のまま出し、発車までは遅れ込みの発車予定から数える。発車予定を過ぎて未発車の便(`minutesLeft === 0`)は「まもなく」
  - 列見出しと全便で列の位置を揃える。数字は `font-variant-numeric: tabular-nums` で桁を揃える
  - 発車時刻と系統チップは、行先・のりばの欄(2 段を合わせた高さ)に対して上下中央に揃える
  - 見出しのアイコン・列見出し「発車時刻」・全便の発車時刻・出典の左端を一致させる(枠の内側の左端。Figma の実測は横型 17、縦型 25、ボード 17)
  - 列の間隔: 横型 8、縦型 12、ボード `幅=PC` 8・`幅=SP` 4(SP の 326 幅に 1 段目を収めるため)
  - 配置先: トップページ PC `619:1408` のアクセスの節にボード `1648:2004`(`幅=PC`)、SP `619:1503` に `1648:2035`(`幅=SP`)。アクセスページは後述
  - 方面の便がすべて発車済みの行(運行終了)は、系統の列の左端から「本日の運行は終了しました」(1 段目のサイズ、Regular、灰色、2 段目なし)
  - 文字サイズ(見出し/列見出し/1 段目/2 段目): 横型 18/12/20/14、縦型 24/18/32/22、ボード 14/12/16/12
  - Figma: `Signage/BusInfo`(`1647:5484`)・`Signage/Portrait/BusInfo`(`1647:5591`)の `状態`(定刻・遅れ・まもなく)× `行先`(標準・長い)、`BusDepartureBoard`(`1648:1995`)の `状態`(定刻・遅れ・運行終了)× `行先` × `幅`(PC・SP。列の間隔だけが違う)
- **SignageBusInfo**: 枠の下端に短い出典「データ: 関越交通(CC BY 4.0)・公共交通オープンデータセンター」を 1 行で出す(6.6)。全文はアクセスページの `BusDataNotice` が持つ
- **BusDepartureBoard**(クライアント): props は `{ departures: readonly BusScheduledDeparture[]; fetchedAt: string }`。`useNow` と `useBusRealtime` から `nextBusDepartures(..., 1)` を計算して方面ごとに出す。`AccessSection`(サーバー)が JST の今日の `departuresOn` を渡す。全データをクライアントに送らないため
- **BusTimetableTable**(サーバー): 開催日(`site_settings.event_days`)ごとに、前橋方面の発車を 10〜18 時の行に「時 → 分の並び」で出す(2025 年のご案内ページの時刻表と同じ作り)
  - 1 便は 1 回だけ載せる。群馬大学荒牧で乗れる便は荒牧の時刻を下線・太字で出し、それ以外は前橋自動車教習所前の時刻を出す
  - 経由の記号: 経由から「前橋駅」「群馬大学荒牧」を除いた残りが「南橘団地・群大病院」なら ◯、「群大病院」なら ☆、「南橘団地」なら △、空なら無印。行先がけやきウォーク前橋の便も前橋駅を通るため、行先では記号を付けない。上記以外の経由が現れたら、抜き出しスクリプトを失敗させて記号の追加を促す
  - 表の下に凡例「下線太字は群馬大学荒牧発」「◯ 南橘団地・群大病院経由」「☆ 群大病院経由」「△ 南橘団地経由」を出す
  - 開催日どうしで発車が同じなら 1 つの表にまとめ、見出しに両日を書く
- **BusDataNotice**: props は `{ timetableFetchedAt: string; realtimeGeneratedAt: number | null; variant: 'page' | 'signage' }`。Figma `BusDataNotice / Page`(`1648:1904`)。`BusDepartureBoard` の中に置く。出典は次の固定文
  - 「このサービスは、以下の著作物を改変して利用しています。関越交通株式会社、関越交通バス・【リアルタイム情報】関越交通バス、クリエイティブ・コモンズ・ライセンス　表示4.0国際(https://creativecommons.org/licenses/by/4.0/deed.ja)」
  - 「公共交通オープンデータセンターのデータを利用しています。データの正確性は保証されません。内容に関するお問い合わせは関越交通ではなく、お問い合わせページ(`/contact`)へお願いします。」
  - 「時刻表の取得日時: …」「遅延情報の生成時刻: …」(後者は `realtimeGeneratedAt` があるときだけ)

### Route / CMS

#### access page(`frontend/src/app/(site)/access/page.tsx`)
- サーバーコンポーネント。`getAccessSettings()` の本文(HTML)・地図埋め込みを、現行の `StaticPageView` と同じ見た目で出し、その下に `BusDepartureBoard`(トップページと同じ。JST の今日の `departuresOn` を渡す、4.9)、`BusTimetableTable`、関越交通の路線バスページ(https://kan-etsu.net/pages/23/)へのリンクを出す。出典の全文は `BusDepartureBoard` に含まれるため、ページ単独の `BusDataNotice` は置かない
- Figma: ページ「アクセスページ」(`1649:2`)の `アクセス / PC (1440)`(`1649:3`)・`アクセス / SP (390)`(`1649:140`)。時刻表(`BusTimetableTable`)はこのフレーム内の「時刻表」で、単独のコンポーネントは無い。見た目は `globals.css` の `.rich-text-body .rt-table` の規則に合わせ、分は 3 列(1 時間あたりの便数の最大)
- 時刻表の計算はサーバーで行い、時刻表の JSON をクライアントに送らない
- `revalidate` は layout の 60 秒に従う。サイト設定の変更は再デプロイなしで反映される(4.7)

#### access-settings

```typescript
interface AccessSettings {
  summary: string;                // トップページの案内文
  contentHtml: string;            // アクセスページの本文
  embedUrl: string | null;
  embedHeight: number | null;
}

function getAccessSettings(): Promise<AccessSettings>;
```
- `cms.findGlobal('site_settings')` を既定の 60 秒キャッシュで使う

#### site_settings アクセスタブとマイグレーション

**Contracts**: Batch [x]

- 追加する項目(タブ「アクセス」、`site-settings.ts` の既存タブの後ろ):
  - `access_summary`(textarea、必須でない)
  - `access_content`(richText)と `access_content_html`(`lexicalHTMLField`、`storeInDB: true`、`converters: richTextHTMLConverters`)
  - `access_embed_url`(text、maxLength 500)、`access_embed_height`(number)
- マイグレーション A(フロントのデプロイ前):
  1. 列を追加する
  2. `pages` の slug `access` の `content`・`content_html`・`embed_url`・`embed_height` を `site_settings` にコピーする。`access_summary` には現行の `ACCESS_SUMMARY` の文字列を入れる
  - `down` は列を削除する
- マイグレーション B(フロントのデプロイ後、別 PR):
  1. `navigation` の項目のうち `pages` の `access` を参照しているものを、`link_type = 'path'`、`path = '/access'` に書き換える
  2. `pages` の `access` を削除する
  - `down` は `site_settings` の値から `pages` の `access` を作り直し、ナビゲーションを `page` 参照に戻す
- `cms-schema-check` は `site_settings` の変更を検出しないため、レビューでは移行の SQL を直接確かめる

## Error Handling

| 状況 | 振る舞い |
|------|----------|
| リアルタイム情報の取得・デコードに失敗 | そのフィードを空として扱い、時刻表どおりの時刻で案内を続ける(2.3, 2.4) |
| リアルタイム情報が 5 分以上古い | 使わない |
| 今日の日付に合う版が無い | 発車一覧を空にし、各方面に「本日の運行は終了しました」を出す。アクセスページは時刻表の代わりに関越交通のページへのリンクだけを出す |
| 時刻表の更新スクリプトの失敗 | ワークフローを失敗させ、JSON を変えない。既存の版で表示を続ける |
| サイト設定の取得に失敗 | 既存の `cms.ts` の挙動(直近の正常値の保持)に従う |

## Testing Strategy

- **Unit**
  - `fetch-bus-timetable`: 小さな GTFS(CSV の断片)から、乗車不可の除外、`stop_headsign` の優先、経由の分離、方面の対応、運行日の書き出しを確かめる
  - `bus-timetable`: 版の選択(期間の境界、2 版が重なる日)、`activeServiceIds`(祝日の例外、年末年始)、2026-11-14 が「土曜」・11-15 が「日祝」になること
  - `gtfs-realtime`: 2026-10-30 に取得した実データ(`trip_update`・`vehicle`)を fixture にし、`trip_id`・停車順・遅れ・生成時刻を読めること。負の `delay` を読めること
  - `bus-departures`: 車両が対象停留所を過ぎたら発車済み、過ぎていなければ時刻を過ぎても残る、TripUpdate だけのとき、リアルタイム情報なし、5 分以上古いとき、全便発車済み
- **Component**
  - `BusTimetableTable`: 時ごとの分の並び、記号と凡例、両日が同じときにまとまること
  - `BusDataNotice`: 出典の固定文、生成時刻の有無
  - `SignageBusInfo`: 遅れの表示
- **E2E / 実ブラウザ**
  - `/access` の表示と、サイト設定の変更が反映されること
  - トップページ(プレビュー URL またはローカルで、フェーズ切替を開催中にした状態)で発車案内が出て、ODPT の取得がブラウザから直接行われ、Worker へのリクエストが増えないこと(ネットワークログで確認)
  - タブを裏にしている間に取得が止まること

## Migration Strategy

```mermaid
flowchart LR
  A[CMS: アクセスタブ追加 + データ移行] --> B[ArgoCD PreSync で migrate]
  B --> C[フロント: /access 専用ページ・トップの文言をサイト設定から]
```
- CMS のマイグレーション A を先にデプロイし、次にフロントをデプロイし、最後にマイグレーション B をデプロイする
- 1 本にまとめると、フロントのデプロイ前に `pages` の `access` が消え、`/access` が 404 になる時間ができる。そのため 2 本に分ける
