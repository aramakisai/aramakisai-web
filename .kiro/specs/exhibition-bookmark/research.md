# Research & Design Decisions

## Summary
- **Feature**: `exhibition-bookmark`
- **Discovery Scope**: Extension(既存のマイページ端末内保存・企画カード・企画詳細ページ・GA4送信への追加)
- **Key Findings**:
  - 現行の`readMypageData`は`stamps`以外のリストを捨てた値を返し、`addStamp`はその値を丸ごと書き戻す。`bookmarks`を足すだけでは、スタンプ記録のたびにブックマークが消える
  - PC判別は CSS の`pc-input`カスタムバリアント(`frontend/src/app/globals.css`、幅1024px以上かつ hover/pointer:fine のメディアクエリ)で、JS判定ではない。ボタンの非表示も同じバリアントで行えばSSRとクライアントで描画内容が一致する
  - GA4 プロパティ`properties/490255062`(aramakisai.com)に`exhibition_id`・`exhibition_category`がイベントスコープのカスタムディメンションとして登録済み。`bookmark_add`・`bookmark_remove`は同名パラメータで送れば追加登録なしで集計できる

## Research Log

### 端末内保存の読み書き
- **Context**: 要件4.5/4.6(スタンプとブックマークが互いを変更しない)
- **Sources Consulted**: `frontend/src/lib/mypage-storage.ts`
- **Findings**:
  - `parse`は`{ version: 1, lists: { stamps } }`だけを組み立て、他のキーを捨てる
  - `addStamp`は`{ ...data.lists, stamps: [...] }`を書くが、`data.lists`は既に`stamps`だけになっている
  - カテゴリ検証は`isStampCategory`(`stage`を含まない)で、ブックマークにそのまま使えない
- **Implications**: `parse`が`bookmarks`も検証して保持する形に変える。カテゴリ検証はリストごとに分ける

### 旧コードとの混在
- **Context**: デプロイ前に開いたタブの旧JSが`addStamp`を呼ぶと、新形式の`bookmarks`を消す
- **Findings**: `/mypage`・`/exhibitions`(企画詳細を含む)は live フェーズでのみ公開される(`frontend/src/lib/phase.ts`)。本番の live 切替は開催直前で、本機能のデプロイ(10/20 期日)より後。ブックマークを持つ端末は新コードでしか生まれない
- **Implications**: 移行処理・版番号の変更は不要。`version: 1`のまま`bookmarks`を任意のキーとして足す(無ければ空)

### Material Symbols のブックマークアイコン
- **Context**: 要件1.2(FILL=1/0の切替)
- **Sources Consulted**: `frontend/src/app/layout.tsx`の`MATERIAL_SYMBOLS_HREF`、Google Fonts css2 API への実リクエスト
- **Findings**:
  - フォントは`icon_names`でグリフを限定して読み込んでおり、`bookmark`は現在含まれない
  - 軸指定は`FILL@0..1`で、塗り/線画の両方が既に読み込まれる
  - `icon_names=arrow_back,bookmark,person`で 200 が返り、`bookmark`無しとは異なるフォントキットが返る(グリフが含まれる)。`icon_names`の並び順を変えても同じキットが返り、順序の制約は無い
  - `frontend/src/components/icons.tsx`の`renderIcon(ligature, fill, testId, props)`が FILL を inline style で指定する。`createIcon`は FILL 固定のため、状態で切り替えるアイコンは`renderIcon`を直接使う
- **Implications**: `MATERIAL_SYMBOLS_ICON_NAMES`に`bookmark`を追加し、`BookmarkIcon({ filled })`を追加する

### SSR・ハイドレーションと状態同期
- **Context**: ISR でキャッシュされるページ(企画一覧`revalidate = 60`、企画詳細`300`)に端末依存の状態を出す
- **Sources Consulted**: React `useSyncExternalStore`(getServerSnapshot はハイドレーション中に使われ、その後 getSnapshot で再描画される)、`frontend/src/components/mypage-view.tsx`(現行は useEffect で読み込み、読み込み前は空表示を出さない)
- **Findings**:
  - サーバーは localStorage を読めないため、サーバー描画では状態未確定として描くしかない
  - 同一タブ内でカードと詳細は別ページで、App Router のページ遷移でページは再マウントされる(既存`ExhibitionList`もマウント時に URL から復元している)
  - 別タブでの変更は`storage`イベントで届く。同一タブ内の書き込みは`storage`イベントが発火しない
- **Implications**: `useSyncExternalStore`で、`storage`イベントと同一タブ内の独自イベントを購読する。サーバースナップショットは「未確定」とし、未確定の間はボタンを`invisible`で場所だけ確保する

### GA4
- **Sources Consulted**: `frontend/src/lib/analytics.ts`、`frontend/src/components/stamp-collector.tsx`、GA4 Admin API(読み取りのみ)
- **Findings**:
  - `sendGaEvent(name: 'qr_stamp', params: QrStampParams)`は`NODE_ENV === 'production'`かつ測定IDありのときだけ dataLayer に`arguments`を積む
  - `properties/490255062`に`customEvent:exhibition_id`(企画ID)・`customEvent:exhibition_category`(企画カテゴリ)がある。もう一方の`properties/461639571`には無い
- **Implications**: 型だけ広げて同じ関数で送る。追加のカスタムディメンション登録は不要(本番の測定IDが 490255062 のものであることが前提)

### 企画カードの利用箇所
- **Findings**: `ExhibitionCard`は`exhibition-list.tsx`(企画一覧)、`featured-exhibitions.tsx`(トップページ。開催前フェーズでも表示)、`campus-map/area-exhibition-list.tsx`(マップ)の3か所で使われる
- **Implications**: 要件2.2・6.2に合わせ、ボタンは任意 prop で有効化し企画一覧だけが渡す

## Design Decisions

### Decision: 状態の購読方式
- **Alternatives Considered**:
  1. 各ボタンが useEffect で一度だけ読む(現行マイページと同じ)
  2. `useSyncExternalStore`で localStorage を購読する
- **Selected Approach**: 2
- **Rationale**: マイページの一覧から解除したときの即時反映、別タブでの変更、`storage`イベントを1か所で扱える。ハイドレーション不一致も getServerSnapshot で避けられる
- **Trade-offs**: スナップショットは生文字列で比較し、パース結果をその文字列でメモ化する必要がある(毎回新しいオブジェクトを返すと無限再描画になる)

### Decision: カードの非入れ子化
- **Alternatives Considered**:
  1. ボタンを Link の中に置き`preventDefault`する
  2. 外側を非リンクの箱にし、Link とボタンを兄弟にしてボタンを絶対配置で重ねる
- **Selected Approach**: 2
- **Rationale**: `<a>`の中の`<button>`は HTML の内容モデル違反で、支援技術の読み上げも崩れる(要件2.3)

### Decision: PC非表示の判定
- **Selected Approach**: `pc-input:hidden`クラス(CSS)
- **Rationale**: マイページ本体と同じ判定になり、JS判定によるハイドレーション不一致も起きない

## Risks & Mitigations
- 状態未確定の間のチラつき — `invisible`で場所を確保し、確定後に塗り/線画を表示する
- カード構造変更で見た目が変わる — 外枠のクラス(角丸・クリップ・影)を外側の箱へ移し、Link には内側のレイアウトだけを残す。変更前後を実ブラウザで寸法比較する
- 本番の GA4 プロパティが想定と違う — 測定IDとプロパティの対応をユーザーが確認する

## References
- [useSyncExternalStore – React](https://react.dev/reference/react/useSyncExternalStore) — getServerSnapshot とハイドレーション
- [Material Symbols guide – Google Fonts](https://developers.google.com/fonts/docs/material_symbols) — FILL 軸と icon_names
- [HTML Standard: the a element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element) — interactive content を子孫に持てない

## 追記: ユーザー回答を受けた UI の決定
- **参考**: 五月祭(visitor.gogatsusai.jp)。カードは右上にアイコンだけ(背景円なし)・ボタンとリンクが兄弟、詳細ページはアイコン上・ラベル下で枠なし、マイページはアイコン上・ラベル下のタブ(選択中に下線)
- **カードのアイコン位置**: Figma ExhibitionCard`2:139`の実測(Body 右余白56、ボタン右8・下8)に従う。企画名が`text-text`で載る明るい帯(白35%を重ねた地)の上なので、背景円なしで読める
- **タブ**: リポジトリに`role="tablist"`の実装は無い(タイムテーブルの日付切替は`role="group"`+`aria-pressed`)。見た目は Figma MypageTabs`1098:6985`の実測値を既存トークンで書く
- **タブ状態の保持**: `/mypage`は ISR(`revalidate = 60`)で、サーバーでクエリを読むと静的生成でなくなるため、クライアントだけが読むハッシュ(`#bookmarks`)を使う
- **アイコン名**: `approval`(e982)・`bookmark`(e8e7)が Material Symbols Sharp の公式 codepoints 一覧にあることを確認(https://github.com/google/material-design-icons の variablefont)
- **ラベルの書体**: Figma のラベルは LINE Seed JP Regular 10px/1.6。`text-body-xs`は大きさと行高だけで、書体は`body`の`font-sans`(端末のフォント)になるため`font-display`を併記する
- **アクション行の形**: Figma は「ブックマークを出すか」で形を分けている(出す=積む形`2:531`/`1107:1516`、出さない=1行の形`2:468`/`802:731`/`1106:756`)。画面幅では分けない
