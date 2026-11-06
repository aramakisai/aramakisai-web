# Research & Design Decisions

## Summary
- **Feature**: `exhibition-random-order-history`
- **Discovery Scope**: Extension(既存の企画一覧・マイページ・GA4計測への統合)
- **Key Findings**:
  - 企画一覧は全カードをクライアントへ渡し、絞り込み・ページ送りをクライアントで行う。並び替えはクライアント内で完結でき、サーバー取得(`getExhibitionCatalog`)を共有するサイネージ・マイページ・スタンプAPIへ影響させずに済む
  - 初期HTMLは企画id順の先頭24件を描画しており、そのまま並べ替えると「id順で表示してから並べ替わる」見え方になる
  - GA4のeコマース推奨イベント(`view_item_list` / `select_item`)の項目(一覧名・掲載位置・アイテムid)と指標(一覧内の表示数・クリック数・クリック率)は標準で集計でき、掲載位置のためのカスタム定義は要らない

## Research Log

### 企画一覧の描画とクライアント状態
- **Context**: ランダム順をどこで決めるか、初期表示で並べ替わりが見えないか
- **Sources Consulted**: `frontend/src/app/(site)/exhibitions/page.tsx:14,34-46`、`frontend/src/components/exhibition-list.tsx:34-82,115-122`、`frontend/src/lib/exhibitions.ts:184,293,321,635`
- **Findings**:
  - `page.tsx` は `revalidate = 60` のISRで、学生企画と企業ブースの全カードを `ExhibitionList` に渡す
  - サーバー描画はURLを知らないため、初期HTMLは絞り込みなし・1ページ目(id順の先頭24件)を描画し、`useLayoutEffect` でURLから条件を復元する
  - ページ送りは `history.pushState` + `trackPageView()`、絞り込みは `history.replaceState` + `exhibition_search` イベント
  - カードは `ExhibitionCard`(`next/link`)で、先頭4件に `priority` を付けている
- **Implications**: 並び順はクライアントで決め、決まるまでカード領域を不可視にする。`priority` は並び順確定後の先頭4件にだけ付ける(id順の画像を先読みしない)

### 並び順の保持方法
- **Context**: 同じタブの間は並びを保ち、別タブでは新しい並びにする(Req 1.2, 1.3)
- **Sources Consulted**: MDN Web Storage API(sessionStorage はタブ単位で、再読み込み・履歴移動で保持され、新しいタブでは新しいストレージになる。タブの複製は内容を複製する)。他大学祭の実装(阪大: sessionStorage に順序配列、一橋: sessionStorage にシード、京大: localStorage にシード+30分)
- **Findings**: シード1個を sessionStorage に保存すれば要件を満たす。順序配列を保存すると、公開企画の追加・非公開化でずれる
- **Implications**: シードとカードのキー(`id:category`)からハッシュ値を求めて並べる方式にする。カードの追加・削除があっても他のカードの相対順が変わらず、絞り込み後の相対順も自動的に保たれる(Req 1.4)

### トップページの注目企画
- **Context**: 注目企画が一覧1ページ目からしか選ばれない
- **Sources Consulted**: `frontend/src/app/(site)/page.tsx:66-75,140-144`、`frontend/src/components/featured-exhibitions.tsx:13-14`、`frontend/src/lib/pick-random.ts`
- **Findings**: `getExhibitionListData(parseExhibitionQuery({}))` の `items`(id順24件)から `pickRandom(…, 4)` している。サーバーコンポーネントのため、選出はISRの再生成ごと(最短60秒)に1回
- **Implications**: 候補を企画一覧と同じ全カード(学生企画+企業ブース)に変える。選出の粒度(再生成ごと)は変えない。時間で露出が均される

### GA4 の一覧計測
- **Context**: 掲載位置・一覧の種別を集計できるようにする(Req 5.1-5.3, 5.7)
- **Sources Consulted**: GA4 推奨イベント `view_item_list` / `select_item`(パラメータ `item_list_id`, `item_list_name`, `items[]` の `item_id`, `item_name`, `item_category`, `index`)。本番プロパティ 490255062 に対し Data API でディメンション `itemListName`, `itemListPosition`, `itemId` と指標 `itemsViewedInList`, `itemsClickedInList`, `itemListClickThroughRate` を指定したレポートが受理されることを実測(2026-11-06、データ0行)
- **Findings**: 一覧名・掲載位置・アイテムidはアイテムスコープの標準ディメンションとして集計できる。イベントスコープの独自パラメータ(絞り込みの有無)はカスタムディメンション登録が要る
- **Implications**: 掲載位置・一覧の種別は標準項目で送る。カスタム定義の追加は `list_filtered`(イベントスコープのディメンション)だけ。消去件数は既存のカスタム指標 `item_count` を再利用する

### 参照元
- **Context**: サイト内遷移の参照元が記録されない(Req 5.6)
- **Sources Consulted**: `frontend/src/lib/analytics.ts:121-160`、`frontend/src/components/google-analytics.tsx:30-58`、GA4 の `page_view` イベントパラメータ `page_referrer`
- **Findings**: SPA遷移時は `page_view` に `page_location` だけを積み、`page_referrer` は初回の `document.referrer` のまま。2026-11-01〜05 の企画詳細の参照元は外部検索エンジン等で占められ、サイト内遷移が判別できなかった
- **Implications**: `analytics.ts` で直前に記録したページの位置を保持し、2回目以降の `page_view` に `page_referrer` として付ける

### 端末内保存
- **Context**: 閲覧履歴をブックマーク・スタンプと共存させる(Req 3.5-3.7)
- **Sources Consulted**: `frontend/src/lib/mypage-storage.ts:5-37,61-115,128-160`、`frontend/src/lib/use-mypage-data.ts`、`frontend/src/components/mypage-view.tsx:155-214,175-206,249-250,370`
- **Findings**: localStorage キー `aramakisai_mypage` の `version: 1` 構造に `lists.bookmarks` を持ち、`write` は全体を読み直して差し替える。parse は要素単位で検証し不正要素を除く。マイページのタブはURLハッシュで持つ
- **Implications**: `lists.history` を追加し、version は 1 のまま(欠落は空配列として読む)。既存の書き込み経路をそのまま使う

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| クライアントでシード+ハッシュ順 | sessionStorage のシードとカードキーのハッシュで並べる | サーバー・キャッシュ・他画面に影響しない。カード増減に強い | 初期HTMLの描画を隠す必要がある | 採用 |
| サーバーでランダム順 | ISR生成時にシャッフル | 実装が単純 | 60秒ごとに全員共通の並びになり、タブ内保持もできない | 不採用 |
| 順序配列を sessionStorage に保存 | 初回に全カードの順を保存 | 実装が単純 | カード追加・非公開化でずれる | 不採用 |

## Design Decisions

### Decision: 初期HTMLのカード領域を並び順確定まで不可視にする
- **Context**: Req 1.5(id順で表示してから並べ替わる見え方をさせない)
- **Alternatives Considered**:
  1. 初期HTMLからカードを外し、マウント後に描画する
  2. カードを描画したまま不可視にし、並び順確定後に可視化する
- **Selected Approach**: 2。`useLayoutEffect` で並び順とURL条件を確定してから可視化する
- **Rationale**: 領域の高さを保てるためレイアウトのずれが出ない。リンクはHTMLに残る
- **Trade-offs**: JavaScriptが動かない環境では `noscript` 内のスタイルで可視化し、id順で表示する

### Decision: 一覧計測はリンクのhrefでカードを特定する
- **Context**: `ExhibitionCard` はサーバーでもクライアントでも使われ、トップの注目企画はサーバーコンポーネント
- **Selected Approach**: 一覧を包むクライアントコンポーネントがクリックを捕捉し、押されたリンクのhrefを掲載項目と照合する
- **Rationale**: `ExhibitionCard` とサイネージの描画を変えずに済む
- **Trade-offs**: hrefの組み立て(`listingHref`)と照合キーを一致させる必要がある。同じ関数を使って一致を保証する

## Risks & Mitigations
- 旧バージョンのJavaScriptがキャッシュに残った端末でブックマークを書き込むと、`lists.history` が落ちる(旧parseが未知の項目を捨てるため) — 履歴は失っても再閲覧で再び記録されるため許容し、移行処理は設けない
- タブの複製では並び順も複製される — ブラウザ仕様どおりとして扱う
- `page_referrer` の付与は全ページのページ閲覧に及ぶ — `ga-technical-metrics` の Req 6 の計上条件は変えず、付与する値だけを追加する

## References
- GA4 推奨イベント(view_item_list / select_item): https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- MDN Window.sessionStorage: https://developer.mozilla.org/docs/Web/API/Window/sessionStorage
