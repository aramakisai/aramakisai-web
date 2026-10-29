# Research & Design Decisions

## Summary
- **Feature**: `signage-stage-start-notice`
- **Discovery Scope**: Extension(既存のサイネージ画面への表示の追加。新しい依存・データ・配信経路なし)
- **Key Findings**:
  - 出演枠は既存のスナップショットの`timetable`に絶対時刻(`slot.startAt`、ISO)で入っており、端末は補正済みの`now`を毎秒得ている。表示期間の判定は`stageNow`と同じく端末側の純関数で足り、CMS・配信経路の変更は要らない
  - 固定表示の有無は`pinnedEntries(data, now)`で既に求めており(`signage-screen.tsx`の`useTouchSession`への引数)、割り込みの抑止にそのまま使える
  - タッチ操作の画面(`SignageTouchLayer`)は通常の画面とは別に`SignageTelop`を持ち、項目を`telops`の props で受ける。テロップの差し替えは渡す配列を替えるだけで済む

## Research Log

### 出演枠のデータと時刻
- **Context**: 表示期間(開始3分前〜開始)の判定に使えるデータと時刻の所在
- **Sources Consulted**: `frontend/src/lib/timetable.ts`(`TimetablePerformance`、`isPerformanceActive`)、`frontend/src/lib/signage.ts`(`stageNow`、`slideAt`)、`frontend/src/lib/signage-time.ts`(`useCorrectedNow`)、`frontend/src/lib/signage-data.ts`
- **Findings**:
  - `TimetablePerformance`は`{ id, stageId, slot: { startAt, endAt, dateKey, ... }, name, href }`。`name`は公開団体の団体名、団体なしは出演枠のタイトル
  - `Timetable.stages`は`{ id, name }`の並び(ステージの並び順)
  - 補正済みの`now`は巡回・いまのステージ・バス・地震速報の期限で共通に使われている
  - 出演枠の変更は`signageNotifyHook(['snapshot'])`で端末へ通知され、スナップショットの取り直しで反映される
- **Implications**: 判定関数は`(timetable, now)`の純関数にし、巡回と同じ`now`を渡す。CMSの変更への追随は既存の経路に任せる

### メインの領域とテロップの差し込み口
- **Context**: 割り込みをどこに差すか
- **Sources Consulted**: `frontend/src/components/signage/signage-screen.tsx`、`signage-main.tsx`、`signage-telop.tsx`、`signage-touch-layer.tsx`
- **Findings**:
  - `SignageMain`は`.signage-main-frame > .signage-main`の枠に`CrossFade`でスライドを出す。縦型は同じ16:9の中身を縮小して出すため、メインの領域の見た目は1種類
  - `SignageTelop`の項目は`SignageTelopItem { id, audience, target, body }`。`target`は左のチップ、`body`は本文。件の切り替えと流し位置は`telopAt`で時刻から決まる
  - `SignageTouchLayer`は`telops`を受けて自分の`SignageTelop`(横型)に渡す
  - 地震速報のオーバーレイは`.signage-canvas`の最後の子で最前面
- **Implications**: メインは`SignageMain`に割り込みの props を足して同じ枠・同じ`CrossFade`で出す。テロップは`SignageTouchLayer`に渡す配列を表示期間中だけ割り込みの項目に替える

### 同時に始まる出演枠の数
- **Context**: 1枚に並べる(6.1)際の上限
- **Sources Consulted**: 本番CMSの公開API(`/api/stages`、`/api/performance_slots`)
- **Findings**: ステージは4つ(武道館ステージ・屋内ステージ・野外ステージ・GB155)。同じ開催日・同じ開始時刻の出演枠は現データで最大3件
- **Implications**: 並べる件数の上限はステージ数(4)。Figmaは1件と4件の両方の見本を作る

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 端末側の純関数 | `now`と`timetable`から表示中の告知を求める | 全端末が同時に切り替わる、通知不要、単体テストが容易 | 端末の時刻補正がずれると切り替えもずれる(巡回と同じ) | 採用。`stageNow`・`slideAt`と同じ流儀 |
| 配信経路の`publish` | サーバー側で開始時刻に機能を配信 | 判定を1か所に集約 | 開始時刻を見張る常駐処理が要る、DO・Workerの追加 | 不採用。要件2.2に反する |
| CMSのスライドとして自動生成 | 出演枠ごとにスライドを作り固定表示 | 管理画面で見える | CMSの変更が要る、固定表示と衝突 | 不採用。境界外 |

## Design Decisions

### Decision: 割り込みはプレイリストの項目にせず、`SignageMain`の別の props で出す
- **Context**: 1.1・1.3(巡回は裏で時刻どおりに進む)
- **Alternatives Considered**:
  1. `PlaylistEntry`に告知用の種別を足し、`buildPlaylist`で先頭に差す
  2. `SignageMain`に`notices`を足し、空でなければスライドの代わりに出す
- **Selected Approach**: 2
- **Rationale**: 1は`slideAt`の周期が告知の有無で変わり、割り込み後に時刻どおりのスライドへ戻らない(1.3)。CMSの`kind`の型にも存在しない種別を混ぜることになる
- **Trade-offs**: `SignageMain`の props が1つ増える
- **Follow-up**: 割り込みの出入りも`CrossFade`で切り替わること

### Decision: テロップの割り込みは`SignageTelopItem`を合成して渡す
- **Context**: 7.2・7.3
- **Alternatives Considered**:
  1. `SignageTelop`に告知専用の表示を足す
  2. 告知を`SignageTelopItem`の形に変換し、`SignageTouchLayer`へ渡す配列を差し替える
- **Selected Approach**: 2。チップ(`target`)にステージ名、本文(`body`)に「まもなく〇〇が始まります」を入れる。`audience`は`visitor`。`id`はCMSのテロップと衝突しないよう出演枠IDの負数
- **Rationale**: 計測・流し・時刻同期を既存の部品のまま使える。複数件は既存の件の切り替えで順に出る
- **Trade-offs**: チップは本来「対象」の表記だが、ここではステージ名を出す

### Decision: 見た目はFigmaで確定する
- **Context**: 4.4
- **Selected Approach**: メインの領域の割り込み表示のフレーム(1件・4件)をFigmaファイル`0kWDqHsLr6xE8b4FFgR1Zx`のページ「デジタルサイネージ」`828:2`に作り、承認を得てから実装する。テロップは既存の部品の見た目のまま
- **Follow-up**: 確定したnode-idをdesign.mdに書き足してから実装に入る

### Decision: 背景図形の演出(集合・拍・テンポ上昇・退場)
- **Context**: 要件8。ユーザーの要望「背景図形を使ったアニメーションで目立たせたい、イメージはフェス」
- **Alternatives Considered**:
  1. 案1 拍だけ
  2. 案2 集合+拍
  3. 案3 テンポ上昇(案1・2に足す)
  4. 配置B: 縁だけに置き文字に重ねない / 配置A: 文字の裏にも置く
- **Selected Approach**: 案1〜3をすべて採用、配置A。捌けるときは図形を外へ逃がす。Artifact の見本(https://claude.ai/artifact/MXawNgJ1QmV9sUep4spLVk)で比較し、ユーザーが選んだ
- **Rationale**: フェスの「次の出演」告知は図形をリズムに合わせて動かすのが定番(Envato の up next 素材、Flavs Festival の制作例)。図形は既存の背景図形(`docs/background-shapes/rules.md`)の種類・質感・∞のリングを流用し、サイトの装飾と揃える
- **Trade-offs**: 拍の位相を壁時計に揃えるため、端末の時刻補正がずれると拍もずれる(巡回と同じ)
- **Follow-up**: 4K の端末での描画負荷。並行する泡の背景(PR #251)と同じく CSS の animation だけで作る

## Risks & Mitigations
- 開催日以外は表示期間に入らず確認できない — ローカルのCMSで出演枠の日時を当日に合わせて実ブラウザで確認する
- 告知の出入りで`SignageTouchLayer`のテロップの項目が替わり、計測し直しが走る — 既存の`itemsKey`の変化による再計測の範囲で、追加の対応は不要

## References
- `.kiro/specs/digital-signage/design.md` — 時刻の同期と巡回の方針
- `.kiro/specs/signage-earthquake-alert/design.md` — キャンバス最前面のオーバーレイ
- `.kiro/specs/signage-touch-navigation/design.md` — タッチ操作の画面
