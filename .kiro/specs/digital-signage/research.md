# Research & Design Decisions

## Summary
- **Feature**: `digital-signage`
- **Discovery Scope**: Extension(既存のPayload CMS+Next.jsフロントへの機能追加。外部依存はPayload Lexicalの表・Blocks機能と関越交通の時刻表PDFのみ)
- **Key Findings**:
  - `lexicalHTMLField`は`storeInDB`の真偽にかかわらず`afterRead`フックで毎回HTMLを生成し直す。変換器の変更は既存ドキュメントにも読み出し時点で効くため、本文部品追加のためのデータ移行は不要。一方で変換器を持たないブロックは`<span>unknown node</span>`として出力される
  - Payload 3.88の`@payloadcms/richtext-lexical`は`EXPERIMENTAL_TableFeature`と`BlocksFeature`を持ち、非同期HTML変換器`defaultConverters`に表(`table`/`tablerow`/`tablecell`)が含まれる。表の変換結果は`th`/`td`と`border: 1px solid #ccc; padding: 8px`のインラインstyleを出す。ブロックは`blocks.<slug>`へ自前の変換器を渡す必要がある
  - 駐車場空き情報は「Route Handler(`/api/parking`、no-store)+`usePolling`(20秒、失敗時は直前データ保持)+`cms.ts`のCache API(TTL 20秒)」で数十秒以内の反映を実現済み。サイネージは同じ`usePolling`と同じRoute Handler方式で集約エンドポイントを1本足すだけで要件12を満たせる
  - `frontend/src/lib/timetable.ts`に`findActivePerformances`(サイネージ向けの現在出演中抽出)と`toTimetable`があり、ステージ順・出演枠の時刻合成・色分け(`timetable-stage-colors.ts`)をそのまま流用できる

## Research Log

### 本文部品(Requirement 15)とPayload Lexical
- **Context**: 横並び・注意枠・ボタン型リンク・表を全richTextフィールドで共通に使う
- **Sources Consulted**:
  - `cms/node_modules/@payloadcms/richtext-lexical/dist/features/converters/lexicalToHtml/async/`(3.88.0の実体)
  - `cms/node_modules/@payloadcms/richtext-lexical/dist/features/experimental_table/server/index.js`
  - Payload docs v3.85 `rich-text/converting-html.mdx`(Converting Lexical Blocks to HTML、lexicalHTMLField)、`rich-text/official-features.mdx`
- **Findings**:
  - `EXPERIMENTAL_TableFeature`は公式に「将来の安定版でも破壊的変更・削除があり得る」と明記。サーバ側の行・列数フィールド(既定5×5)とクライアント`TableFeatureClient`を持つ
  - 非同期変換器の`TableHTMLConverterAsync`は`<div class="lexical-table-container"><table class="lexical-table" style=...><tbody>`を出す。セルは`headerState > 0`で`th`
  - `HTMLConvertersAsync`の`blocks`キーにブロックslugごとの変換器を渡す。変換器は`populate`(upload IDからドキュメント取得)を受け取れる
  - `lexicalHTMLField`は`afterRead`で`convertLexicalToHTMLAsync`を実行する(`storeInDB: true`は`beforeChange`で消さないだけ)
  - 変換器が無いノードは`unknown`変換器が無ければ`<span>unknown node</span>`
- **Implications**:
  - 表・ブロックともHTML化は`cms/src/lib/rich-text-html-converters.ts`で完結し、フロントの「HTML文字列を受け取る契約」を変えずに済む
  - 表は既定変換器のインラインstyleをsanitizeで捨てる設計にするより、変換器を上書きしてstyle無しのHTMLを出す方が許可リストが単純になる
  - richTextの中身はJSONで保存されるため、エディタ機能追加はDBマイグレーションを伴わない。クライアント機能の追加で`importMap.js`の再生成(`pnpm generate:importmap`)が必要
  - EXPERIMENTALの破壊的変更リスクはPayloadの更新時に表のテストで検出する

### 本文の描画(frontend)
- **Context**: 既存の本文描画は`frontend/src/components/rich-text.tsx`の`sanitize-html`許可リスト
- **Findings**:
  - 現在の許可タグは見出しh2〜h4・段落・リスト・リンク・画像等で、`table`/`div`/`figure`/`aside`は落ちる
  - `transformTags`でh1をh2へ読み替えている(撤廃対象)。h1を許可タグから外せば`sanitize-html`の既定(`disallowedTagsMode: 'discard'`)でタグだけ捨てられ文字が残る
  - `sanitize-html`は`allowedClasses`でタグごとにclass値を許可リスト化できる
  - 本文スタイルは`globals.css`の`.rich-text-body`配下に集約されている
- **Implications**: 新部品はclass付きの構造HTMLで出し、許可リストにタグ・class・`data-count`等を追加するだけで済む。サイネージは同じ`RichText`にclassを足して文字サイズ等だけ上書きする

### 更新反映の仕組み(既存の駐車場空き情報)
- **Context**: Requirement 12(数十秒以内・課金サービス追加なし・取得失敗時は直前維持)
- **Sources Consulted**: `frontend/src/app/api/parking/route.ts`、`frontend/src/lib/use-polling.ts`、`frontend/src/lib/parking-data.ts`、`frontend/src/lib/cms.ts`
- **Findings**:
  - `usePolling`は失敗時に`data`を保持し`error`だけ立てる。非表示タブでは止まり、再表示で即時取得する
  - `cms.ts`は公開GETをWorkersのCache API(`caches.default`)にTTL付きで保持する。`findMany`はTTLを指定できるが`findGlobal`は既定60秒固定
  - Cache APIはWorkers標準機能で追加課金サービスではない
- **Implications**: 反映遅延の上限は「CMSキャッシュTTL+ポーリング間隔」。コレクション取得をTTL 15秒、ポーリング20秒にすると最大約35秒。`festival_meta`は当日に変わらないため既定60秒のまま使う

### バス時刻表
- **Context**: Requirement 11。関越交通 前橋渋川線、群馬大学荒牧・前橋自動車教習所前
- **Sources Consulted**: https://kan-etsu.net/pages/23/ 掲載PDF(土日祝・前橋駅方面/渋川駅方面、2024年6月1日改正表記)をpdftotextで抽出
- **Findings**:
  - PDFはテキスト抽出可能。行=停留所、列=便。`||`は通過(経由しない)、空欄はその停留所まで行かない便
  - 前橋駅方面は渋川駅→群馬大学荒牧(経由便のみ)→前橋自動車教習所前→前橋駅。渋川駅方面は逆順
  - 系統番号は22A/22B/22C/22G/22H/22K/22L/22M/44C/55B等が混在。1便が両停留所に停まる場合がある(例: 22H 8:10群大荒牧→8:12教習所前)
  - 渋川駅方面には渋川駅まで行かない便(例: 22K)があり、行先は便ごとに確認が要る
  - 手元にあるのは土日祝ダイヤのみ。開催日2026-11-14(土)・15(日)はいずれも土日祝ダイヤ
- **Implications**:
  - 時刻データは便単位に「系統・行先・停留所ごとの発車時刻」を持つ型にし、リポジトリ内のTSモジュールとして保持する
  - 平日ダイヤは型だけ受け入れ、データは投入しない(開催日に使わない)
  - 行先は変換作業時にPDFの終点行から人手で確定する
  - 公式時刻表の二次利用可否は関越交通への確認事項として残る

### スライド表示時間の相場
- **Context**: 未確定事項「スライドごとの表示時間」
- **Sources Consulted**: [Notre Dame Digital Signage](https://onmessage.nd.edu/policies-and-guidelines/digital-signage/)、[Spectrio CampaignsHD AEF](https://support.spectrio.com/hc/en-us/articles/360056854434)、[UAB Medicine Digital Signage Best Practices 2023](https://www.uabmedicine.org/wp-content/uploads/sites/3/2023/11/Digital-Signage-Best-Practices-2023-Final.pdf)
- **Findings**: 1枚あたり7〜10秒が標準、QRコードを含むスライドは10〜15秒、30秒を超えない。通路など通り過ぎる場所は短め
- **Implications**: 既定10秒、スライドごとに上書き可。QR・表・タイムテーブル・落とし物は15秒を推奨値として管理画面の説明に書く

### Figma実測(ファイル`0kWDqHsLr6xE8b4FFgR1Zx`)
- **Context**: 見た目はFigmaが正。主要寸法をdesign.mdへ転記するため`get_metadata`/`get_design_context`で実測
- **Findings**:
  - 背景`#fbf8f3`(background)、メインは白・角丸16。見出しチップは`text`地・文字`background`・32px・px20 py10・角丸8、アイコン+文字gap8
  - 左カラム: ロゴ高55.42、DAYチップ(primary、28px Bold、px16 py8、角丸8)+日付28px、時計104px ExtraBold、区切り線gray-200、見出し(`mic`+「いまのステージ」)28px、ステージ欄gap20(チップ24px Bold px12 py4、角丸4、企画名30px/1.25 Bold、時刻24px gray-500)、下端に「▼公式サイト」28px+QR(240角)
  - テロップ: 地`text`、角丸16、px24、gap20、対象チップ28px Bold(来場者=primary、団体=warning)、文面44px Bold `background`色
  - バス案内: 白地、gray-200枠、角丸16、p16、gap8。見出し24px(`directions_bus`+「バス発車案内」Bold+エリア名gray-500)。便行: 系統チップ(primary、24px Bold)、行先28px Bold、時刻36px ExtraBold、残り分数24px Bold warning、停留所名24px gray-500右寄せ
  - スライドレイアウト: 1536×864、p64、Tone=alertは地がwarning。title=タイトル96px/1.1 ExtraBold+サブ40px/1.3 Bold中央寄せ、section=タイトル96px+サブ36px/1.4、上端282pxから左寄せ、title-content/two-content=タイトル64px/1.2 1行+本文枠(gap32)、two-contentは2列gap48
  - サイネージ本文: 36px/1.5、部品間gap24。Callout=地background、枠4px(注意warning/補足info)、p24、gap16、アイコン行高48。ImageRow=ラベル28px/1.2 Bold中央・画像の上、白枠p12、Fullは各360角、Halfは1〜2個320角・3個210角、gap24。Table=gray-200の2px罫、見出しセルgray-100、本文セルbackground、p12、28px/1.5
  - 公式サイト本文(PC幅768/SP幅358): Callout=枠2px・p16・gap12・アイコン24・本文16/1.8・角丸8・上余白24。ButtonLink=primary地・px24 py12・角丸8・16/1.5 Bold。Table=gray-200の1px罫、見出しgray-100、px16 py12、16/1.8、SPは表幅560で表だけ横スクロール。ImageRow=gap24、ラベル16/1.8 Bold中央、各項目等幅の正方形
  - 落とし物: 4列×2行(カード336幅・写真336×252・列gap48・行gap16)、品名30px Bold、「場所｜時刻」24px gray-500、右下に案内28px Bold
  - 協賛: Aは3列(ロゴ枠440×200)、Bは4列(324×144)、Cは6列(208×96)、プラン間32、社名24px、Dは社名のみ4列
  - タイムテーブル: 時刻列90、4時間を728pxで表示(1時間168px)、30分ごとに目盛、ステージ列は均等割、現在時刻線あり
  - 書体: LINE Seed JPが主。ただし左カラムのステージ欄・バス案内の便行・落とし物カードはNoto Sans JP指定
- **Implications**: 書体の混在は未決事項としてdesign.mdに残す。サイト全体はLINE Seed JPのみ読み込んでおり、Noto Sans JPは未読み込み

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 集約エンドポイント+クライアントポーリング | `/api/signage`が全データを1つのJSONにまとめ、画面が20秒ごとに取得 | 駐車場と同じ仕組みで新技術なし。端末側は1リクエスト | 1回の取得で複数のCMS問い合わせ(Cache APIで吸収) | 採用 |
| 部品ごとに個別ポーリング | テロップ・スライド・駐車場を別々に取得 | 部品の独立性 | リクエスト数増、取得時刻のずれで画面内の整合が崩れる | 不採用 |
| SSE / WebSocket(Durable Objects) | CMS更新を即時プッシュ | 遅延が秒単位 | Durable Objectsは課金対象、CMS側にWebhook実装が要る | 要件12.4に反する |
| 定期的なページ再読み込み | meta refresh等 | 実装最小 | 再読み込み中の白画面、テロップ・スライド位置がリセット | 不採用 |

## Design Decisions

### Decision: スライドは1コレクション+種別フィールド、順番は`sort`、固定表示はチェックボックス
- **Context**: Requirement 4.4〜4.7、14
- **Alternatives Considered**:
  1. グローバルに並び順(relationship hasMany)と固定表示スライドを持つ
  2. グローバルのblocksフィールドでスライドを並べる
  3. コレクション`signage_slides`に`kind`・`sort`・`enabled`・`pinned`を持たせる
- **Selected Approach**: 3
- **Rationale**: 既存コレクション(sponsors/stages/topics)の並び順は`sort`数値が流儀。グローバルを足さずに済み、編集箇所が1か所に収まる。blocks案はブロック種別ごとにテーブルが増え、richText+lexicalHTMLFieldをブロック内に置く前例が無い
- **Trade-offs**: 固定表示が複数チェックされうる → `sort`順で先頭の1枚だけを使う規則で吸収し、管理画面の説明に書く
- **Follow-up**: 管理画面の一覧列に`kind`・`enabled`・`pinned`・`sort`を出す

### Decision: 構内マップスライドはCMSに登録した構内マップ画像を表示する
- **Context**: Requirement 7.1、未確定事項「構内マップとして表示する内容」
- **Alternatives Considered**:
  1. 公式サイトのLeafletマップ(OSMタイル+エリア多角形)を操作無効で表示
  2. 実行委員が用意した構内マップ画像を表示
- **Selected Approach**: 2(スライドの`image`フィールドに登録)
- **Rationale**: Leafletマップは操作前提でラベルが小さく、遠目に読むサイネージに向かない。タイル配信(外部)にも依存する。画像なら紙のパンフレットと同じ図を出せる
- **Trade-offs**: マップデータ更新は画像の差し替えが要る
- **Follow-up**: なし

### Decision: ボタン型リンクはサイネージでは表示しない、QRは画像として登録する
- **Context**: 未確定事項「サイネージでのボタン型リンク」「横並びでQRを使う時の用意の仕方」
- **Alternatives Considered**:
  1. ボタン型リンクをURLのQRコード+ラベルへ置き換える(実行時生成またはCMS保存時生成)
  2. 非表示にし、QRが要る場合は横並びにQR画像を登録する
- **Selected Approach**: 2
- **Rationale**: 公式サイトQRも事前生成SVGで実行時生成を避ける方針。QR生成ライブラリを依存に足さずに済む。サイネージ向けの本文は横並び(▼ラベル+画像)でQRを出す構成がFigmaの見本どおり
- **Trade-offs**: 実行委員がQR画像を外部で作る手間。サイネージで同じ本文を流用するとボタンは消える
- **Follow-up**: 運用手順にQR画像の作り方(誤り訂正M・余白2モジュール)を書く

### Decision: 空になった自動スライドは表示対象から外す
- **Context**: 未確定事項、Requirement 9.6
- **Selected Approach**: 協賛0件・落とし物0件・駐車場0件・当日の公演0件・画像未登録のスライドは巡回から外す。全スライドが外れたらメイン領域は空の白地
- **Rationale**: 駐車場で決まっている規則(9.6)に揃えると判定関数を1つにできる

### Decision: バス時刻はTSモジュールで保持し、端末内で次便を計算する
- **Context**: Requirement 11.8
- **Selected Approach**: `frontend/src/lib/bus-timetable-data.ts`に土日祝ダイヤを型付きで保持。表示は`now`から純関数で次便を求める
- **Rationale**: 外部問い合わせ無し。データはビルドに同梱され、CMS取得失敗の影響も受けない
- **Trade-offs**: ダイヤ改正時はコード変更とデプロイが要る(年1回程度)

## Risks & Mitigations
- `EXPERIMENTAL_TableFeature`の将来の破壊的変更 — 表のHTML変換をテストで固定し、Payload更新時に検出する
- 本番固定ページ`comittee`の本文にh1がある — h1読み替え撤廃前にCMS上で見出し2へ直し、全`*_html`にh1が無いことを確認してからリリースする
- 端末の長時間連続表示によるブラウザのメモリ増加 — 当日の観察で問題が出たら定時再読み込みを足す(初期実装では入れない)
- デプロイ後も旧JSを持つ端末が新しい`/api/signage`を読む — レスポンス型は追加のみで変更し、フィールド削除をしない
- Workersリクエスト数 — 端末1台あたり1日約4,300リクエスト(20秒間隔)。CMS問い合わせはCache APIで端末間共有される
- 関越交通の時刻表の二次利用 — 開催前に問い合わせる(運用)

## References
- [Payload: Converting HTML](https://github.com/payloadcms/payload/blob/v3.85.0/docs/rich-text/converting-html.mdx) — Blocks変換器、lexicalHTMLField
- [Payload: Official Features](https://github.com/payloadcms/payload/blob/v3.85.0/docs/rich-text/official-features.mdx) — EXPERIMENTAL_TableFeatureの注意書き
- [関越交通 路線バス時刻表](https://kan-etsu.net/pages/23/) — 前橋渋川線の時刻表PDF
- [sanitize-html](https://github.com/apostrophecms/sanitize-html) — allowedClasses
- [Spectrio CampaignsHD AEF](https://support.spectrio.com/hc/en-us/articles/360056854434) — スライド表示時間の目安
