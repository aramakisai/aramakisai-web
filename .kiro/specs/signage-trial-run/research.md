# Research & Design Decisions

## Summary
- **Feature**: `signage-trial-run`
- **Discovery Scope**: Extension(既存のサイネージ配信・時刻補正・CMS のスライド固定 UI の拡張)
- **Key Findings**:
  - 端末の時刻は `/api/signage` の `serverNow` と端末時計の差(`offsetMs`)で補正され、`signage-screen.tsx` の `now` 1つから全表示が決まる。ずれ量を全端末に同じ値で配れば同期の仕組みは変えずに済む。
  - `now` は試験時刻にしてはいけない実データの鮮度判定(バスの発車・リアルタイム鮮度、駐車場画像の古さ、配信経路のブロードキャスト期限)にも使われている。時計を「試験時刻」と「実時刻」の2本に分ける必要がある。
  - タッチ操作のサブページは iframe 内の別ドキュメントで、端末時計(`useNow`)で動く。サーバーの時刻を見ていないため、親画面からずれ量を渡す必要がある。

## Research Log

### 時刻補正と同期の経路
- **Context**: 要件 2(全端末で揃った試験時刻)
- **Sources Consulted**: `frontend/src/lib/signage-time.ts`, `frontend/src/components/signage/signage-screen.tsx:55-109`, `frontend/src/lib/signage-data.ts:114-171`
- **Findings**:
  - `fetchSnapshotFrom` が `clockOffsetMs(serverNow, sentAt, receivedAt)` で `offsetMs` を求め、`useCorrectedNow` が秒の境目に合わせて `now` を更新する。
  - `serverNow` は CMS 取得(キャッシュ TTL 15 秒・版付きキー)の後、応答ごとに `new Date()` で算出され、キャッシュされない。
  - `signage_settings` は `getSignageSnapshot` で取得済み(`depth:0`)。
  - 取得経路は 120 秒ごとのポーリングと、配信経路の `snapshot` 版通知による取り直し(版付きキーでキャッシュを迂回)の2つ。
- **Implications**: 試験のずれ量をスナップショットに含めれば、版通知で全端末がほぼ同時に取り直し、各端末が同じずれ量を足すだけで揃う。

### `now` の利用箇所と実時刻を要する箇所
- **Context**: 要件 2.2 と範囲外(バスの案内、実データ)
- **Sources Consulted**: `signage-screen.tsx:115-199`, `lib/bus-next-departures.ts:49-108`, `slides/parking-slide.tsx:60`, `lib/use-signage-channel.ts:99,140-149`
- **Findings**:
  - 試験時刻で動かす: `buildPlaylist`/`pinnedEntries`(タイムテーブルの表示判定を含む)、`slideAt`、`stageStartNotices`、`stageNow`、`TimetableSlide`、`SignageStageNotice`、`SignageLeftColumn`/`SignagePortraitHeader`/`SignagePortraitInfo`(開催日・時計・いまのステージ)、`SignageTelop`(`offsetMs` を受け `Date.now() + offsetMs`)、`SignageTouchLayer`、`SignageQuakeOverlay` 内の `SignageMain`。
  - 実時刻が必要: `departuresOn(toJstDateKey(now))` と `nextBusDepartures(..., now)`(発車済みの除外とリアルタイム情報の 5 分鮮度判定)、`ParkingSlide` の `isImageStale`、`useSignageFeature(channel, feature, now)` の期限判定。
- **Implications**: 補正済み時刻を `realNow` と `now`(試験時刻)の2本にし、上記の実時刻側だけ `realNow` を渡す。

### 配信経路の通知
- **Context**: 要件 1.5, 1.7, 2.4, 2.5
- **Sources Consulted**: `cms/src/lib/signage-notify.ts`, `frontend/workers/signage-hub/hub-core.ts:82-136`, `frontend/workers/signage-hub/index.ts:22-39`
- **Findings**:
  - `signage_settings` の `afterChange` は `['pin']` だけを通知する。`pin` はハブが `/api/signage/pin` の内容に差分があるときだけ配り、`parsePin` は `slide`/`visibleSlideIds` しか通さない。
  - `['snapshot']` は全端末へ版を配り、端末は 1 秒以内のゆらぎを付けて版付きで取り直す。
- **Implications**: 試験運転の設定はスナップショットで運び、`signage_settings` の通知を `['pin', 'snapshot']` にする。

### タッチ操作のサブページ
- **Context**: 要件 3
- **Sources Consulted**: `signage-touch-layer.tsx:90-123, 220-223, 426-448`, `lib/signage-touch-message.ts`, `touch/touch-timetable.tsx:26`, `touch/touch-parking-list.tsx:24`, `lib/use-now.ts`
- **Findings**:
  - サブページは `TouchFrame` の iframe(同一オリジン)に `location.replace` で読み込まれ、文書の準備ができると `signage-touch-ready` を親へ `postMessage` する。親は `onReady` で受ける。
  - 時刻を使うのは `touch-timetable`(対象日・出演中)と `touch-parking-list`(画像の古さ)だけ。どちらも `useNow` で端末時計を使う。
- **Implications**: 親が `signage-touch-ready` に応えてずれ量を iframe へ送り、ずれ量が変わったときも送る。タイムテーブルだけがずれ量を足す。駐車場一覧は実データの鮮度判定なので実時刻のまま。

### CMS のスライド固定 UI と保存経路
- **Context**: 要件 1
- **Sources Consulted**: `cms/src/collections/signage-slides.ts:33-75`, `cms/src/components/signage-pin.ts`, `useSignagePin.ts`, `SignagePinBanner.tsx`, `useEventDays.ts`, `cms/src/globals/index.ts`, `cms/src/access/policy.ts:36-40,77,113-`
- **Findings**:
  - 一覧画面の `admin.components.beforeListTable` に `[SignageQuakePanel, SignagePinBanner, SignageGroupSwitches]` が並ぶ。
  - 固定の保存は Payload 標準の REST(`POST /api/globals/signage_settings`)。`signage_settings` の update は実行委員のみ、read は未認証を含め公開。
  - 開催日は `useEventDays`(`GET /api/globals/site_settings?depth=0` の `event_days`)で読める前例がある。
  - `releasePinIfHidden` と `signage-slides` の `afterChange` が `updateGlobal({ data: { pinned_slide: null } })` を呼ぶ。
  - `signage-settings.test.ts:21` がフィールド数 1 を固定している。
- **Implications**: 試験運転の操作は同じ一覧画面・同じ保存経路・同じ権限に乗せる。固定の更新で試験運転の設定が消えない(またはその逆)ことを統合テストで確かめる。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. serverNow を試験時刻にずらす | API が試験時刻を `serverNow` として返す | 端末側の変更が最小 | バス・駐車場など実時刻が要る判定まで動き、実時刻を復元する手段がない | 不採用 |
| B. 実時刻の serverNow + ずれ量を返す | `serverNow` は実時刻のまま、`trialShiftMs` を別に返す | 実時刻と試験時刻を端末で両方持てる。同期の仕組みは不変 | 端末側で2本の時計を配る改修が要る | 採用 |
| C. 端末ごとの URL 指定 | `?at=` で端末ごとにずらす | サーバー変更なし | 複数台の同期を試せない | ユーザーが却下済み |

## Design Decisions

### Decision: 試験時刻はずれ量で配る
- **Context**: 要件 2.1 と、バス・実データを実時刻に保つ範囲外の条件
- **Alternatives Considered**: 上表 A / B
- **Selected Approach**: スナップショットに `trialShiftMs = 試験内の開始日時 − 開始操作の現実日時` を追加する。端末は `now = 実時刻補正 + trialShiftMs`。
- **Rationale**: 全端末が同じずれ量を足すので、同期精度は通常運転と同じ。実時刻も失わない。
- **Trade-offs**: 要件 2.1 の文言(「現在時刻の代わりに試験時刻を返す」)をこの方式に合わせて改める。
- **Follow-up**: 要件 2.1 を更新済み。

### Decision: 開始操作の現実日時はサーバーで刻む
- **Context**: 要件 1.5, 1.6
- **Selected Approach**: `signage_settings` の `beforeChange` で、試験内の開始日時が変わったときだけ `anchored_at` に現在時刻を入れる。消えたら `anchored_at` も消す。
- **Rationale**: 操作した PC の時計に依存しない。固定の更新など無関係な保存で起点がずれない。

### Decision: 試験中表示は親画面の最前面に1枚
- **Context**: 要件 4
- **Selected Approach**: `signage-screen.tsx` のキャンバスの最後(地震速報の全面表示より後)に `pointer-events-none` の全面レイヤーを置く。iframe もキャンバス内なので同じレイヤーで覆える。
- **Rationale**: サブページ側に別の表示を作らずに済み、タッチは下へ通る。

### Decision: 起点は「start_at が送られた保存」で毎回刻む
- **Context**: 要件 1.6。同じ日時で開始し直しても巻き戻らない問題(設計レビューで指摘)と、Payload 3 の global 更新で送られなかった group が `{}` で `beforeChange` に届く事実(`payload/dist/globals/operations/update.js`, `fields/hooks/beforeValidate/promise.js`)
- **Selected Approach**: `undefined`(送信なし)は保持、`null` は終了、文字列は値が同じでも起点を刻み直す。検証も送信時だけ行う。
- **Rationale**: 同じ出演枠の通知を何度でも見直せる(ユーザー判断)。固定の保存・自動解除が試験運転の検証に巻き込まれない。

### Decision: タッチのサブページへは signage-touch-path を受けて送る
- **Context**: `signage-touch-ready` は地図ページ(`touch-map.tsx`)しか送らない。`signage-touch-path` は layout の `TouchLocationReporter` が全ページで送る(`touch-location-reporter.tsx:13`)。
- **Selected Approach**: `signage-touch-path` の受信をずれ量送信のきっかけにする。タッチのタイムテーブルは、サーバーが実時刻で決めた `initialDayKey` を、ずれ量を最初に受けた時点で決め直す(利用者の選択後は上書きしない)。

## Risks & Mitigations
- Payload の global 更新で、送らなかったフィールドが保持されるか — 固定の保存(`pinned_slide` のみ送信)と試験運転の保存(`trial_run` のみ送信)を交互に行う統合テストで確かめる。
- 試験運転の消し忘れ — 現実の日付が開催日の間は API が `trialShiftMs` を返さない(ユーザー判断)。加えて全画面の「試験中」表示と CMS 一覧画面の表示で気付ける(要件 2.7, 4, 1.8)。
- CMS の画面で表示する試験時刻は操作 PC の時計で進める — 分単位の表示で、端末の表示と数秒ずれる。

## References
- 既存 spec(ADR として参照): `.kiro/specs/signage-sync-transport/`, `.kiro/specs/signage-stage-start-notice/`, `.kiro/specs/signage-touch-navigation/`
